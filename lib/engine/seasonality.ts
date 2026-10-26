/**
 * Улирлын профайл — борлуулалтын түүхээс гараг (DOW) ба сарын multiplier-ийг
 * тооцоолж, regime change (эрэлтийн түвшин огцом өөрчлөгдсөн эсэх)-ийг илрүүлнэ.
 * PURE. Үр дүн seasonality_profile-д хадгалагдаж, forecast/auto-tune-д ашиглагдана.
 */
import type { DailyPoint } from "./types";
import { clamp, daysBetween, dowOf, mean, ymdToDate } from "./util";

export interface SeasonBucket {
  bucket: number; // dow: 0-6, month: 1-12
  multiplier: number;
  sampleCount: number;
  confidence: number;
}

export interface SeasonalityProfile {
  dow: SeasonBucket[];
  month: SeasonBucket[];
  overallMean: number;
}

const FACTOR_LO = 0.3;
const FACTOR_HI = 3;

function buckets(
  points: DailyPoint[],
  keyer: (ymd: string) => number,
  size: number,
  overall: number,
): SeasonBucket[] {
  const groups: number[][] = Array.from({ length: size }, () => []);
  for (const p of points) groups[keyer(p.d)].push(p.soldQty);
  return groups.map((vals, i) => {
    const mult =
      vals.length > 0 && overall > 0
        ? clamp(mean(vals) / overall, FACTOR_LO, FACTOR_HI)
        : 1;
    return {
      bucket: i,
      multiplier: mult,
      sampleCount: vals.length,
      confidence: clamp(vals.length / 8, 0, 1),
    };
  });
}

export function computeSeasonality(points: DailyPoint[]): SeasonalityProfile {
  const usable = points.filter((p) => !p.stockout);
  const overall = mean(usable.map((p) => p.soldQty));

  const dow = buckets(usable, dowOf, 7, overall);
  const monthRaw = buckets(
    usable,
    (ymd) => ymdToDate(ymd).getUTCMonth(),
    12,
    overall,
  );
  // month bucket-ийг 1-based болгоно
  const month = monthRaw.map((b) => ({ ...b, bucket: b.bucket + 1 }));

  return { dow, month, overallMean: overall };
}

export interface RegimeChange {
  changed: boolean;
  recentMean: number;
  historicalMean: number;
  ratio: number; // recent / historical
  reason: string | null;
}

/**
 * Сүүлийн `recentDays` хоногийн дундаж эрэлтийг өмнөх түүхтэй харьцуулж,
 * түвшин ихээхэн өөрчлөгдсөн бол retune хэрэгтэйг илэрхийлнэ.
 */
export function detectRegimeChange(
  points: DailyPoint[],
  asOf: string,
  recentDays = 14,
): RegimeChange {
  const usable = points.filter((p) => !p.stockout);
  const recent = usable.filter((p) => daysBetween(p.d, asOf) <= recentDays);
  const older = usable.filter((p) => daysBetween(p.d, asOf) > recentDays);
  const recentMean = mean(recent.map((p) => p.soldQty));
  const historicalMean = mean(older.map((p) => p.soldQty));

  if (older.length < 7 || recent.length < 3 || historicalMean <= 0) {
    return {
      changed: false,
      recentMean,
      historicalMean,
      ratio: 1,
      reason: null,
    };
  }

  const ratio = recentMean / historicalMean;
  let reason: string | null = null;
  let changed = false;
  if (ratio >= 1.35) {
    changed = true;
    reason = `Эрэлт ${Math.round((ratio - 1) * 100)}% өссөн — нөөцлөлт нэмэх`;
  } else if (ratio <= 0.65) {
    changed = true;
    reason = `Эрэлт ${Math.round((1 - ratio) * 100)}% буурсан — нөөцлөлт бууруулах`;
  }
  return { changed, recentMean, historicalMean, ratio, reason };
}
