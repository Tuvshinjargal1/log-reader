/**
 * Periodic-review order-up-to (R, S) нөхөн дүүргэлтийн бодлого.
 *
 * Гишүүн бүр диаграмын зангилаа болохоор бүх завсрын утгыг DecisionFactors-т
 * тэмдэглэнэ. Одоогийн энгийн томьёо (need = avgDaily × cover − stock) нь үүний
 * тусгай тохиолдол (P = cover, SS = 0, seasonality/on_order/rounding байхгүй).
 */
import type { EffectiveConfig } from "@/lib/config/types";
import type { DecisionFactors, ForecastResult, WindowDay } from "./types";
import { seasonFactor } from "./season";
import { addDays, clamp, dowOf, invNormCdf, mean, roundUpTo } from "./util";

const LOW_CONFIDENCE_THRESHOLD = 0.4;

export interface ReplenishInput {
  asOf: string; // YYYYMMDD
  forecast: ForecastResult;
  config: EffectiveConfig;
  onHand: number;
  onOrder: number;
}

export function replenish(input: ReplenishInput): DecisionFactors {
  const { asOf, forecast: f, config, onHand, onOrder } = input;

  const reviewPeriodDays = Math.max(1, config.reviewPeriodDays);
  const leadTimeDays = Math.max(0, config.leadTimeDays);
  const protectionDays = reviewPeriodDays + leadTimeDays;

  // --- Прогнозын цонх: ирэх P өдрийн бодит гараг тус бүрээр ---
  const windowDays: WindowDay[] = [];
  let forecastDemand = 0;
  for (let i = 1; i <= protectionDays; i++) {
    const d = addDays(asOf, i);
    const dow = dowOf(d);
    const dowFactor = f.dowFactors[dow] ?? 1;
    const sf = seasonFactor(d);
    const demand = f.baseDailyDemand * dowFactor * f.trend * sf.factor;
    forecastDemand += demand;
    windowDays.push({ d, dow, dowFactor, seasonFactor: sf.factor, demand });
  }
  const dowFactorAvg =
    windowDays.length > 0 ? mean(windowDays.map((w) => w.dowFactor)) : 1;
  const seasonFactorAvg =
    windowDays.length > 0 ? mean(windowDays.map((w) => w.seasonFactor)) : 1;

  // --- Аюулгүйн нөөц: SS = z · σ · √P ---
  const serviceLevel = clamp(config.serviceLevel, 0.5, 0.999);
  const z = invNormCdf(serviceLevel);
  const safetyStock = Math.max(0, z * f.demandStdDev * Math.sqrt(protectionDays));

  // --- Order-up-to түвшин ба нөөцийн байрлал ---
  const orderUpTo = forecastDemand + safetyStock;
  const inventoryPosition = onHand + onOrder;
  const rawQty = Math.max(0, orderUpTo - inventoryPosition);

  // --- Дараах боловсруулалт: shelf-life cap → дугуйруулах → min/max ---
  let qty = rawQty;
  let shelfLifeCap: number | null = null;
  if (config.perishable && config.shelfLifeDays != null) {
    // Хугацаанд нь зарагдах хэмжээнээс илүү шинэ бараа захиалахгүй (waste хяналт)
    const expSalesOverShelf =
      f.baseDailyDemand * dowFactorAvg * f.trend * config.shelfLifeDays;
    shelfLifeCap = Math.max(0, expSalesOverShelf - onHand);
    qty = Math.min(qty, shelfLifeCap);
  }

  const orderMultiple = Math.max(1, config.orderMultiple);
  let afterRounding = roundUpTo(qty, orderMultiple);
  if (afterRounding > 0 && config.minQty != null) {
    afterRounding = Math.max(afterRounding, config.minQty);
  }
  if (config.maxQty != null) {
    afterRounding = Math.min(afterRounding, config.maxQty);
  }
  const suggestedQty = Math.max(0, afterRounding);

  const lowConfidence = f.confidence < LOW_CONFIDENCE_THRESHOLD;

  return {
    asOf,
    lookbackDays: f.lookbackDays,
    sampleDays: f.sampleDays,
    stockoutDays: f.stockoutDays,
    baseDailyDemand: f.baseDailyDemand,
    demandStdDev: f.demandStdDev,
    cov: f.cov,
    dowFactorAvg,
    trend: f.trend,
    seasonFactorAvg,
    reviewPeriodDays,
    leadTimeDays,
    protectionDays,
    forecastDemand,
    windowDays,
    serviceLevel,
    z,
    safetyStock,
    orderUpTo,
    onHand,
    onOrder,
    inventoryPosition,
    rawQty,
    shelfLifeCap,
    orderMultiple,
    minQty: config.minQty,
    maxQty: config.maxQty,
    afterRounding,
    suggestedQty,
    confidence: f.confidence,
    lowConfidence,
    mode: config.mode,
  };
}
