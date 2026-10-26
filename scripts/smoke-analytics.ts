/**
 * P2 integration smoke: analyzeStore (backtest+health+tuning+seasonality) + applyTuning.
 * Ажиллуулах: npx tsx scripts/smoke-analytics.ts
 */
import { openTestDb } from "../lib/db/index";
import { upsertStore } from "../lib/db/repositories/stores";
import { upsertItem, getStoreConfig } from "../lib/db/repositories/config";
import { upsertDailyMetric } from "../lib/db/repositories/metrics";
import { getSeasonality } from "../lib/db/repositories/seasonality";
import { listTuningHistory } from "../lib/db/repositories/tuning";
import { saveSeasonality } from "../lib/db/repositories/seasonality";
import { analyzeStore } from "../lib/replenish/analytics";
import { applyTuning } from "../lib/replenish/applyTuning";
import { addDays } from "../lib/engine/util";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

const db = openTestDb();
const storeId = upsertStore(db, { ip: "10.0.0.50", bizplCd: "V0500", code: "500", name: "Аналитик тест" });

upsertItem(db, { storeId, itemCd: "COLA", name: "Кола", mclsCd: "BEV", mclsNm: "Ундаа", price: 2500 });
upsertItem(db, { storeId, itemCd: "BREAD", name: "Талх", mclsCd: "BAKERY", mclsNm: "Талх нарийн боов", price: 1800 });

// 84 хоног: COLA гараг хамааралтай (амралт их), BREAD тогтмол
const start = "20260401";
for (let i = 0; i < 84; i++) {
  const d = addDays(start, i);
  const dow = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8))).getUTCDay();
  const cola = dow === 0 || dow === 6 ? 16 : 6;
  upsertDailyMetric(db, { storeId, itemCd: "COLA", d, soldQty: cola, soldAmt: cola * 2500 });
  upsertDailyMetric(db, { storeId, itemCd: "BREAD", d, soldQty: 8, soldAmt: 8 * 1800 });
}

const asOf = addDays(start, 83);
const analysis = analyzeStore(db, storeId, { asOf, lookbackDays: 84 });

assert(analysis.items.length === 2, `2 бараа шинжлэгдэх ёстой got ${analysis.items.length}`);
const cola = analysis.items.find((i) => i.itemCd === "COLA")!;
assert(cola.backtest.evaluatedPeriods > 40, `COLA backtest үе > 40 got ${cola.backtest.evaluatedPeriods}`);
assert(
  cola.backtest.engine.fillRate >= cola.backtest.baseline.fillRate - 0.001,
  `engine fill >= baseline (COLA)`,
);
assert(cola.health.score >= 0 && cola.health.score <= 100, "COLA health score хүрээнд");
assert(analysis.kpi.itemsAnalyzed === 2, "KPI 2 бараа");
assert(analysis.kpi.gmv > 0, "GMV > 0");

// Улирлын профайл — амралтын multiplier > ажлын өдрийнх
const sat = analysis.seasonality.dow.find((b) => b.bucket === 6)!;
const tue = analysis.seasonality.dow.find((b) => b.bucket === 2)!;
assert(sat.multiplier > tue.multiplier, `Бямба > Мягмар multiplier (${sat.multiplier} vs ${tue.multiplier})`);

// Хадгалалт
saveSeasonality(db, storeId, analysis.seasonality);
const stored = getSeasonality(db, storeId);
assert(stored.filter((s) => s.scope === "dow").length === 7, "7 dow bucket хадгалагдсан");

// Tuning батлах
const before = getStoreConfig(db, storeId)?.serviceLevel ?? null;
applyTuning(db, {
  storeId,
  scope: "store",
  param: "serviceLevel",
  from: 0.95,
  to: 0.98,
  reason: "тест",
  by: "tester",
});
const after = getStoreConfig(db, storeId)?.serviceLevel;
assert(after === 0.98, `serviceLevel 0.98 болсон got ${after} (өмнө ${before})`);
const hist = listTuningHistory(db, storeId);
assert(hist.length === 1 && hist[0].param === "serviceLevel", "tuning түүх бичигдсэн");

console.log("smoke-analytics: OK");
