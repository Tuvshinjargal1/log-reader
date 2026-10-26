/**
 * Барааны/дэлгүүрийн эрүүл мэндийн оноо + зөвлөмж. Backtest-ийн гүйцэтгэл болон
 * прогнозын итгэлцэлээс тооцно. Fleet дээрх "tuning шаардлагатай" төлөвийг
 * жолооддог.
 */
import type { BacktestResult } from "./backtest";
import { clamp } from "./util";

export type HealthGrade = "good" | "watch" | "poor";

export type Recommendation =
  | "keep_auto"
  | "auto_beneficial"
  | "increase_cover"
  | "reduce_cover"
  | "needs_data"
  | "manual_review";

export interface HealthResult {
  score: number; // 0..100
  grade: HealthGrade;
  recommendation: Recommendation;
  reason: string;
  overstockRatio: number;
}

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  keep_auto: "Автомат хэвээр — сайн ажиллаж байна",
  auto_beneficial: "Автомат болгох — систем гар аргаас давуу",
  increase_cover: "Нөөцлөлт нэмэх — нөөц дутагдаж байна",
  reduce_cover: "Нөөцлөлт бууруулах — илүүдэл/хаягдлын эрсдэл",
  needs_data: "Дата хүрэлцэхгүй — гараар хянах",
  manual_review: "Гараар хянах — хэлбэлзэл өндөр",
};

export interface HealthInput {
  backtest: BacktestResult;
  confidence: number;
  perishable: boolean;
}

export function computeHealth(input: HealthInput): HealthResult {
  const { backtest, confidence, perishable } = input;
  const e = backtest.engine;
  const avgDemand = e.periods > 0 ? e.totalDemand / e.periods : 0;
  const overstockRatio = clamp(
    avgDemand > 0 ? e.avgOverstock / avgDemand : 0,
    0,
    1,
  );

  const score = Math.round(
    100 *
      clamp(
        0.5 * e.fillRate + 0.25 * (1 - overstockRatio) + 0.25 * confidence,
        0,
        1,
      ),
  );
  const grade: HealthGrade = score >= 75 ? "good" : score >= 50 ? "watch" : "poor";

  let recommendation: Recommendation;
  if (confidence < 0.4 || e.periods < 5) {
    recommendation = "needs_data";
  } else if (e.cycleServiceLevel < 0.85) {
    recommendation = "increase_cover";
  } else if (perishable && overstockRatio > 0.5) {
    recommendation = "reduce_cover";
  } else if (
    e.fillRate - backtest.baseline.fillRate > 0.05 ||
    backtest.baseline.totalOverstock - e.totalOverstock >
      0.15 * (backtest.baseline.totalOverstock + 1)
  ) {
    recommendation = "auto_beneficial";
  } else {
    recommendation = "keep_auto";
  }

  return {
    score,
    grade,
    recommendation,
    reason: RECOMMENDATION_LABEL[recommendation],
    overstockRatio,
  };
}
