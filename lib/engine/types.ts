import type { OrderMode } from "@/lib/config/types";

/** Engine-д өгөх нэг өдрийн цэг (daily_metrics-аас хөрвүүлсэн) */
export interface DailyPoint {
  d: string; // YYYYMMDD
  soldQty: number;
  stockout: boolean;
}

/** Прогнозын хэсгийн гаралт */
export interface ForecastResult {
  lookbackDays: number;
  sampleDays: number; // ашигласан (нөөц дуусаагүй) өдрийн тоо
  stockoutDays: number;
  baseDailyDemand: number; // μ (recency-жинтэй)
  demandStdDev: number; // σ_daily
  cov: number; // хэлбэлзлийн коэффициент σ/μ
  dowFactors: number[]; // 7 элемент (0=Ням)
  trend: number; // [0.7, 1.4]
  confidence: number; // 0..1
}

/** Прогнозын цонхны нэг өдөр (диаграмд) */
export interface WindowDay {
  d: string;
  dow: number;
  dowFactor: number;
  seasonFactor: number;
  demand: number;
}

/** Шийдвэрийн бүх хүчин зүйл (order_lines.factors_snapshot-д хадгална) */
export interface DecisionFactors {
  asOf: string;
  // прогноз
  lookbackDays: number;
  sampleDays: number;
  stockoutDays: number;
  baseDailyDemand: number;
  demandStdDev: number;
  cov: number;
  dowFactorAvg: number;
  trend: number;
  seasonFactorAvg: number;
  // цонх
  reviewPeriodDays: number;
  leadTimeDays: number;
  protectionDays: number;
  forecastDemand: number; // D_P
  windowDays: WindowDay[];
  // аюулгүйн нөөц
  serviceLevel: number;
  z: number;
  safetyStock: number; // SS
  orderUpTo: number; // S = D_P + SS
  // нөөц
  onHand: number;
  onOrder: number;
  inventoryPosition: number; // IP
  // захиалга
  rawQty: number; // max(0, S − IP)
  shelfLifeCap: number | null;
  orderMultiple: number;
  minQty: number | null;
  maxQty: number | null;
  afterRounding: number;
  suggestedQty: number; // эцсийн
  // мета
  confidence: number;
  lowConfidence: boolean;
  mode: OrderMode;
}

/** computeSuggestion-ий гаралт */
export interface Suggestion {
  itemCd: string;
  suggestedQty: number;
  factors: DecisionFactors;
}
