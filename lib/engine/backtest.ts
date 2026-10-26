/**
 * Walk-forward backtest — түүхэн борлуулалт дээр (R,S) engine бодлогыг энгийн
 * baseline (хуучин cover томьёо)-той харьцуулна. Зөвхөн борлуулалтын түүх
 * шаардана — өөрсдийн захиалгын түүх хэрэггүй тул шинэ систем дээр ч ажиллана.
 *
 * Санаа: өдөр бүр d дээр өмнөх датагаар захиалах түвшин S-ийг тооцоод, ирэх
 * P өдрийн БОДИТ эрэлттэй харьцуулна:
 *   - S < эрэлт  → нөөц дуусна (unmet = эрэлт − S)
 *   - S > эрэлт  → илүүдэл (overstock = S − эрэлт)
 * Ингэснээр engine нь baseline-аас хэр их алдагдсан борлуулалт/илүүдлийг
 * бууруулснийг ₮-ээр харуулна ("AI өөрийгөө нотолно").
 */
import type { EffectiveConfig } from "@/lib/config/types";
import { forecast } from "./forecast";
import { replenish } from "./replenish";
import { inferStockouts } from "./stockout";
import type { DailyPoint } from "./types";
import { mean } from "./util";

export interface PolicyStats {
  periods: number;
  cycleServiceLevel: number; // нөөц дуусаагүй өдрийн эзлэх хувь (0..1)
  fillRate: number; // 1 − нийт unmet / нийт эрэлт
  totalDemand: number;
  totalUnmet: number;
  totalOverstock: number;
  avgOverstock: number;
}

export interface BacktestResult {
  itemCd?: string;
  protectionDays: number;
  evaluatedPeriods: number;
  price: number | null;
  engine: PolicyStats;
  baseline: PolicyStats;
  lostSalesAvoided: number; // ₮ (baseline unmet − engine unmet) × үнэ
  overstockReduced: number; // ₮ (baseline overstock − engine overstock) × үнэ
}

export interface BacktestOptions {
  itemCd?: string;
  price?: number | null;
  minTrain?: number;
  trailingWindow?: number;
}

const MIN_TRAIN = 14;
const TRAILING = 28;

function trailingMean(points: DailyPoint[], endIdx: number, window: number): number {
  const slice = points.slice(Math.max(0, endIdx - window + 1), endIdx + 1);
  const usable = slice.filter((p) => !p.stockout);
  return mean(usable.map((p) => p.soldQty));
}

function emptyStats(): {
  periods: number;
  noStockout: number;
  demand: number;
  unmet: number;
  overstock: number;
} {
  return { periods: 0, noStockout: 0, demand: 0, unmet: 0, overstock: 0 };
}

export function backtestItem(
  history: DailyPoint[],
  config: EffectiveConfig,
  opts: BacktestOptions = {},
): BacktestResult {
  const points = inferStockouts([...history].sort((a, b) => a.d.localeCompare(b.d)));
  const minTrain = opts.minTrain ?? MIN_TRAIN;
  const trailing = opts.trailingWindow ?? TRAILING;
  const protectionDays = Math.max(
    1,
    Math.max(1, config.reviewPeriodDays) + Math.max(0, config.leadTimeDays),
  );

  const eng = emptyStats();
  const base = emptyStats();

  for (let d = minTrain; d < points.length - protectionDays; d++) {
    const asOf = points[d].d;
    const train = points.slice(0, d + 1);

    // Ирэх P өдрийн бодит эрэлт
    let demandP = 0;
    for (let k = d + 1; k <= d + protectionDays; k++) demandP += points[k].soldQty;

    // Engine (R,S) захиалах түвшин
    const f = forecast(train, asOf);
    const sEngine = replenish({
      asOf,
      forecast: f,
      config,
      onHand: 0,
      onOrder: 0,
    }).orderUpTo;

    // Baseline: энгийн cover формул
    const avg = trailingMean(points, d, trailing);
    const sBaseline = avg * config.coverDays;

    accumulate(eng, sEngine, demandP);
    accumulate(base, sBaseline, demandP);
  }

  const price = opts.price ?? null;
  const engine = finalize(eng);
  const baseline = finalize(base);
  const unit = price ?? 0;

  return {
    itemCd: opts.itemCd,
    protectionDays,
    evaluatedPeriods: engine.periods,
    price,
    engine,
    baseline,
    lostSalesAvoided: (baseline.totalUnmet - engine.totalUnmet) * unit,
    overstockReduced: (baseline.totalOverstock - engine.totalOverstock) * unit,
  };
}

function accumulate(
  acc: ReturnType<typeof emptyStats>,
  s: number,
  demandP: number,
): void {
  acc.periods++;
  acc.demand += demandP;
  const unmet = Math.max(0, demandP - s);
  const overstock = Math.max(0, s - demandP);
  acc.unmet += unmet;
  acc.overstock += overstock;
  if (unmet <= 1e-9) acc.noStockout++;
}

function finalize(acc: ReturnType<typeof emptyStats>): PolicyStats {
  const periods = acc.periods;
  return {
    periods,
    cycleServiceLevel: periods > 0 ? acc.noStockout / periods : 0,
    fillRate: acc.demand > 0 ? 1 - acc.unmet / acc.demand : 1,
    totalDemand: acc.demand,
    totalUnmet: acc.unmet,
    totalOverstock: acc.overstock,
    avgOverstock: periods > 0 ? acc.overstock / periods : 0,
  };
}
