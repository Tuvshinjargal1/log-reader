/**
 * Engine orchestrator — нэг барааны захиалгын саналыг бүх factor breakdown-ий
 * хамт тооцоолно. daily_metrics цуваа + effective config → Suggestion.
 */
import type { EffectiveConfig } from "@/lib/config/types";
import type { DailyMetric } from "@/lib/db/repositories/metrics";
import { forecast } from "./forecast";
import { replenish } from "./replenish";
import { inferStockouts } from "./stockout";
import { addDays } from "./util";
import type { DailyPoint, Suggestion } from "./types";

export * from "./types";
export { forecast } from "./forecast";
export { replenish } from "./replenish";
export { seasonFactor } from "./season";
export { inferStockouts } from "./stockout";
export { computeSeasonality, detectRegimeChange } from "./seasonality";
export { backtestItem } from "./backtest";
export { computeHealth, RECOMMENDATION_LABEL } from "./health";
export { recommendTuning } from "./autotune";
export type { SeasonalityProfile, SeasonBucket, RegimeChange } from "./seasonality";
export type { BacktestResult, PolicyStats } from "./backtest";
export type { HealthResult, HealthGrade, Recommendation } from "./health";
export type { TuneRecommendation, TuneParam } from "./autotune";

export interface ComputeInput {
  itemCd: string;
  history: DailyMetric[]; // өсөх дарааллаар
  config: EffectiveConfig;
  asOf: string; // YYYYMMDD
  onHand: number;
  onOrder?: number;
}

/** daily_metrics-ийг engine-ийн DailyPoint болгож хөрвүүлнэ. */
export function toDailyPoints(history: DailyMetric[]): DailyPoint[] {
  return history.map((h) => ({
    d: h.d,
    soldQty: h.soldQty,
    stockout: h.stockoutFlag,
  }));
}

/**
 * ЧУХАЛ: POS-д бараа зарагдсан өдөр л daily_metrics мөр үүсдэг тул зарагдаагүй
 * өдрүүд дутуу байдаг. Ажигласан эхний ба сүүлийн огнооны хооронд дутуу
 * өдрүүдийг 0 борлуулалтаар нөхөж, тасралтгүй цуваа болгоно — эс тэгвэл эрэлт
 * (μ), гараг, stockout зэрэг буруу тооцогдоно.
 */
export function densifyDaily(points: DailyPoint[]): DailyPoint[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a.d.localeCompare(b.d));
  const byDate = new Map(sorted.map((p) => [p.d, p]));
  const end = sorted[sorted.length - 1].d;
  const out: DailyPoint[] = [];
  let cur = sorted[0].d;
  let guard = 0;
  while (cur.localeCompare(end) <= 0 && guard++ < 4000) {
    out.push(byDate.get(cur) ?? { d: cur, soldQty: 0, stockout: false });
    cur = addDays(cur, 1);
  }
  return out;
}

export function computeSuggestion(input: ComputeInput): Suggestion {
  const points = inferStockouts(densifyDaily(toDailyPoints(input.history)));
  const f = forecast(points, input.asOf);
  const factors = replenish({
    asOf: input.asOf,
    forecast: f,
    config: input.config,
    onHand: input.onHand,
    onOrder: input.onOrder ?? 0,
  });
  return {
    itemCd: input.itemCd,
    suggestedQty: factors.suggestedQty,
    factors,
  };
}
