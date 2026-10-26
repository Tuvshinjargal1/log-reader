/** Диаграм/матрицын өнгөний туслах (pure, client-safe). Tailwind палитртай нийцнэ. */

const TEAL = "13,148,136"; // teal-600 — эерэг/дээш чиглэл
const ROSE = "225,29,72"; // rose-600 — сөрөг/доош чиглэл

/** -1..1 diverging: эерэг → teal, сөрөг → rose */
export function divergingColor(v: number): string {
  const c = v >= 0 ? TEAL : ROSE;
  const a = 0.1 + Math.min(1, Math.abs(v)) * 0.82;
  return `rgba(${c},${a.toFixed(3)})`;
}

/** 0..1 sequential (teal) */
export function sequentialColor(v: number): string {
  const a = 0.08 + Math.min(1, Math.max(0, v)) * 0.85;
  return `rgba(${TEAL},${a.toFixed(3)})`;
}

/** Хүчтэй өнгөн дээр цагаан текст хэрэглэх эсэх */
export function needsLightText(v: number): boolean {
  return Math.abs(v) > 0.55;
}

export const STATUS_COLOR: Record<string, string> = {
  healthy: "#059669", // emerald-600
  stockout: "#dc2626", // red-600
  tuning: "#d97706", // amber-600
  offline: "#a8a29e", // stone-400
};

export const STATUS_LABEL: Record<string, string> = {
  healthy: "Хэвийн",
  stockout: "Нөөц дуусах эрсдэл",
  tuning: "Тохируулга шаардлагатай",
  offline: "Холбогдоогүй",
};
