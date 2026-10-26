/**
 * Decision Board smoke — verdict-ийн босгыг ЦООЖИЛНО.
 * Ажиллуулах: npx tsx scripts/smoke-board.ts
 *
 * Синтетик 3 дэлгүүр дээр MANUAL / TUNE(up) / DATA гарахыг батална. Board UI
 * эдгээр босгыг хэрэглэж эхлэхээс өмнө энэ тест унах ёстой — тэгвэл дараа нь
 * босго "чимээгүйхэн" гулсахгүй.
 */
import { openTestDb, tx } from "../lib/db/index";
import { upsertStore } from "../lib/db/repositories/stores";
import {
  setStoreConfig,
  updateGlobalDefaults,
  upsertItem,
} from "../lib/db/repositories/config";
import { buildDecisionBoard, decideVerdict, BOARD_THRESHOLDS } from "../lib/replenish/board";
import type { BoardMetrics } from "../lib/replenish/board";
import { addDays, dowOf } from "../lib/engine/util";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

const db = openTestDb();
const ASOF = "20260729";
const DAYS = 90;

updateGlobalDefaults(db, {
  mode: "auto",
  reviewPeriodDays: 1,
  leadTimeDays: 1,
  coverDays: 3,
  serviceLevel: 0.95,
  autoSubmitMaxAmount: 3_000_000,
});

const insMetric = db.prepare(
  `INSERT INTO daily_metrics (store_id, item_cd, d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const insOrder = db.prepare(
  `INSERT INTO orders (store_id, status, mode, order_date, total_qty, total_amount)
   VALUES (?, 'submitted', ?, ?, 0, 0)`,
);
const insLine = db.prepare(
  `INSERT INTO order_lines (order_id, item_cd, name, category_key, category_nm, price,
                            suggested_qty, final_qty, decided_by, config_snapshot, factors_snapshot)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
);

interface Spec {
  name: string;
  ip: string;
  historyDays: number;
  mu: number;
  /** Engine-ийн системтэй алдааны хэмжээ (μ-ийн үржвэр) */
  suggestBias: number;
  /** Оператор саналыг ideal руу хэр зөв зөөх (0..1) */
  skill: number;
  /**
   * Engine-ийн алдаа НЭГ ЧИГТ (true) үү, эсвэл ээлжлэн хоёр тийш (false) юу.
   * Оператор алдааг засдаг тул ЭНЭ нь `biasConsistency`-г тодорхойлно:
   *   нэг чигт алдаа → нэг талын засвар → TUNE
   *   ээлжлэх алдаа → хоёр талын засвар → MANUAL
   */
  oneSided: boolean;
  overrideRate: number;
  /** stockout үүсгэх өдрийн хувь */
  stockoutRate: number;
  serviceLevel: number | null;
}

function seedStore(spec: Spec): number {
  const storeId = upsertStore(db, { ip: spec.ip, name: spec.name, code: spec.ip });
  setStoreConfig(db, storeId, { mode: "auto", serviceLevel: spec.serviceLevel, coverDays: null });

  const ITEMS = 8;
  const PRICE = 2000;
  const P = 2;

  tx(db, () => {
    for (let i = 0; i < ITEMS; i++) {
      const itemCd = `900${i}`;
      upsertItem(db, {
        storeId, itemCd, name: `Бараа ${i}`,
        mclsCd: "10", mclsNm: "Тест ангилал",
        sclsCd: "1001", sclsNm: "Дэд", price: PRICE,
      });

      const start = addDays(ASOF, -(spec.historyDays - 1));
      const sold: Record<string, number> = {};
      for (let k = 0; k < spec.historyDays; k++) {
        const d = addDays(start, k);
        // Детерминистик "шуугиан" — Math.random ашиглахгүй, тест давтагдана
        const wobble = 1 + 0.18 * Math.sin((k + i * 3) * 1.7);
        const dowF = dowOf(d) === 0 || dowOf(d) === 6 ? 1.2 : 0.95;
        const q = Math.max(0, Math.round(spec.mu * wobble * dowF));
        const stockout = spec.stockoutRate > 0 && (k + i) % Math.round(1 / spec.stockoutRate) === 0;
        sold[d] = q;
        insMetric.run(
          storeId, itemCd, d,
          stockout ? Math.max(0, q - Math.ceil(spec.mu * 0.6)) : q,
          (stockout ? Math.max(0, q - Math.ceil(spec.mu * 0.6)) : q) * PRICE,
          stockout ? 0 : Math.round(spec.mu * 2),
          0, Math.round(spec.mu), stockout ? 1 : 0,
        );
      }

      // Захиалгын түүх — сүүлийн 30 хоног
      for (let k = 30; k >= 2; k--) {
        const d = addDays(ASOF, -k);
        const ip = Math.round(spec.mu * 1.5);
        // Ирэх P хоногийн бодит эрэлт
        let realized = 0;
        for (let j = 1; j <= P; j++) realized += sold[addDays(d, j)] ?? spec.mu;

        const ideal = Math.max(0, realized - ip);
        // Engine-ийн алдааны чиг: нэг талын архетипт үргэлж дутуу, харин
        // хоёр талынхад ээлжилнэ.
        const errSign = spec.oneSided ? -1 : (k + i) % 2 === 0 ? 1 : -1;
        const suggested = Math.max(
          0,
          Math.round(ideal + errSign * spec.suggestBias * spec.mu),
        );

        const touch = (k + i) % Math.round(1 / spec.overrideRate) === 0;
        let finalQty = suggested;
        if (touch) {
          // Оператор саналыг ideal руу татна → засварын чиг нь алдааны эсрэг
          const target = spec.skill * ideal + (1 - spec.skill) * suggested;
          finalQty = Math.max(0, Math.round(target));
          if (finalQty === suggested) finalQty = Math.max(0, suggested - errSign);
        }

        const res = insOrder.run(storeId, "auto", d);
        const orderId = Number(res.lastInsertRowid);
        insLine.run(
          orderId, itemCd, `Бараа ${i}`, "10", "Тест ангилал", PRICE,
          suggested, Math.max(0, finalQty), touch ? "manual" : "auto",
          JSON.stringify({ protectionDays: P, inventoryPosition: ip }),
        );
      }
    }
  });

  db.prepare("UPDATE stores SET last_sync_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    storeId,
  );
  return storeId;
}

// 1) MANUAL — оператор хоёр талдаа зөв зөөж байна
const manualId = seedStore({
  name: "Гараар үнэ цэнэ", ip: "10.0.0.1", historyDays: DAYS, mu: 12,
  suggestBias: 1.4, skill: 0.95, oneSided: false, overrideRate: 0.4,
  stockoutRate: 0, serviceLevel: null,
});

// 2) TUNE — оператор зөв, гэхдээ ҮРГЭЛЖ нэг чигт (параметр буруу гэсэн үг)
const tuneId = seedStore({
  name: "Нэг талын өөрчлөлт", ip: "10.0.0.2", historyDays: DAYS, mu: 12,
  suggestBias: 1.6, skill: 0.95, oneSided: true, overrideRate: 0.4,
  stockoutRate: 0, serviceLevel: 0.9,
});

// 3) DATA — түүх богино
const dataId = seedStore({
  name: "Шинэ салбар", ip: "10.0.0.3", historyDays: 14, mu: 6,
  suggestBias: 0, skill: 0.5, oneSided: false, overrideRate: 0.25,
  stockoutRate: 0, serviceLevel: null,
});

const board = buildDecisionBoard(db, null, { asOf: ASOF });
const byId = new Map(board.stores.map((s) => [s.storeId, s] as const));

const manual = byId.get(manualId)!;
const tune = byId.get(tuneId)!;
const data = byId.get(dataId)!;

for (const s of [manual, tune, data]) {
  console.log(
    `  ${s.name.padEnd(22)} ${s.verdictInfo.verdict.padEnd(8)} ` +
      `ovR=${(s.metrics.overrideRate * 100).toFixed(0)}% ` +
      `acc=${(s.metrics.overrideAccuracy * 100).toFixed(0)}% ` +
      `bias=${(s.metrics.biasConsistency * 100).toFixed(0)}% ` +
      `hist=${s.metrics.historyDays}`,
  );
}

assert(data.verdictInfo.verdict === "DATA", `Шинэ салбар DATA байх ёстой, гарсан: ${data.verdictInfo.verdict}`);
assert(data.metrics.historyDays < BOARD_THRESHOLDS.minHistoryDays, "Богино түүх минимумаас доогуур байх ёстой");

assert(
  manual.metrics.overrideAccuracy >= BOARD_THRESHOLDS.accuracyManual,
  `MANUAL нарийвчлал ≥ ${BOARD_THRESHOLDS.accuracyManual} байх ёстой, гарсан: ${manual.metrics.overrideAccuracy.toFixed(2)}`,
);
assert(
  manual.metrics.biasConsistency < BOARD_THRESHOLDS.biasOneSided,
  `MANUAL нь ХОЁР ТАЛЫН байх ёстой, bias=${manual.metrics.biasConsistency.toFixed(2)}`,
);
assert(manual.verdictInfo.verdict === "MANUAL", `MANUAL хүлээсэн, гарсан: ${manual.verdictInfo.verdict}`);

assert(
  tune.metrics.biasConsistency >= BOARD_THRESHOLDS.biasOneSided,
  `TUNE нь НЭГ ТАЛЫН байх ёстой, bias=${tune.metrics.biasConsistency.toFixed(2)}`,
);
assert(tune.verdictInfo.verdict === "TUNE", `TUNE хүлээсэн, гарсан: ${tune.verdictInfo.verdict}`);
assert(tune.verdictInfo.action?.kind === "tune", "TUNE нь tune action-тай байх ёстой");
assert(
  tune.verdictInfo.action?.param === "serviceLevel" && typeof tune.verdictInfo.action?.to === "number",
  "tune action нь /api/tune-д POST хийхэд бэлэн байх ёстой",
);

// --- decideVerdict-ийн цэвэр (pure) шалгалт ---
const base: BoardMetrics = {
  items: 30, itemsSkipped: 0, historyDays: 90, demand: 5000, gmv: 10_000_000,
  serviceRate: 0.99, fillRate: 0.99, overstockRatio: 0.1, wasteRatio: 0.01,
  wasteMnt: 0, overstockMnt: 0, lostMnt: 0, avgConfidence: 0.8,
  regimeShare: 0, regimeRatio: 1,
  orderLines: 100, touchRate: 0.02, overrideRate: 0.02, overrideSamples: 2,
  overrideAccuracy: 0.5, overrideValueMnt: 0, overrideBias: 0, biasConsistency: 0,
  autoMae: 3, manualMae: 3,
};
const cfg = { serviceLevel: 0.95, coverDays: 3 };

const okAuto = decideVerdict({
  metrics: base, mode: "auto", offline: false, scope: "store", scopeKey: null, config: cfg, label: "x",
});
assert(okAuto.verdict === "AUTO_OK", `Эрүүл дэлгүүр AUTO_OK байх ёстой, гарсан: ${okAuto.verdict}`);
assert(okAuto.action === null, "AUTO_OK + auto горим нь action-гүй байх ёстой");

const manualUpsell = decideVerdict({
  metrics: base, mode: "manual", offline: false, scope: "store", scopeKey: null, config: cfg, label: "x",
});
assert(
  manualUpsell.action?.kind === "switch_mode",
  "Гар горимтой эрүүл дэлгүүрт 'Автомат болгох' санал гарах ёстой",
);

const offline = decideVerdict({
  metrics: base, mode: "auto", offline: true, scope: "store", scopeKey: null, config: cfg, label: "x",
});
assert(offline.verdict === "DATA", "Офлайн дэлгүүр DATA байх ёстой");

const overstocked = decideVerdict({
  metrics: { ...base, overstockRatio: 0.9 },
  mode: "auto", offline: false, scope: "store", scopeKey: null, config: cfg, label: "x",
});
assert(overstocked.verdict === "TUNE" && overstocked.direction === "down",
  `Илүүдэлтэй дэлгүүр TUNE↓ байх ёстой, гарсан: ${overstocked.verdict}/${overstocked.direction}`);

const starved = decideVerdict({
  metrics: { ...base, serviceRate: 0.85, fillRate: 0.85 },
  mode: "auto", offline: false, scope: "store", scopeKey: null, config: cfg, label: "x",
});
assert(starved.verdict === "TUNE" && starved.direction === "up",
  `Нөөц дутуу дэлгүүр TUNE↑ байх ёстой, гарсан: ${starved.verdict}/${starved.direction}`);

// Trend болон totals
assert(board.trend.length > 0, "Trend цуваа хоосон байж болохгүй");
assert(board.trend.every((t) => t.fillRate >= 0 && t.fillRate <= 1), "fillRate 0..1 хооронд байх ёстой");
assert(board.totals.stores === 3, "3 дэлгүүр байх ёстой");
assert(
  board.totals.byVerdict.MANUAL + board.totals.byVerdict.TUNE + board.totals.byVerdict.DATA === 3,
  "Гурвуулаа MANUAL/TUNE/DATA-д хуваарилагдах ёстой",
);
assert(board.stores.every((s) => s.categories.length > 0), "Дэлгүүр бүр ангилалтай байх ёстой");

console.log("\n✅ smoke-board OK");
db.close();
