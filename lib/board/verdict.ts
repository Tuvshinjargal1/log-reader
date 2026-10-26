/**
 * Verdict-ийн ХАРАГДАЦЫН токенууд (өнгө, тэмдэг, эрэмбэ).
 *
 * Логик ба босго нь `lib/replenish/board.ts`-д (сервер тал) — энд зөвхөн
 * танилцуулга. Ингэснээр board-ын шийдвэр ба өнгө хоёр нэг эх сурвалжтай.
 *
 * ── ПАЛИТР ЯАГААД ИЙМ БАЙНА (validate_palette.js-ээр ТООЦООЛСОН, нүдээр биш) ──
 *   node scripts/validate_palette.js "#0d9488,#4f46e5,#f59e0b,#e11d48" \
 *        --mode light --surface "#ffffff" --pairs all
 *     [PASS] CVD separation   worst #e11d48↔#0d9488  ΔE 10.2 (deutan)
 *     [PASS] Normal-vision    worst #e11d48↔#f59e0b  ΔE 25.6
 *     [WARN] Contrast         #f59e0b 2.15:1 → relief шаардлагатай
 *     → ALL CHECKS PASS
 *
 * 1) AUTO_OK нь аппын ердийн emerald БИШ, teal. Учир нь emerald #059669 ба
 *    rose #e11d48 хосын ΔE нь deuteranopia-д ердөө 5.8 — 6.0 давхаргаас ч
 *    доогуур, өөрөөр хэлбэл эрэгтэйчүүдийн ~8%-д "сайн" ба "муу" нь ЯЛГАГДАХГҮЙ.
 *    Teal болгоход 10.2 болж PASS. Teal нь брэнд/engine-ийн өнгө тул
 *    "teal = систем зөв тооцоолсон" гэж утгын хувьд ч уншигдана.
 * 2) DATA нь 5 дахь ӨНГӨ БИШ. Саарал нэмбэл chroma floor-оос унаад (өнгө биш,
 *    зүгээр л бүдэг гэж уншигдана) teal-тэй ΔE 5.0 (deutan) болж мөргөлдөнө.
 *    Тиймээс "хоосон чип" — БАЙХГҮЙГ БАЙХГҮЙГЭЭР кодлоно.
 * 3) Амберын 2.15:1 сануулга нь хоёр туслах сувгаар (нүдэн доторх тэмдэг +
 *    хүснэгт харагдац) ЗАЙЛУУЛАГДАНА — эдгээр нь заавал шиппэгдэнэ.
 */
import type { Verdict } from "@/lib/replenish/board";

export interface VerdictToken {
  key: Verdict;
  label: string;
  /** Товч тэмдэг — өнгөнөөс хамааралгүй хоёр дахь суваг */
  glyph: string;
  /** null = дүүргэлтгүй (хоосон чип) */
  fill: string | null;
  /** Тэмдгийн бэх — гэрэлтүүлгээр сонгоно */
  ink: string;
  /** Хоосон чипийн хүрээ */
  stroke: string | null;
  /** Эрэмбэ: жижиг = илүү яаралтай */
  order: number;
  /** Богино үйлдлийн заавар */
  hint: string;
}

export const VERDICT: Record<Verdict, VerdictToken> = {
  TUNE: {
    key: "TUNE",
    label: "Тохируулга шаардлагатай",
    glyph: "~",
    fill: "#f59e0b",
    ink: "#1c1917", // амбер дээр цагаан бэх 2.15:1 — хар бэх хэрэглэнэ
    stroke: null,
    order: 0,
    hint: "Параметрээ зас — өдөр бүр гараар хийх шаардлагагүй",
  },
  WATCH: {
    key: "WATCH",
    label: "Хянах",
    glyph: "!",
    fill: "#e11d48",
    ink: "#ffffff",
    stroke: null,
    order: 1,
    hint: "Тодорхой шийдвэр гаргах хэмжээнд хүрээгүй — ажигла",
  },
  DATA: {
    key: "DATA",
    label: "Дата дутуу",
    glyph: "?",
    fill: null, // 5 дахь өнгө болгож БОЛОХГҮЙ — дээрх тайлбар харна уу
    ink: "#78716c",
    stroke: "#a8a29e",
    order: 2,
    hint: "Хэмжих үндэслэл хүрэлцэхгүй — эхлээд дата цуглуул",
  },
  MANUAL: {
    key: "MANUAL",
    label: "Гараар үнэ цэнэ нэмж байна",
    glyph: "✎",
    fill: "#4f46e5",
    ink: "#ffffff",
    stroke: null,
    order: 3,
    hint: "Операторыг үлдээ — системд харагдахгүй мэдээлэл мэдэж байна",
  },
  AUTO_OK: {
    key: "AUTO_OK",
    label: "Автомат хэвээр",
    glyph: "✓",
    fill: "#0d9488",
    ink: "#ffffff",
    stroke: null,
    order: 4,
    hint: "Оролцох шаардлагагүй",
  },
};

export const VERDICT_ORDER: Verdict[] = ["TUNE", "WATCH", "DATA", "MANUAL", "AUTO_OK"];

/** Товч (1-2 үг) шошго — нүд багтахгүй газарт */
export const VERDICT_SHORT: Record<Verdict, string> = {
  TUNE: "Тохируулга",
  WATCH: "Хянах",
  DATA: "Дата дутуу",
  MANUAL: "Гараар",
  AUTO_OK: "Автомат",
};

/** Хоосон чипийн загварыг нэг дор — grid ба quadrant хоёулаа хэрэглэнэ. */
export function verdictFillStyle(v: Verdict): {
  background: string;
  color: string;
  boxShadow?: string;
} {
  const t = VERDICT[v];
  if (t.fill == null) {
    return {
      background: "#ffffff",
      color: t.ink,
      boxShadow: `inset 0 0 0 2px ${t.stroke}`,
    };
  }
  return { background: t.fill, color: t.ink };
}

/** Тайлбар мөрөнд гарах "чип + нэр" — өнгө дангаараа мэдээлэл дамжуулахгүй. */
export const VERDICT_LEGEND = VERDICT_ORDER.map((v) => ({
  key: v,
  glyph: VERDICT[v].glyph,
  label: VERDICT[v].label,
  short: VERDICT_SHORT[v],
}));

/** Trend чартын цувааны өнгө — teal/indigo хос (validator: ΔE 22.1 deutan, PASS). */
export const SERIES_COLOR = {
  fill: "#0d9488",
  override: "#4f46e5",
} as const;

/** Recessive chrome — сүлжээ, тэнхлэг, лавлах шугам. */
export const CHROME = {
  grid: "#e7e5e4",
  axis: "#d6d3d1",
  reference: "#a8a29e",
  label: "#a8a29e",
  labelStrong: "#78716c",
  surface: "#ffffff",
  wash: "#fafaf9",
} as const;
