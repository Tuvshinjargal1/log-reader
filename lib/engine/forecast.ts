/**
 * Эрэлтийн прогноз — суурь өдрийн эрэлт (μ), σ, гараг (DOW) хүчин зүйл, трэнд,
 * итгэлцэл. Бүх тооцоо PURE — daily_metrics-ийн цуваа дээр ажиллана.
 *
 * Гол зарчим: нөөц дууссан (stockout) өдрийг ХАСНА — тэр өдрийн борлуулалт нь
 * бодит эрэлтийг дутуу харуулдаг (censored demand).
 */
import type { DailyPoint, ForecastResult } from "./types";
import { clamp, daysBetween, dowOf, mean, stdDev } from "./util";

const RECENCY_HALFLIFE_DAYS = 14;
const TREND_LO = 0.7;
const TREND_HI = 1.4;
const DOW_FACTOR_LO = 0.3;
const DOW_FACTOR_HI = 3;

/**
 * @param points өсөх дарааллаар (хуучин→шинэ) daily цэгүүд
 * @param asOf прогноз хийж буй огноо (YYYYMMDD) — цонх үүнээс хойш эхэлнэ
 */
export function forecast(points: DailyPoint[], asOf: string): ForecastResult {
  const lookbackDays = points.length;
  const usable = points.filter((p) => !p.stockout);
  const stockoutDays = lookbackDays - usable.length;

  // --- Суурь эрэлт μ: recency-жинтэй дундаж (нөөц дуусаагүй өдрүүд) ---
  let wSum = 0;
  let wxSum = 0;
  for (const p of usable) {
    const age = Math.max(0, daysBetween(p.d, asOf));
    const w = Math.pow(0.5, age / RECENCY_HALFLIFE_DAYS);
    wSum += w;
    wxSum += w * p.soldQty;
  }
  const baseDailyDemand = wSum > 0 ? wxSum / wSum : 0;

  // --- σ ба CoV (жингүй түүвэр) ---
  const soldVals = usable.map((p) => p.soldQty);
  const demandStdDev = stdDev(soldVals);
  const rawMean = mean(soldVals);
  const cov = rawMean > 0 ? demandStdDev / rawMean : 0;

  // --- DOW хүчин зүйл ---
  const byDow: number[][] = Array.from({ length: 7 }, () => []);
  for (const p of usable) byDow[dowOf(p.d)].push(p.soldQty);
  const overall = rawMean;
  const dowFactors = byDow.map((vals) => {
    if (vals.length === 0 || overall <= 0) return 1;
    return clamp(mean(vals) / overall, DOW_FACTOR_LO, DOW_FACTOR_HI);
  });

  // --- Трэнд: сүүлийн 7 хоног / өмнөх 7 хоног ---
  const last7 = usable.filter((p) => daysBetween(p.d, asOf) <= 7);
  const prev7 = usable.filter((p) => {
    const age = daysBetween(p.d, asOf);
    return age > 7 && age <= 14;
  });
  const lastSum = last7.reduce((a, p) => a + p.soldQty, 0);
  const prevSum = prev7.reduce((a, p) => a + p.soldQty, 0);
  const trend = prevSum > 0 ? clamp(lastSum / prevSum, TREND_LO, TREND_HI) : 1;

  // --- Итгэлцэл: түүврийн хэмжээ ↑, хэлбэлзэл ↓ → итгэлцэл ↑ ---
  const coverage = lookbackDays > 0 ? usable.length / lookbackDays : 0;
  const confidence = clamp(coverage * (1 / (1 + cov)), 0, 1);

  return {
    lookbackDays,
    sampleDays: usable.length,
    stockoutDays,
    baseDailyDemand,
    demandStdDev,
    cov,
    dowFactors,
    trend,
    confidence,
  };
}
