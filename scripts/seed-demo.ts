/**
 * Демо дата үүсгэгч — GS25 танилцуулгад зориулсан 20 дэлгүүрийн флот.
 *
 *   npm run seed:demo:reset            → <cwd>/data/demo.db-г цэвэрлээд дахин үүсгэнэ
 *   npm run seed:demo                  → байгаа сан дээр нэмнэ
 *   npm run seed:demo -- --db path.db  → өөр зам
 *   npm run seed:demo -- --live-branches → gs25.mn-ээс бодит салбар татаж хэвлэнэ
 *
 * ⚠️ ДАРААЛАЛ ТУЛГУУР. `tx()` нь давхарлагдахыг дэмждэггүй (bare BEGIN), харин
 * `createOrder` / `planStore` / `submitOrder` бүгд дотроо `tx()` дууддаг. Тиймээс:
 *   - 4-5 алхам (bulk бичилт, hoisted raw statement) НЭГ tx дотор
 *   - 6-7 алхам (planStore, submitOrder) COMMIT-ын ДАРАА, тус бүр өөрийн tx-тэй
 * Үүнийг зөрчвөл "cannot start a transaction within a transaction" гэж унана.
 *
 * Мөн 6-г 5-ын дараа тавих нь: `getLatestOrder` нь `ORDER BY id DESC` (огноогоор
 * БИШ), тул хамгийн өндөр id-тай захиалга нь planStore-ын бүтэн `DecisionFactors`
 * агуулсан нь байх ёстой — эс тэгвэл диаграмын дэлгэрэнгүй хоосон болно.
 */
import { join } from "node:path";
import { openDbAt, tx } from "@/lib/db/index";
import {
  assignStore,
  setStoreLastSync,
  upsertOperator,
  upsertStore,
} from "@/lib/db/repositories/stores";
import {
  getGlobalDefaults,
  setStoreConfig,
  updateGlobalDefaults,
  upsertItem,
} from "@/lib/db/repositories/config";
import { computeNextRun, updateSchedule } from "@/lib/db/repositories/schedule";
import { addOutboxMessage } from "@/lib/db/repositories/outbox";
import { getOrder } from "@/lib/db/repositories/orders";
import { getStore } from "@/lib/db/repositories/stores";
import { planStore } from "@/lib/replenish/planStore";
import { buildDecisionBoard } from "@/lib/replenish/board";
import { submitOrder } from "@/lib/ordering/submit";
import { composeMessages } from "@/lib/ordering/smsSink";
import { addDays } from "@/lib/engine/util";
import { lastNDaysRange } from "@/lib/sms/suggest";

import { DEMO_BRANCHES, printLiveBranches } from "./demo/branches";
import { CORE_CATEGORIES, DEMO_SKUS } from "./demo/catalog";
import { ARCHETYPE_LABEL, ARCHETYPE_PLAN, EXPECTED_VERDICT } from "./demo/archetypes";
import { simulateStore } from "./demo/simulate";
import { sample, streamFor } from "./demo/rng";
import { synthesizeHourlyTx } from "./demo/txTraffic";
import { upsertTxHourly } from "@/lib/db/repositories/txStats";

// Trend чарт нь 8 долоо хоног харуулдаг тул захиалгын түүх мөн 8 долоо хоног
// байх ёстой — эс тэгвэл эхний долоо хоногууд "гараар оролцоо 0%" гэж худал
// харагдана.
const ENGINE_DAYS = 60;
const ORDER_HISTORY_DAYS = 56;
const OUTBOX_HISTORY_DAYS = 7;
/** Ангилал тус бүрийн доод хязгаар — board-ын minCategoryItems (3)-аас дээгүүр */
const MIN_PER_CATEGORY = 4;
const MIN_CORE_CATEGORY = 6;
const AUTO_SUBMIT_MAX_AMOUNT = 3_000_000;

// FK-safe устгах дараалал (хүүхдээс эцэг рүү)
const RESET_TABLES = [
  "sms_outbox",
  "order_lines",
  "orders",
  "daily_metrics",
  "item_config",
  "category_config",
  "store_config",
  "items",
  "alerts",
  "ingestion_runs",
  "seasonality_profile",
  "store_schema_map",
  "tx_hourly",
  "tuning_history",
  "audit_log",
  "operator_stores",
  "operators",
  "stores",
];

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

async function main(): Promise<void> {
  if (flag("live-branches")) {
    await printLiveBranches();
    return;
  }

  const dbPath = arg("db") ?? join(process.cwd(), "data", "demo.db");
  const doReset = flag("reset");
  const started = Date.now();

  console.log(`\n📦 Демо дата үүсгэж байна → ${dbPath}`);
  const db = openDbAt(dbPath);

  // --- 1. Цэвэрлэх ---------------------------------------------------------
  if (doReset) {
    // Файлыг устгахгүй — устгавал уншигч барьж байгаа -wal/-shm өнчирнө.
    tx(db, () => {
      for (const t of RESET_TABLES) db.exec(`DELETE FROM ${t}`);
    });
    db.exec("VACUUM");
    console.log("   ✓ хуучин дата цэвэрлэв");
  }

  // --- 2. Global defaults --------------------------------------------------
  updateGlobalDefaults(db, {
    mode: "auto",
    reviewPeriodDays: 1,
    leadTimeDays: 1,
    coverDays: 3,
    serviceLevel: 0.95,
    autoSubmitMaxAmount: AUTO_SUBMIT_MAX_AMOUNT,
  });
  const global = getGlobalDefaults(db);

  // asOf = өчигдөр — UI-ийн `lastNDaysRange` мөн ижилхэн тооцдог.
  const asOf = lastNDaysRange(1).to;
  console.log(`   ✓ asOf = ${asOf}, автомат илгээх дээд дүн = ${AUTO_SUBMIT_MAX_AMOUNT.toLocaleString("mn-MN")}₮`);

  // --- 3. Оператор ---------------------------------------------------------
  const adminId = upsertOperator(db, {
    name: "Ц. Батсайхан",
    email: "admin@gs25.mn",
    role: "admin",
  });
  const primaryId = upsertOperator(db, {
    name: "Б. Ганбат",
    email: "ganbat@gs25.mn",
    role: "operator",
  });
  const secondaryId = upsertOperator(db, {
    name: "Д. Оюунчимэг",
    email: "oyun@gs25.mn",
    role: "operator",
  });

  // --- 4-5. Дэлгүүр бүрийг үүсгэж, симуляцлаад bulk бичих -------------------
  interface SlotResult {
    slot: number;
    storeId: number;
    name: string;
    kind: string;
    items: number;
    metricRows: number;
    orderLines: number;
    touched: number;
    plan: boolean;
    mode: string;
  }
  const results: SlotResult[] = [];

  // Hoisted prepared statement — upsertDailyMetric нь дуудалт бүрт дахин
  // prepare хийдэг тул 78,000 мөрд энэ ялгаа секунд биш минут болно.
  const insMetric = db.prepare(
    `INSERT INTO daily_metrics
       (store_id, item_cd, d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, item_cd, d) DO UPDATE SET
       sold_qty = excluded.sold_qty, sold_amt = excluded.sold_amt,
       on_hand_end = excluded.on_hand_end, waste_qty = excluded.waste_qty,
       delivered_qty = excluded.delivered_qty, stockout_flag = excluded.stockout_flag`,
  );
  const insOrder = db.prepare(
    `INSERT INTO orders (store_id, status, mode, order_date, total_qty, total_amount,
                         created_at, submitted_at, submitted_by, sink_type, external_ref)
     VALUES (?, 'submitted', ?, ?, ?, ?, ?, ?, ?, 'sms-sim', ?)`,
  );
  const insLine = db.prepare(
    `INSERT INTO order_lines
       (order_id, item_cd, name, category_key, category_nm, price,
        suggested_qty, final_qty, decided_by, config_snapshot, factors_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  );
  const insIngestion = db.prepare(
    `INSERT INTO ingestion_runs (store_id, started_at, finished_at, status, datasets, rows, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const updItemCatalog = db.prepare(
    `UPDATE items SET order_multiple = ?, shelf_life_days = ?, perishable = ?
      WHERE store_id = ? AND item_cd = ?`,
  );

  for (const branch of DEMO_BRANCHES) {
    const a = ARCHETYPE_PLAN[branch.slot];
    if (!a) throw new Error(`slot ${branch.slot}-д архетип алга`);

    const storeId = upsertStore(db, {
      ip: branch.ip,
      bizplCd: `V${branch.code}`,
      code: branch.code,
      name: branch.name,
      lat: branch.lat,
      lng: branch.lng,
    });

    assignStore(db, adminId, storeId);
    assignStore(db, primaryId, storeId);
    if (branch.slot % 3 === 0) assignStore(db, secondaryId, storeId);

    // --- Барааны сонголт ---
    // Ангилал ТУС БҮРД доод хязгаар (MIN_PER_CATEGORY) баталгаажуулна. Ингэхгүй
    // бол дэлгүүр цөм бус ангиллаас 1-2 бараа л авч, board-ын ангиллын verdict
    // нь `minCategoryItems`-ээс унаад "Дата дутуу" болно — heat grid-ийн тал нь
    // "?" болж, drill-down хийх юмгүй болно.
    const pickRng = streamFor(branch.slot, 9999);
    const byCategory = new Map<string, typeof DEMO_SKUS[number][]>();
    for (const s of DEMO_SKUS) {
      const list = byCategory.get(s.mclsCd);
      if (list) list.push(s);
      else byCategory.set(s.mclsCd, [s]);
    }

    const picked = new Set<string>();
    const chosenList: typeof DEMO_SKUS[number][] = [];
    for (const [cd, list] of byCategory) {
      // Цөм ангилалд илүү өргөн, бусдад доод хязгаар
      const floor = CORE_CATEGORIES.includes(cd) ? MIN_CORE_CATEGORY : MIN_PER_CATEGORY;
      for (const s of sample(pickRng, list, Math.min(floor, list.length))) {
        if (!picked.has(s.itemCd)) {
          picked.add(s.itemCd);
          chosenList.push(s);
        }
      }
    }
    // Үлдсэн квотыг бүх ангиллаас нэмж дүүргэнэ — дэлгүүрүүд ижилхэн болохгүй
    const leftover = DEMO_SKUS.filter((s) => !picked.has(s.itemCd));
    for (const s of sample(pickRng, leftover, Math.max(0, branch.skuCount - chosenList.length))) {
      chosenList.push(s);
    }
    const chosen = chosenList.sort((x, y) => x.itemCd.localeCompare(y.itemCd));

    const sim = simulateStore({
      branch,
      archetype: a,
      skus: chosen,
      global,
      asOf,
      engineDays: ENGINE_DAYS,
      orderHistoryDays: ORDER_HISTORY_DAYS,
    });

    tx(db, () => {
      // Каталог. upsertItem нь order_multiple/shelf_life_days/perishable-ыг
      // БИЧДЭГГҮЙ (ingest-ийн зориудын шийдвэр) — тусад нь тавина, эс тэгвэл
      // orderMultiple бүгд 1 болж, replenish()-ийн shelf-life cap унтарна.
      for (const it of sim.items) {
        upsertItem(db, {
          storeId,
          itemCd: it.itemCd,
          name: it.name,
          mclsCd: it.mclsCd,
          mclsNm: it.mclsNm,
          sclsCd: it.sclsCd,
          sclsNm: it.sclsNm,
          price: it.price,
        });
        updItemCatalog.run(
          it.orderMultiple,
          it.shelfLifeDays,
          it.perishable ? 1 : 0,
          storeId,
          it.itemCd,
        );
      }

      setStoreConfig(db, storeId, {
        mode: a.mode,
        serviceLevel: a.serviceLevel,
        coverDays: a.coverDays,
      });

      for (const [itemCd, days] of sim.metrics) {
        for (const day of days) {
          if (!day.emit) continue;
          insMetric.run(
            storeId,
            itemCd,
            day.d,
            day.soldQty,
            day.soldAmt,
            day.onHandEnd,
            day.wasteQty,
            day.deliveredQty,
            day.stockoutFlag ? 1 : 0,
          );
        }
      }

      const soldByDay = new Map<string, { qty: number; amt: number }>();
      for (const [, days] of sim.metrics) {
        for (const day of days) {
          if (!day.emit) continue;
          const cur = soldByDay.get(day.d) ?? { qty: 0, amt: 0 };
          cur.qty += day.soldQty;
          cur.amt += day.soldAmt;
          soldByDay.set(day.d, cur);
        }
      }
      upsertTxHourly(
        db,
        storeId,
        synthesizeHourlyTx(branch.slot, soldByDay, branch.sizeFactor),
      );

      // ⚠️ Офлайн дэлгүүрт ЯМАР Ч захиалга бичихгүй. `fleetSummary` нь
      // `!order && staleOrOffline` үед л offline гэж үзэх ба `getLatestOrder`
      // нь ORDER BY id DESC (огноогоор БИШ) — нэг ч түүхэн захиалга байхад
      // статус нь чимээгүйхэн healthy болж, сааралт pin алга болно.
      const ordersToWrite = a.plan ? sim.orders : [];
      for (const ord of ordersToWrite) {
        let qty = 0;
        let amount = 0;
        for (const l of ord.lines) {
          qty += l.finalQty;
          amount += l.finalQty * l.price;
        }
        const createdAt = `${isoDate(ord.d)} 08:40:00`;
        const submittedAt = `${isoDate(ord.d)} 09:15:00`;
        const res = insOrder.run(
          storeId,
          a.mode,
          ord.d,
          qty,
          amount,
          createdAt,
          submittedAt,
          a.mode === "auto" ? "auto" : "operator",
          `SIM-${ord.d}-${storeId}`,
        );
        const orderId = Number(res.lastInsertRowid);
        for (const l of ord.lines) {
          insLine.run(
            orderId,
            l.itemCd,
            l.name,
            l.categoryKey,
            l.categoryNm,
            l.price,
            l.suggestedQty,
            l.finalQty,
            l.decidedBy,
            JSON.stringify(l.factors),
          );
        }
      }

      // Синк ба ingestion бүртгэл. startIngestionRun/finishIngestionRun нь
      // `datetime('now')`-ыг хатуу бичдэг тул буцаасан цагтай мөр хийхэд
      // raw SQL хэрэгтэй (зөвхөн seed-ийн хэрэгцээ — repo-г өргөтгөхгүй).
      const syncAt = new Date(Date.now() - a.lastSyncHoursAgo * 3600_000);
      setStoreLastSync(db, storeId, syncAt.toISOString());
      const startedAt = new Date(syncAt.getTime() - 90_000).toISOString();
      insIngestion.run(
        storeId,
        startedAt,
        syncAt.toISOString(),
        a.ingestionStatus,
        a.ingestionStatus === "ok"
          ? JSON.stringify({ sales: true, stock: true, waste: true, delivery: true, tx: true })
          : null,
        a.ingestionStatus === "ok" ? sim.stats.metricRows : 0,
        a.ingestionStatus === "ok" ? null : "POS холболт тасарсан (timeout 30с)",
      );
    });

    results.push({
      slot: branch.slot,
      storeId,
      name: branch.name,
      kind: a.kind,
      items: sim.items.length,
      metricRows: sim.stats.metricRows,
      orderLines: sim.stats.orderLines,
      touched: sim.stats.touchedLines,
      plan: a.plan,
      mode: a.mode,
    });

    process.stdout.write(
      `   · slot ${String(branch.slot).padStart(2)} ${branch.name.padEnd(30)} ` +
        `${String(sim.items.length).padStart(3)} бараа  ` +
        `${String(sim.stats.metricRows).padStart(5)} мөр  ` +
        `${String(sim.stats.orderLines).padStart(5)} захиалгын мөр\n`,
    );
  }

  // --- 6. Өнөөдрийн төлөвлөгөө (planStore тус бүр өөрийн tx-тэй) ------------
  console.log("\n   → Өнөөдрийн захиалга төлөвлөж байна…");
  const planned: { storeId: number; orderId: number; mode: string; name: string }[] = [];
  for (const r of results) {
    if (!r.plan) continue;
    const res = planStore(db, r.storeId, { asOf });
    if (res.orderId != null) {
      planned.push({ storeId: r.storeId, orderId: res.orderId, mode: res.storeMode, name: r.name });
    }
  }
  console.log(`   ✓ ${planned.length} дэлгүүрт захиалга үүслээ`);

  // --- 7. Автомат горимынхыг SMS-ээр илгээх --------------------------------
  let submitted = 0;
  for (const p of planned) {
    if (p.mode !== "auto") continue;
    const res = await submitOrder(db, p.orderId, "auto");
    if (res.ok) submitted++;
  }
  console.log(`   ✓ ${submitted} захиалга автоматаар SMS-ээр илгээгдэв`);

  // --- 7b. Түүхэн SMS outbox (сүүлийн 7 хоног) -----------------------------
  // 30 хоног бол ~1,600 мөр шуугиан болно; 7 хоног нь консолыг "амьд" харагдуулж,
  // уншигдахуйц хэвээр байлгана.
  const outboxFrom = addDays(asOf, -(OUTBOX_HISTORY_DAYS + 1));
  let outboxRows = 0;
  const histOrders = db
    .prepare(
      `SELECT id, store_id, order_date FROM orders
        WHERE order_date >= ? AND external_ref LIKE 'SIM-%'
        ORDER BY id`,
    )
    .all(outboxFrom) as unknown as { id: number; store_id: number; order_date: string }[];
  for (const h of histOrders) {
    const order = getOrder(db, Number(h.id));
    const store = getStore(db, Number(h.store_id));
    if (!order || !store) continue;
    const messages = composeMessages(order, store);
    messages.forEach((m, i) => {
      addOutboxMessage(db, {
        orderId: order.id,
        storeId: store.id,
        toNumber: m.toNumber,
        segments: m.segments,
        body: m.body,
        status: "delivered",
        gatewayRef: `SIM-${h.order_date}-${order.id}-${i + 1}`,
        deliveredAt: `${isoDate(h.order_date)} 09:15:0${Math.min(9, i)}`,
      });
      outboxRows++;
    });
  }
  console.log(`   ✓ ${outboxRows} түүхэн SMS мессеж бүртгэв`);

  // --- 8. Хуваарь ----------------------------------------------------------
  const now = new Date();
  const lastRun = new Date(now);
  lastRun.setHours(9, 0, 0, 0);
  updateSchedule(db, {
    enabled: true,
    timeOfDay: "09:00",
    autoSubmit: true,
    lastRunAt: lastRun.toISOString(),
    nextRunAt: computeNextRun("09:00", now),
  });

  // --- 9. Хураангуй --------------------------------------------------------
  const count = (sql: string): number =>
    Number((db.prepare(sql).get() as { c: number }).c);

  // Board-ыг ҮНЭХЭЭР тооцоолж, ГАРСАН verdict-ыг хэвлэнэ (хүлээснийг биш).
  // Ингэснээр хураангуй ба дэлгэц хэзээ ч зөрөхгүй — seed нь өөрөө шалгагч
  // болно. Архетип нь тохиргоо л зааж байгаа тул зарим дэлгүүр хил дээр
  // унаж, хүлээснээс өөр verdict авч болно — тэр нь датаны ҮНЭН уншилт.
  const board = buildDecisionBoard(db, null, { asOf });
  const verdictOf = new Map(board.stores.map((s) => [s.storeId, s.verdictInfo] as const));

  console.log("\n┌─ Демо флот ────────────────────────────────────────────────────────────────────┐");
  console.log(
    "  " + "slot".padEnd(5) + "Дэлгүүр".padEnd(30) + "Архетип".padEnd(30) +
      "Горим".padEnd(7) + "Гараар".padEnd(8) + "Хүлээсэн".padEnd(15) + "ГАРСАН",
  );
  for (const r of results) {
    const touchPct = r.orderLines > 0 ? pct(r.touched / r.orderLines) : "—";
    const vi = verdictOf.get(r.storeId);
    const expected = EXPECTED_VERDICT[r.kind as keyof typeof EXPECTED_VERDICT];
    const actual = vi
      ? vi.verdict + (vi.direction ? (vi.direction === "up" ? "↑" : "↓") : "")
      : "?";
    const match = expected.startsWith(actual.replace(/[↑↓]/g, "")) ? "" : "  ⚠";
    console.log(
      "  " +
        String(r.slot).padEnd(5) +
        r.name.slice(0, 29).padEnd(30) +
        ARCHETYPE_LABEL[r.kind as keyof typeof ARCHETYPE_LABEL].padEnd(30) +
        (r.mode === "auto" ? "АВТО" : "ГАР").padEnd(7) +
        touchPct.padEnd(8) +
        expected.padEnd(15) +
        actual +
        match,
    );
  }
  console.log("└────────────────────────────────────────────────────────────────────────────────┘");
  const byVerdict = board.totals.byVerdict;
  console.log(
    `  Шийдвэрийн хуваарилалт:  ` +
      Object.entries(byVerdict)
        .map(([k, v]) => `${k}=${v}`)
        .join("  "),
  );

  const openAlerts = count("SELECT COUNT(*) AS c FROM alerts WHERE resolved_at IS NULL");
  console.log(`
  Дэлгүүр            ${count("SELECT COUNT(*) AS c FROM stores")}
  Оператор           ${count("SELECT COUNT(*) AS c FROM operators")} (хуваарилалт ${count("SELECT COUNT(*) AS c FROM operator_stores")})
  Бараа              ${count("SELECT COUNT(*) AS c FROM items").toLocaleString("mn-MN")}
  daily_metrics      ${count("SELECT COUNT(*) AS c FROM daily_metrics").toLocaleString("mn-MN")}
  Захиалга           ${count("SELECT COUNT(*) AS c FROM orders").toLocaleString("mn-MN")}
  Захиалгын мөр      ${count("SELECT COUNT(*) AS c FROM order_lines").toLocaleString("mn-MN")}
  SMS outbox         ${count("SELECT COUNT(*) AS c FROM sms_outbox").toLocaleString("mn-MN")}
  Нээлттэй дохио     ${openAlerts}${openAlerts > 60 ? "  ⚠️ их байна — archetype.lowConfidenceItems-ыг бууруулна уу" : ""}

  ⏱  ${((Date.now() - started) / 1000).toFixed(1)} сек`);

  console.log(`
  Дараагийн алхам:
    1) .env.local-д:  REPLENISH_DB_PATH=${dbPath.includes(" ") ? `"${dbPath.replace(/\\/g, "/")}"` : "data/demo.db"}
                      NEXT_PUBLIC_DEMO_MODE=1
    2) npm run dev  — ЗААВАЛ хүйтэн эхлүүлэх (HMR-ээр DB зам солигдохгүй)
`);

  db.close();
}

function isoDate(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

main().catch((e) => {
  console.error("\n❌ Seed амжилтгүй:", e);
  process.exit(1);
});
