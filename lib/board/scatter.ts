/**
 * Шийдвэрийн зургийн (quadrant scatter) ЦЭВЭР геометр.
 *
 * Render-ээс тусад нь байгаа шалтгаан: тестлэх боломжтой, дахин тооцоологдохгүй,
 * мөн мөргөлдөөн шийдэх алгоритм ДЕТЕРМИНИСТИК байх ёстой — танилцуулга ачаалал
 * бүрт яг адилхан харагдана.
 */

export interface ScatterPoint<T> {
  datum: T;
  /** 0..1 — хэвтээ (гараар өөрчилсөн хувь) */
  x: number;
  /** 0..1 — босоо (өөрчлөлт зөв гарсан хувь) */
  y: number;
  /** Бөмбөлгийн хэмжээг тодорхойлох хэмжигдэхүүн (₮) */
  weight: number;
}

export interface PlacedPoint<T> extends ScatterPoint<T> {
  /** Нүүлгэсэн дэлгэцийн координат */
  cx: number;
  cy: number;
  /** Нүүлгэхээс ӨМНӨХ координат — tooltip үргэлж ҮНЭН тоо хэлэх ёстой */
  trueCx: number;
  trueCy: number;
  r: number;
}

export const PLOT = {
  width: 960,
  height: 500,
  /** "Дата дутуу" тусгаарлагдсан талбай (зүүн талд) */
  gutterX0: 16,
  gutterX1: 72,
  x0: 96,
  x1: 912,
  y0: 40,
  y1: 400,
  legendY: 444,
  /** Хэвтээ тэнхлэгийн дээд хязгаар (40% гараар өөрчлөлт) */
  xMax: 0.4,
  /** Хөдөлмөрийн хязгаар — цорын ганц ТОХИРУУЛСАН босго */
  xDivider: 0.15,
  /** 50% = зоос шидэлт. ТОХИРУУЛЖ БОЛДОГГҮЙ байгалийн лавлах шугам. */
  yDivider: 0.5,
  rMin: 7,
  rMax: 18,
} as const;

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function sx(x: number): number {
  return PLOT.x0 + clamp01(x / PLOT.xMax) * (PLOT.x1 - PLOT.x0);
}

export function sy(y: number): number {
  return PLOT.y1 - clamp01(y) * (PLOT.y1 - PLOT.y0);
}

/** Талбай ∝ ₮ (радиус биш) — хүн талбайг зөв уншдаг. */
export function radiusOf(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return PLOT.rMin;
  return PLOT.rMin + Math.sqrt(clamp01(weight / maxWeight)) * (PLOT.rMax - PLOT.rMin);
}

/**
 * Нүүлгэх хязгаар — тэнхлэг тус бүрт ӨӨР.
 *
 * X (хөдөлмөрийн хувь) нь гол мэдээлэл тул бараг хөдөлгөхгүй. Y-г харин өргөн
 * тарааж болно: зүүн бүсэд (оролцоо <15%) y нь ердөө 4-6 мөрөөс тооцоологдсон
 * шуугиан тул уншигдах байдал нь нарийвчлалаас чухал.
 *
 * ⚠️ Гэхдээ y нь 50%-ийн шугамыг ДАВЖ БОЛОХГҮЙ — давбал дэлгүүр "оператор
 * дийлсэн" ба "тохируулга хэрэгтэй" бүсийн хооронд харагдацаараа шилжиж,
 * зураг датагаа зөрчинө.
 */
const MAX_NUDGE_X = 10;
const MAX_NUDGE_Y = 96;
const PASSES = 8;

/**
 * Давхцсан бөмбөлгийг детерминистикээр салгана. Санамсаргүй тоо ХЭРЭГЛЭХГҮЙ —
 * ачаалал бүрт ижил зураг гарах ёстой.
 */
export function place<T>(
  points: ScatterPoint<T>[],
  maxWeight: number,
): PlacedPoint<T>[] {
  const placed: PlacedPoint<T>[] = points.map((p) => {
    const cx = sx(p.x);
    const cy = sy(p.y);
    return { ...p, cx, cy, trueCx: cx, trueCy: cy, r: radiusOf(p.weight, maxWeight) };
  });

  // Яг давхцсан цэгүүдийг ЭХЛЭЭД детерминистикээр тарааж, релаксацын "хавчаас"-ыг
  // арилгана: хоёр цэг ижил координаттай бол чиглэлийн вектор тодорхойлогдохгүй
  // тул тэд хэдэн ч дамжлагад салдаггүй (8 дэлгүүр нэг дор бөөгнөрч байсан).
  // Эрэмбэ нь индексээр тул үр дүн давтагдана.
  const clusters = new Map<number, PlacedPoint<T>[]>();
  for (const p of placed) {
    const key = Math.round(p.cx / 24);
    const list = clusters.get(key);
    if (list) list.push(p);
    else clusters.set(key, [p]);
  }
  for (const list of clusters.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => b.cy - a.cy || a.r - b.r);
    const mid = (list.length - 1) / 2;
    list.forEach((p, i) => {
      p.cy += (i - mid) * (p.r * 2 + 4);
    });
  }

  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const dist = Math.hypot(dx, dy);
        const need = a.r + b.r + 3;
        if (dist >= need) continue;

        // Яг давхцсан бол детерминистик чиглэлээр (индексээр) салгана
        const ux = dist > 1e-6 ? dx / dist : (i % 2 === 0 ? 1 : -1);
        const uy = dist > 1e-6 ? dy / dist : (j % 2 === 0 ? 1 : -1);
        const push = (need - dist) / 2;

        // Босоо тэнхлэгт илүү чөлөөтэй тарааж, уншигдах байдлыг сайжруулна
        a.cx = nudge(a.cx, a.trueCx, -ux * push * 0.35, MAX_NUDGE_X);
        a.cy = nudge(a.cy, a.trueCy, -uy * push * 1.6, MAX_NUDGE_Y);
        b.cx = nudge(b.cx, b.trueCx, ux * push * 0.35, MAX_NUDGE_X);
        b.cy = nudge(b.cy, b.trueCy, uy * push * 1.6, MAX_NUDGE_Y);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const divider = sy(PLOT.yDivider);
  for (const p of placed) {
    // Талбайн дотор барина
    p.cx = Math.min(PLOT.x1 - p.r, Math.max(PLOT.x0 + p.r, p.cx));
    p.cy = Math.min(PLOT.y1 - p.r, Math.max(PLOT.y0 + p.r, p.cy));

    // 50%-ийн шугамыг давуулахгүй — ЗӨВХӨН баруун бүсэд. Тэнд л шугам зурагдаж,
    // "оператор дийлсэн / тохируулга хэрэгтэй" гэсэн утга агуулна.
    //
    // Зүүн бүсэд үүнийг хэрэглэвэл 8 дэлгүүрийг талбайн хагаст (180px) шахаж,
    // бөмбөлөг бүр ~36px хэрэгтэй тул уншигдахгүй бөөгнөрөл үүснэ. Тэнд шугам
    // зурагддаггүй тул хязгаарлах шаардлагагүй.
    if (p.x >= PLOT.xDivider) {
      if (p.trueCy < divider) p.cy = Math.min(p.cy, divider - p.r - 2);
      else p.cy = Math.max(p.cy, divider + p.r + 2);
    }
  }
  return placed;
}

function nudge(current: number, origin: number, delta: number, cap: number): number {
  const next = current + delta;
  const drift = next - origin;
  if (Math.abs(drift) <= cap) return next;
  return origin + Math.sign(drift) * cap;
}

export type QuadrantKey = "auto" | "manual_works" | "tune";

export interface QuadrantMeta {
  key: QuadrantKey;
  title: string;
  /** Мөрийн 2 дахь мөрөнд гарах тайлбар */
  note: string;
  /** Тэгш өнцөгтийн байрлал */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Анхаарал шаардсан хэсгийг бага зэрэг бүдгэлнэ */
  wash: boolean;
  /** Текстийн зэрэгцүүлэлт */
  anchor: "start" | "end";
  labelX: number;
  labelY: number;
}

/**
 * ГУРВАН бүс, дөрөв БИШ.
 *
 * ⚠️ Зүүн талыг 50%-ийн шугамаар хуваавал ХУДАЛ дүгнэлт гарна: гараар
 * оролцоо 15%-аас доогуур үед "зөв гарсан хувь" нь ердөө 4-6 мөр дээр
 * тооцоологдох тул статистикийн хувьд ямар ч утгагүй — шуугиан. Тэр шуугианаар
 * дэлгүүрийг "ХЯНАХ" гэж тэмдэглэвэл сайн ажиллаж байгаа 8 дэлгүүрийг
 * асуудалтай гэж харуулна (эхний хувилбарт яг ингэж болсон).
 *
 * Тиймээс: зүүн тал = НЭГ бүс ("оролцоо бага"), зөвхөн баруун талыг л
 * үр дүнгээр хуваана.
 */
export function quadrants(): QuadrantMeta[] {
  const xd = sx(PLOT.xDivider);
  const yd = sy(PLOT.yDivider);
  return [
    {
      key: "auto",
      title: "АВТОМАТ ХЭВЭЭР",
      note: "хүний оролцоо бага — систем өөрөө барьж байна",
      x: PLOT.x0, y: PLOT.y0, w: xd - PLOT.x0, h: PLOT.y1 - PLOT.y0,
      wash: false, anchor: "start", labelX: PLOT.x0 + 14, labelY: PLOT.y0 + 22,
    },
    {
      key: "manual_works",
      title: "ГАРААР ОРОЛЦОО АЖИЛЛАЖ БАЙНА",
      note: "оператор системийг дийлж байна",
      x: xd, y: PLOT.y0, w: PLOT.x1 - xd, h: yd - PLOT.y0,
      wash: false, anchor: "end", labelX: PLOT.x1 - 14, labelY: PLOT.y0 + 22,
    },
    {
      key: "tune",
      title: "ТОХИРУУЛГА ШААРДЛАГАТАЙ",
      note: "хөдөлмөр зарцуулсан ч үр дүнгүй",
      x: xd, y: yd, w: PLOT.x1 - xd, h: PLOT.y1 - yd,
      // labelY нь тэнхлэгийн заалт (PLOT.y1 + 16) ба тэнхлэгийн гарчигтай
      // (PLOT.y1 + 31) мөргөлдөхгүй байхаар дээгүүр
      wash: true, anchor: "end", labelX: PLOT.x1 - 14, labelY: yd + 26,
    },
  ];
}

/** Цэг аль бүсэд буусныг тодорхойлно (өнгө нь verdict-ээс тусдаа). */
export function quadrantOf(x: number, y: number): QuadrantKey {
  if (x < PLOT.xDivider) return "auto";
  return y >= PLOT.yDivider ? "manual_works" : "tune";
}
