/**
 * P2 engine smoke: seasonality + backtest + health + autotune.
 * Ажиллуулах: npx tsx scripts/smoke-p2.ts
 */
import {
  backtestItem,
  computeHealth,
  computeSeasonality,
  detectRegimeChange,
  recommendTuning,
} from "../lib/engine";
import type { DailyPoint } from "../lib/engine/types";
import type { EffectiveConfig } from "../lib/config/types";
import { addDays } from "../lib/engine/util";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

// Гараг хамааралтай эрэлт: амралтын өдөр (Бям=6, Ням=0) их
function dowSeries(start: string, days: number, weekday: number, weekend: number): DailyPoint[] {
  const out: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const dow = new Date(
      Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)),
    ).getUTCDay();
    const q = dow === 0 || dow === 6 ? weekend : weekday;
    out.push({ d, soldQty: q, stockout: false });
  }
  return out;
}

const config: EffectiveConfig = {
  mode: "manual",
  reviewPeriodDays: 1,
  leadTimeDays: 2,
  coverDays: 3,
  serviceLevel: 0.95,
  orderMultiple: 1,
  minQty: null,
  maxQty: null,
  shelfLifeDays: null,
  perishable: false,
  autoSubmitMaxAmount: null,
};

// --- Seasonality: амралтын өдрийн multiplier > 1 ---
{
  const pts = dowSeries("20260501", 56, 5, 12); // ажлын өдөр 5, амралт 12
  const prof = computeSeasonality(pts);
  const sat = prof.dow.find((b) => b.bucket === 6)!;
  const mon = prof.dow.find((b) => b.bucket === 1)!;
  assert(sat.multiplier > 1.2, `Бямба multiplier > 1.2 got ${sat.multiplier}`);
  assert(mon.multiplier < 1, `Даваа multiplier < 1 got ${mon.multiplier}`);
}

// --- Regime change: сүүлийн 14 хоног эрэлт 2 дахин өссөн ---
{
  const older = dowSeries("20260501", 42, 5, 5); // тогтмол 5
  const recent = dowSeries(addDays("20260501", 42), 14, 12, 12); // өссөн
  const pts = [...older, ...recent];
  const asOf = pts[pts.length - 1].d;
  const rc = detectRegimeChange(pts, asOf);
  assert(rc.changed && rc.ratio > 1.5, `regime өсөлт илрэх ёстой ratio=${rc.ratio}`);
}

// --- Backtest: engine baseline-аас муугүй байх (fill rate) ---
{
  const pts = dowSeries("20260401", 84, 4, 14); // хүчтэй гараг хамаарал
  const bt = backtestItem(pts, config, { itemCd: "T", price: 1000 });
  assert(bt.evaluatedPeriods > 30, `үнэлсэн үе > 30 got ${bt.evaluatedPeriods}`);
  // Engine нь DOW-г тооцдог тул baseline-аас fill rate тэнцүү буюу дээгүүр
  assert(
    bt.engine.fillRate >= bt.baseline.fillRate - 0.001,
    `engine fill ${bt.engine.fillRate} >= baseline ${bt.baseline.fillRate}`,
  );
  assert(bt.engine.cycleServiceLevel >= 0 && bt.engine.cycleServiceLevel <= 1, "service 0..1");
}

// --- Health ---
{
  const pts = dowSeries("20260401", 84, 4, 14);
  const bt = backtestItem(pts, config, { itemCd: "T", price: 1000 });
  const h = computeHealth({ backtest: bt, confidence: 0.8, perishable: false });
  assert(h.score >= 0 && h.score <= 100, `score 0..100 got ${h.score}`);
  assert(["good", "watch", "poor"].includes(h.grade), "grade зөв");
}

// --- Auto-tune: доогуур үйлчилгээтэй үед serviceLevel нэмэхийг санал болгоно ---
{
  // Маш хэлбэлзэлтэй эрэлт → engine ихэвчлэн дутуу таамаглана
  const pts: DailyPoint[] = [];
  for (let i = 0; i < 60; i++) {
    const d = addDays("20260401", i);
    // Спайктай: 3 өдөр тутам огцом
    const q = i % 3 === 0 ? 30 : 2;
    pts.push({ d, soldQty: q, stockout: false });
  }
  const bt = backtestItem(pts, { ...config, serviceLevel: 0.8 }, { price: 1000 });
  const recs = recommendTuning({ backtest: bt, config: { ...config, serviceLevel: 0.8 } });
  // Зөвлөмж массив (хоосон ч байж болно) — бүтэц зөв эсэхийг шалгана
  assert(Array.isArray(recs), "recs массив");
  for (const r of recs) {
    assert(["serviceLevel", "coverDays"].includes(r.param), "param зөв");
    assert(typeof r.reason === "string" && r.reason.length > 0, "reason байна");
  }
}

console.log("smoke-p2: OK");
