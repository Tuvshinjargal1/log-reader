/**
 * P3 smoke: SMS симуляц sink + outbox + бүтэн мөчлөг + хуваарь.
 * Ажиллуулах: npx tsx scripts/smoke-p3.ts
 */
import { openTestDb } from "../lib/db/index";
import { upsertStore } from "../lib/db/repositories/stores";
import { upsertItem, setStoreConfig } from "../lib/db/repositories/config";
import { upsertDailyMetric, applyDailyExtras } from "../lib/db/repositories/metrics";
import { getLatestOrder } from "../lib/db/repositories/orders";
import { listStoreOutbox, listRecentOutbox } from "../lib/db/repositories/outbox";
import { getSchedule, updateSchedule, computeNextRun } from "../lib/db/repositories/schedule";
import { smsSegments, composeMessages } from "../lib/ordering/smsSink";
import { submitOrder } from "../lib/ordering/submit";
import { planStore } from "../lib/replenish/planStore";
import { runFullCycle } from "../lib/replenish/cycle";
import { addDays } from "../lib/engine/util";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

async function main() {
  const db = openTestDb();

  // --- SMS segment тооцоо ---
  assert(smsSegments("SHORT ASCII") === 1, "богино ASCII = 1 segment");
  assert(smsSegments("Кирилл богино") === 1, "богино кирилл = 1 segment");
  const longCyr = "Кирилл ".repeat(20); // ~140 тэмдэгт
  assert(smsSegments(longCyr) >= 2, `урт кирилл олон segment got ${smsSegments(longCyr)}`);

  const storeId = upsertStore(db, { ip: "10.0.0.60", bizplCd: "V0600", code: "600", name: "SMS тест" });
  upsertItem(db, { storeId, itemCd: "COLA", name: "Кола", mclsCd: "BEV", mclsNm: "Ундаа", price: 2500 });
  upsertItem(db, { storeId, itemCd: "WATER", name: "Ус", mclsCd: "BEV", mclsNm: "Ундаа", price: 1200 });

  const asOf = "20260629";
  for (let i = 27; i >= 0; i--) {
    const d = addDays(asOf, -i);
    upsertDailyMetric(db, { storeId, itemCd: "COLA", d, soldQty: 5, soldAmt: 12500 });
    upsertDailyMetric(db, { storeId, itemCd: "WATER", d, soldQty: 4, soldAmt: 4800 });
  }
  applyDailyExtras(db, { storeId, itemCd: "COLA", d: asOf, onHandEnd: 0 });
  applyDailyExtras(db, { storeId, itemCd: "WATER", d: asOf, onHandEnd: 0 });

  // --- Гараар: plan → submit → outbox шалгах ---
  setStoreConfig(db, storeId, { mode: "manual" });
  const plan = planStore(db, storeId, { asOf });
  assert(plan.orderId != null, "захиалга үүссэн");

  const order = getLatestOrder(db, storeId)!;
  const msgs = composeMessages(order, { id: storeId, ip: "10.0.0.60", bizplCd: "V0600", code: "600", name: "SMS тест", lat: null, lng: null, enabled: true, lastSyncAt: null });
  assert(msgs.length >= 1 && msgs[0].body.includes("GS25"), "SMS body бүрдсэн");

  const res = await submitOrder(db, plan.orderId!, "operator");
  assert(res.ok && res.sinkType === "sms-sim", `sms sink амжилттай got ${res.sinkType}`);
  assert(res.externalRef?.startsWith("SMS-"), "gateway ref SMS-");

  const outbox = listStoreOutbox(db, storeId);
  assert(outbox.length >= 1, "outbox мессеж бичигдсэн");
  assert(outbox[0].status === "delivered", `хүргэгдсэн төлөв got ${outbox[0].status}`);
  assert(outbox[0].deliveredAt != null, "delivered_at бичигдсэн");
  assert(outbox[0].toNumber === "1348", "захиалгын төвийн дугаар");

  // --- Автомат горим + бүтэн мөчлөг ---
  setStoreConfig(db, storeId, { mode: "auto" });
  const cycle = await runFullCycle(db, { asOf, autoSubmit: true });
  assert(cycle.planned >= 1, "мөчлөг төлөвлөсөн");
  assert(cycle.submitted >= 1, `автомат илгээсэн got ${cycle.submitted}`);

  const allOut = listRecentOutbox(db);
  assert(allOut.length >= 2, "нийт outbox нэмэгдсэн");

  // --- Хуваарь ---
  updateSchedule(db, { enabled: true, timeOfDay: "09:30", nextRunAt: computeNextRun("09:30", new Date("2026-06-29T10:00:00")) });
  const sched = getSchedule(db);
  assert(sched.enabled && sched.timeOfDay === "09:30", "хуваарь шинэчлэгдсэн");
  assert(sched.nextRunAt != null, "next run тооцсон");
  assert(sched.lastRunAt != null, "мөчлөг ажилласан тул last run бичигдсэн");

  console.log("smoke-p3: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
