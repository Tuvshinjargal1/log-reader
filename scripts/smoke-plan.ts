/**
 * P1b integration smoke: metrics → planStore → order → submit.
 * Ажиллуулах: npx tsx scripts/smoke-plan.ts
 */
import { openTestDb } from "../lib/db/index";
import { upsertStore } from "../lib/db/repositories/stores";
import { upsertItem, setStoreConfig } from "../lib/db/repositories/config";
import { upsertDailyMetric, applyDailyExtras } from "../lib/db/repositories/metrics";
import { getLatestOrder } from "../lib/db/repositories/orders";
import { listOpenAlerts } from "../lib/db/repositories/ops";
import { planStore } from "../lib/replenish/planStore";
import { submitOrder } from "../lib/ordering/submit";
import { addDays } from "../lib/engine/util";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

async function main() {
  const db = openTestDb();
  const storeId = upsertStore(db, { ip: "10.0.0.9", bizplCd: "V0777", code: "777", name: "Тест дэлгүүр" });

  upsertItem(db, { storeId, itemCd: "COLA", name: "Кола", mclsCd: "BEV", mclsNm: "Ундаа", price: 2500 });
  upsertItem(db, { storeId, itemCd: "MILK", name: "Сүү", mclsCd: "DAIRY", mclsNm: "Сүүн бүтээгдэхүүн", price: 3000 });

  // 28 хоногийн борлуулалт: COLA ~5/өдөр, MILK ~2/өдөр
  const asOf = "20260629";
  for (let i = 27; i >= 0; i--) {
    const d = addDays(asOf, -i);
    upsertDailyMetric(db, { storeId, itemCd: "COLA", d, soldQty: 5, soldAmt: 12500 });
    upsertDailyMetric(db, { storeId, itemCd: "MILK", d, soldQty: 2, soldAmt: 6000 });
  }
  // Одоогийн нөөц: COLA=0 (stockout эрсдэл), MILK=100 (хэт их)
  applyDailyExtras(db, { storeId, itemCd: "COLA", d: asOf, onHandEnd: 0 });
  applyDailyExtras(db, { storeId, itemCd: "MILK", d: asOf, onHandEnd: 100 });

  // manual горим
  setStoreConfig(db, storeId, { mode: "manual" });

  const plan = planStore(db, storeId, { asOf });
  assert(plan.storeMode === "manual", "store mode manual");
  assert(plan.orderId != null, "захиалга үүссэн");
  assert(plan.lineCount === 1, `зөвхөн COLA захиалагдах ёстой (MILK хэт нөөцтэй) got ${plan.lineCount}`);

  const order = getLatestOrder(db, storeId)!;
  assert(order.status === "proposed", "статус proposed");
  assert(order.lines[0].itemCd === "COLA", "COLA мөр");
  assert(order.lines[0].factorsSnapshot != null, "factor snapshot байгаа");
  const factors = order.lines[0].factorsSnapshot as { protectionDays: number; forecastDemand: number };
  assert(factors.protectionDays === 2, `P=1+1=2 got ${factors.protectionDays}`);

  // stockout_risk дохио гарсан байх ёстой (COLA нөөц 0)
  const alerts = listOpenAlerts(db);
  assert(alerts.some((a) => a.kind === "stockout_risk" && a.itemCd === "COLA"), "COLA stockout дохио");

  // submit → DevSink
  const res = await submitOrder(db, order.id, "tester");
  assert(res.ok && res.sinkType === "sms-sim", `sms sink амжилттай got ${res.sinkType}`);
  assert(res.externalRef?.startsWith("SMS-"), "external ref SMS-");
  const after = getLatestOrder(db, storeId)!;
  assert(after.status === "submitted", "статус submitted");
  assert(after.externalRef === res.externalRef, "external ref хадгалагдсан");

  console.log("smoke-plan: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
