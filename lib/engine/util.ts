/** Engine-ийн огноо ба статистикийн туслах функцууд (pure). */

/** "YYYYMMDD" → UTC Date */
export function ymdToDate(ymd: string): Date {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  return new Date(Date.UTC(y, m, d));
}

/** UTC Date → "YYYYMMDD" */
export function dateToYmd(dt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

export function addDays(ymd: string, n: number): string {
  const dt = ymdToDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dateToYmd(dt);
}

/**
 * Хуанлийн сараар нэмэх/хасах. Жишээ: 20260902 − 1 сар = 20260802.
 * Зорилтот сард тэр өдөр байхгүй бол (3/31 → 2-р сар) тухайн сарын сүүлийн өдөр.
 */
export function addCalendarMonths(ymd: string, delta: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  const total = y * 12 + m + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return dateToYmd(new Date(Date.UTC(ny, nm, Math.min(d, last))));
}

/** asOf − 1 сар → asOf (хоёр төгсгөл inclusive). */
export function rollingMonthRange(asOf: string): { from: string; to: string } {
  return { from: addCalendarMonths(asOf, -1), to: asOf };
}

/** Гараг: 0=Ням ... 6=Бямба */
export function dowOf(ymd: string): number {
  return ymdToDate(ymd).getUTCDay();
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round(
    (ymdToDate(toYmd).getTime() - ymdToDate(fromYmd).getTime()) / 86_400_000,
  );
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Түүврийн стандарт хазайлт (n−1). Хоёроос цөөн бол 0. */
export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** mult-ийн ойролцоо дээш дугуйруулах */
export function roundUpTo(x: number, mult: number): number {
  if (mult <= 1) return Math.ceil(x - 1e-9);
  return Math.ceil((x - 1e-9) / mult) * mult;
}

/**
 * Стандарт нормаль тархалтын урвуу (quantile). Үйлчилгээний түвшин p → z.
 * Acklam-ийн ойролцоо томьёо (алдаа < 1.15e-9).
 */
export function invNormCdf(p: number): number {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
