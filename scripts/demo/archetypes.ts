/**
 * Дэлгүүрийн архетип — демо дээр ямар түүх гарахыг ТОХИРГООГООР л заана.
 *
 * Ямар ч verdict-ыг гараар "будаагүй": эдгээр параметрүүд симуляцад ордог,
 * үр дүн нь бодит engine (`computeSuggestion`) болон board-ын босгоор өөрөө
 * тодорхойлогдоно. Тул нэг тоог өөрчилбөл бүхэл түүх нийцтэйгээр хөдөлнө.
 *
 * Хүлээсэн verdict нь ЗӨВЛӨМЖ — seed нь дуусахдаа БОДИТ verdict-ыг тооцоолж
 * хэвлэдэг тул зөрөх тохиолдол нь датаны үнэн уншилт, алдаа биш.
 */
import type { OrderMode } from "@/lib/config/types";

export type ArchetypeKind =
  | "auto_healthy"
  | "tune_up"
  | "tune_down"
  | "manual_value"
  | "data_problem"
  | "offline";

export interface StoreArchetype {
  kind: ArchetypeKind;
  mode: OrderMode;
  /** store_config override (null = global-ыг ашиглана) */
  serviceLevel: number | null;
  coverDays: number | null;

  // --- эрэлтийн загвар ---
  demandScale: readonly [number, number];
  covMultiplier: number;
  /** Өдөр тутмын нийлмэл трэнд */
  trendPerDay: number;
  /** Тодорхой өдрөөс эхлэн эрэлт шатлан өөрчлөгдөх (regime change) */
  regimeStep: {
    daysBeforeEnd: number;
    factor: number;
    categories: readonly string[];
  } | null;
  /** Engine-д ХАРАГДАХГҮЙ давтагдах долоо хоногийн онцлог */
  hiddenWeekly: {
    dows: readonly number[];
    factor: number;
    categories: readonly string[];
  } | null;
  /** Engine-д ХАРАГДАХГҮЙ нэг удаагийн эвент (сургуулийн арга хэмжээ гэх мэт) */
  hiddenEvents: {
    daysBeforeEnd: readonly number[];
    factor: number;
    categories: readonly string[];
  } | null;
  /**
   * Engine-д ХАРАГДАХГҮЙ эрэлт УНАХ өдрүүд (амралт, шалгалтын үе гэх мэт).
   *
   * ЯАГААД ХЭРЭГТЭЙ: зөвхөн өсөх эвент байвал оператор ҮРГЭЛЖ нэмэх л болно —
   * `biasConsistency` өндөр гарч, board нь "параметрээ зас" (TUNE) гэж дүгнэнэ.
   * Хоёр тийш засах шаардлага байж л "оператор моделд харагдахгүй зүйл мэднэ"
   * (MANUAL) гэдэг нь бодитоор батлагдана.
   *
   * ⚠️ Уналтын ангилал нь ӨСӨЛТИЙН ангилалтай ИЖИЛ байх ёстой. Өөр ангилалд
   * тавибал ангилал тус бүрийн дотор оператор нэг чигт л засах болж,
   * biasConsistency өндөр гарна.
   */
  hiddenLulls: {
    daysBeforeEnd: readonly number[];
    factor: number;
    categories: readonly string[];
  } | null;

  // --- дата, синк ---
  historyDays: number;
  /** Дата хэдэн хоногийн өмнө тасарсан (0 = asOf хүртэл бүтэн) */
  endsDaysBeforeAsOf: number;
  sparseBoost: number;
  lastSyncHoursAgo: number;
  ingestionStatus: "ok" | "failed";
  /** planStore ажиллуулах эсэх — offline дэлгүүрт ЗААВАЛ false байх ёстой */
  plan: boolean;
  /** Зориуд spiky болгож итгэлцлийг унагах барааны тоо */
  lowConfidenceItems: number;

  // --- операторын зан төлөв ---
  /** Мөрийн хэдэн хувийг оператор хүрч үзэх */
  overrideRate: number;
  /** −1..+1 — +1 нь ideal руу яг хүрнэ, сөрөг нь ideal-ээс ХОЛДУУЛНА */
  overrideSkill: number;
  /** 0 = хоёр тал, ±x = нэг тал руу хазайсан */
  overrideBias: number;
}

const AUTO_HEALTHY = (i: number): StoreArchetype => ({
  kind: "auto_healthy",
  mode: "auto",
  serviceLevel: null,
  coverDays: null,
  demandScale: [0.9, 1.35],
  covMultiplier: 0.85,
  trendPerDay: 0.0005,
  regimeStep: null,
  hiddenWeekly: null,
  hiddenEvents: null,
  hiddenLulls: null,
  historyDays: 90,
  endsDaysBeforeAsOf: 0,
  sparseBoost: 0,
  lastSyncHoursAgo: 3 + (i % 4),
  ingestionStatus: "ok",
  plan: true,
  lowConfidenceItems: 0,
  // Цөөн, санамсаргүй, бас ХОРТОЙ өөрчлөлт → accuracy 50%-аас доош
  overrideRate: 0.05,
  overrideSkill: -0.25,
  overrideBias: 0,
});

/**
 * slot → архетип. Урт нь DEMO_BRANCHES-тэй тэнцүү (20) байх ёстой.
 *
 * Хүлээгдэх хуваарилалт: 8 AUTO_OK · 4 TUNE · 4 MANUAL · 4 DATA.
 * ХЯНАХ (WATCH) нь шуугианаас ӨӨРӨӨ үүсэх боломжтой — бүх төлвийг гараар
 * тавихаас илүү бодитой.
 */
export const ARCHETYPE_PLAN: readonly StoreArchetype[] = [
  AUTO_HEALTHY(0),
  AUTO_HEALTHY(1),
  AUTO_HEALTHY(2),
  AUTO_HEALTHY(3),
  AUTO_HEALTHY(4),
  AUTO_HEALTHY(5),
  AUTO_HEALTHY(6),
  AUTO_HEALTHY(7),

  // --- slot 8-9: "хажууд нь шинэ оффисын байр нээгдсэн" ---
  // serviceLevel/coverDays зориуд доогуур → S дутна → нөөц дутагдал өөрөө үүснэ.
  // Оператор ҮРГЭЛЖ нэг чигт (+30%) нэмж, ЗӨВ гарч байгаа → biasConsistency
  // өндөр → TUNE (параметрийг зас), MANUAL биш.
  {
    kind: "tune_up", mode: "auto",
    serviceLevel: 0.9, coverDays: 2,
    demandScale: [1.0, 1.4], covMultiplier: 1.0, trendPerDay: 0.001,
    regimeStep: { daysBeforeEnd: 21, factor: 1.45, categories: ["31", "80", "20", "30"] },
    hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 2, ingestionStatus: "ok", plan: true, lowConfidenceItems: 0,
    overrideRate: 0.3, overrideSkill: 0.55, overrideBias: 0.3,
  },
  {
    kind: "tune_up", mode: "auto",
    serviceLevel: 0.9, coverDays: 2,
    demandScale: [0.95, 1.3], covMultiplier: 1.05, trendPerDay: 0.001,
    regimeStep: { daysBeforeEnd: 19, factor: 1.4, categories: ["31", "80", "20"] },
    hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 4, ingestionStatus: "ok", plan: true, lowConfidenceItems: 0,
    overrideRate: 0.28, overrideSkill: 0.5, overrideBias: 0.28,
  },

  // --- slot 10-11: "зам засварт орж хөл хөдөлгөөн буурсан" ---
  // Өндөр serviceLevel + урт cover → хуучин хурдаараа захиалсаар → илүүдэл,
  // амьтай барааны хаягдал. serviceRate нь 0.99 (САЙН тоо, БУРУУ утга).
  {
    kind: "tune_down", mode: "auto",
    serviceLevel: 0.98, coverDays: 5,
    demandScale: [0.85, 1.15], covMultiplier: 1.1, trendPerDay: -0.0008,
    regimeStep: { daysBeforeEnd: 24, factor: 0.62, categories: ["20", "50", "60", "31"] },
    hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 5, ingestionStatus: "ok", plan: true, lowConfidenceItems: 2,
    overrideRate: 0.26, overrideSkill: 0.5, overrideBias: -0.25,
  },
  {
    kind: "tune_down", mode: "auto",
    serviceLevel: 0.98, coverDays: 5,
    demandScale: [0.8, 1.1], covMultiplier: 1.15, trendPerDay: -0.001,
    regimeStep: { daysBeforeEnd: 26, factor: 0.66, categories: ["20", "50", "31", "30"] },
    hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 6, ingestionStatus: "ok", plan: true, lowConfidenceItems: 2,
    overrideRate: 0.24, overrideSkill: 0.45, overrideBias: -0.22,
  },

  // --- slot 12-15: "хажууд нь сургууль / оффис / цэнгэлдэх" ---
  // Эдгээр дэлгүүр engine-д ХАРАГДАХГҮЙ эрэлтийн бүтэц агуулна: season.ts нь
  // зөвхөн Наадам/Шинэ жил/Цалин мэднэ, харин Лха/Баасны оргил нь 10 ангиллын
  // 3-д л үйлчилдэг тул dowFactors-д шингэж шингэлэгдэнэ.
  // Оператор эвентийн ӨМНӨ нэмж, ДАРАА нь хасна → bias бага, accuracy өндөр
  // → MANUAL.
  {
    kind: "manual_value", mode: "manual",
    serviceLevel: null, coverDays: null,
    demandScale: [0.95, 1.25], covMultiplier: 1.0, trendPerDay: 0.0003,
    regimeStep: null,
    hiddenWeekly: { dows: [3, 5], factor: 1.55, categories: ["31", "80", "30"] },
    hiddenEvents: { daysBeforeEnd: [6, 13, 27, 34], factor: 2.2, categories: ["20", "50", "60"] },
    hiddenLulls: { daysBeforeEnd: [3, 10, 20, 31, 38], factor: 0.42, categories: ["20", "50", "60"] },
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 3, ingestionStatus: "ok", plan: true, lowConfidenceItems: 0,
    overrideRate: 0.34, overrideSkill: 0.8, overrideBias: 0,
  },
  {
    kind: "manual_value", mode: "manual",
    serviceLevel: null, coverDays: null,
    demandScale: [0.9, 1.2], covMultiplier: 1.05, trendPerDay: 0.0002,
    regimeStep: null,
    hiddenWeekly: { dows: [2, 4], factor: 1.5, categories: ["31", "80"] },
    hiddenEvents: { daysBeforeEnd: [4, 11, 22, 30], factor: 2.1, categories: ["20", "50"] },
    hiddenLulls: { daysBeforeEnd: [7, 16, 25, 35, 41], factor: 0.4, categories: ["20", "50"] },
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 4, ingestionStatus: "ok", plan: true, lowConfidenceItems: 0,
    overrideRate: 0.32, overrideSkill: 0.78, overrideBias: 0,
  },
  {
    kind: "manual_value", mode: "manual",
    serviceLevel: null, coverDays: null,
    demandScale: [1.0, 1.3], covMultiplier: 1.1, trendPerDay: 0.0004,
    regimeStep: null,
    hiddenWeekly: { dows: [5, 6], factor: 1.6, categories: ["31", "80", "30"] },
    hiddenEvents: { daysBeforeEnd: [8, 15, 24, 33], factor: 2.4, categories: ["20", "50", "60"] },
    hiddenLulls: { daysBeforeEnd: [4, 12, 29], factor: 0.55, categories: ["20", "60", "50"] },
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 2, ingestionStatus: "ok", plan: true, lowConfidenceItems: 0,
    overrideRate: 0.36, overrideSkill: 0.82, overrideBias: 0,
  },
  {
    kind: "manual_value", mode: "manual",
    serviceLevel: null, coverDays: null,
    demandScale: [0.9, 1.2], covMultiplier: 1.0, trendPerDay: 0.0002,
    regimeStep: null,
    hiddenWeekly: { dows: [2, 6], factor: 1.5, categories: ["31", "80", "30"] },
    hiddenEvents: { daysBeforeEnd: [7, 14, 25, 36], factor: 2.2, categories: ["20", "50", "60"] },
    hiddenLulls: { daysBeforeEnd: [4, 11, 21, 29, 40], factor: 0.42, categories: ["20", "50", "60"] },
    historyDays: 90, endsDaysBeforeAsOf: 0, sparseBoost: 0,
    lastSyncHoursAgo: 5, ingestionStatus: "ok", plan: true, lowConfidenceItems: 0,
    overrideRate: 0.32, overrideSkill: 0.78, overrideBias: 0,
  },

  // --- slot 16-17: "2-3 долоо хоногийн өмнө нээгдсэн" ---
  // Түүх богино (< BOARD_THRESHOLDS.minHistoryDays = 21) + хэлбэлзэл өндөр
  // → DATA. lowConfidenceItems-ыг 12-оор хязгаарласан: planStore нь
  // low-confidence бараа тутамд warn дохио гаргадаг тул хязгааргүй бол
  // дохионы дараалал живнэ.
  {
    kind: "data_problem", mode: "manual",
    serviceLevel: null, coverDays: null,
    demandScale: [0.55, 0.85], covMultiplier: 2.6, trendPerDay: 0.002,
    regimeStep: null, hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 18, endsDaysBeforeAsOf: 0, sparseBoost: 0.3,
    lastSyncHoursAgo: 5, ingestionStatus: "ok", plan: true, lowConfidenceItems: 12,
    overrideRate: 0.18, overrideSkill: 0, overrideBias: 0,
  },
  {
    kind: "data_problem", mode: "manual",
    serviceLevel: null, coverDays: null,
    demandScale: [0.5, 0.8], covMultiplier: 2.8, trendPerDay: 0.0025,
    regimeStep: null, hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 16, endsDaysBeforeAsOf: 0, sparseBoost: 0.32,
    lastSyncHoursAgo: 7, ingestionStatus: "ok", plan: true, lowConfidenceItems: 12,
    overrideRate: 0.16, overrideSkill: 0, overrideBias: 0,
  },

  // --- slot 18-19: POS холболт тасарсан ---
  // fleetSummary нь `!order && staleOrOffline` үед л offline гэж үзнэ, тул
  // plan:false нь ТУЛГУУР — захиалга байвал статус чимээгүйхэн healthy болно.
  {
    kind: "offline", mode: "auto",
    serviceLevel: null, coverDays: null,
    demandScale: [0.85, 1.1], covMultiplier: 1.0, trendPerDay: 0,
    regimeStep: null, hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 86, endsDaysBeforeAsOf: 4, sparseBoost: 0,
    lastSyncHoursAgo: 60, ingestionStatus: "failed", plan: false, lowConfidenceItems: 0,
    overrideRate: 0.08, overrideSkill: 0.1, overrideBias: 0,
  },
  {
    kind: "offline", mode: "auto",
    serviceLevel: null, coverDays: null,
    demandScale: [0.8, 1.05], covMultiplier: 1.05, trendPerDay: 0,
    regimeStep: null, hiddenWeekly: null, hiddenEvents: null, hiddenLulls: null,
    historyDays: 86, endsDaysBeforeAsOf: 5, sparseBoost: 0,
    lastSyncHoursAgo: 84, ingestionStatus: "failed", plan: false, lowConfidenceItems: 0,
    overrideRate: 0.07, overrideSkill: 0.1, overrideBias: 0,
  },
] as const;

export const ARCHETYPE_LABEL: Record<ArchetypeKind, string> = {
  auto_healthy: "Автомат — эрүүл",
  tune_up: "Тохируулга ↑ (эрэлт өссөн)",
  tune_down: "Тохируулга ↓ (эрэлт буурсан)",
  manual_value: "Гараар үнэ цэнэ нэмж байна",
  data_problem: "Дата дутуу (шинэ салбар)",
  offline: "Офлайн (POS тасарсан)",
};

/** Тухайн архетипээс board-д хүлээгдэх verdict — seed-ийн хураангуйд харуулна. */
export const EXPECTED_VERDICT: Record<ArchetypeKind, string> = {
  auto_healthy: "AUTO_OK",
  tune_up: "TUNE↑",
  tune_down: "TUNE↓",
  manual_value: "MANUAL",
  data_problem: "DATA",
  offline: "DATA (offline)",
};
