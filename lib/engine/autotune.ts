/**
 * Auto-tune зөвлөмж — backtest гүйцэтгэл ба regime change-ээс параметрийн
 * өөрчлөлт санал болгоно. Enterprise итгэлийн үүднээс ЗӨВЛӨМЖ л гаргана;
 * оператор батлах хүртэл ЧИМЭЭГҮЙ өөрчлөхгүй (батлагдвал tuning_history-д лог).
 */
import type { EffectiveConfig } from "@/lib/config/types";
import type { BacktestResult } from "./backtest";
import type { RegimeChange } from "./seasonality";
import { clamp } from "./util";

export type TuneParam = "serviceLevel" | "coverDays";

export interface TuneRecommendation {
  param: TuneParam;
  from: number;
  to: number;
  reason: string;
  expectedImpact: string;
}

export interface TuneInput {
  backtest: BacktestResult;
  config: EffectiveConfig;
  regime?: RegimeChange | null;
  targetServiceLevel?: number;
}

export function recommendTuning(input: TuneInput): TuneRecommendation[] {
  const { backtest, config } = input;
  const e = backtest.engine;
  const recs: TuneRecommendation[] = [];
  const target = input.targetServiceLevel ?? config.serviceLevel;

  const avgDemand = e.periods > 0 ? e.totalDemand / e.periods : 0;
  const overstockRatio = avgDemand > 0 ? e.avgOverstock / avgDemand : 0;

  // Хангалтгүй үйлчилгээ → serviceLevel нэмэх
  if (e.periods >= 5 && e.cycleServiceLevel < target - 0.05) {
    const to = clamp(Math.round((config.serviceLevel + 0.03) * 100) / 100, 0.5, 0.99);
    if (to > config.serviceLevel) {
      recs.push({
        param: "serviceLevel",
        from: config.serviceLevel,
        to,
        reason: `Мөчлөгийн үйлчилгээ ${(e.cycleServiceLevel * 100).toFixed(0)}% — зорилтоос доогуур`,
        expectedImpact: "Нөөц дуусах эрсдэл буурна (аюулгүйн нөөц нэмэгдэнэ)",
      });
    }
  }

  // Хэт их илүүдэл → serviceLevel бууруулах
  if (e.periods >= 5 && e.cycleServiceLevel > 0.97 && overstockRatio > 0.6) {
    const to = clamp(Math.round((config.serviceLevel - 0.03) * 100) / 100, 0.5, 0.99);
    if (to < config.serviceLevel) {
      recs.push({
        param: "serviceLevel",
        from: config.serviceLevel,
        to,
        reason: `Илүүдэл өндөр (эрэлтийн ${(overstockRatio * 100).toFixed(0)}%), үйлчилгээ 97%+`,
        expectedImpact: "Илүүдэл нөөц/хаягдал буурна",
      });
    }
  }

  // Regime change → cover тохируулга
  if (input.regime?.changed) {
    const factor = input.regime.ratio >= 1 ? 1 : -1;
    const to = clamp(config.coverDays + factor, 1, 30);
    if (to !== config.coverDays) {
      recs.push({
        param: "coverDays",
        from: config.coverDays,
        to,
        reason: input.regime.reason ?? "Эрэлтийн түвшин өөрчлөгдсөн",
        expectedImpact: "Шинэ эрэлтийн түвшинд нийцүүлнэ",
      });
    }
  }

  return recs;
}
