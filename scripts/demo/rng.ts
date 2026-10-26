/**
 * Тогтмол (repeatable) псевдо-random — mulberry32.
 *
 * Демо дата нь ачаалал бүрт ЯГ адилхан гарах ёстой: танилцуулга дээр график
 * "чичрэхгүй", алдаа гарвал дахин үүсгэхэд ижил дата гарна.
 *
 * Дэлгүүр/бараа тус бүрд ТУСДАА урсгал (`streamFor`) — нэг дэлгүүрийн
 * параметрийг тааруулахад бусад дэлгүүрийн дата байт-байтаараа хөдлөхгүй.
 */

export const BASE_SEED = 20260729;

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Store slot + item index-ээс тусгаарлагдсан урсгал үүсгэнэ. */
export function streamFor(storeSlot: number, itemIndex: number): Rng {
  // Том анхны тоонуудаар холиж, зэргэлдээ slot/index-үүд ойрхон seed авахаас
  // сэргийлнэ (mulberry32 нь ойрхон seed-д эхний хэдэн утга ижилсдэг).
  const mixed =
    (BASE_SEED ^ Math.imul(storeSlot + 1, 0x9e3779b1) ^
      Math.imul(itemIndex + 1, 0x85ebca6b)) >>>
    0;
  return mulberry32(mixed);
}

/** Дундаж 0, стандарт хазайлт 1 — Box-Muller. */
export function gauss(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
}

export function intBetween(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function between(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

/** xs-ийг детерминистикээр холиж эхний n-г буцаана (Fisher-Yates). */
export function sample<T>(rng: Rng, xs: readonly T[], n: number): T[] {
  const arr = [...xs];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}
