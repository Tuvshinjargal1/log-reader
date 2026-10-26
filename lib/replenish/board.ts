/**
 * ШИЙДВЭРИЙН ЗУРАГЛАЛ (Decision Board) — "автомат сайн уу, гараар сайн уу,
 * эсвэл тохируулах уу?" гэсэн асуултыг 20 дэлгүүр × ~10 ангиллаар нэг дор
 * хариулна.
 *
 * ЯАГААД BACKTEST ХИЙХГҮЙ ВЭ:
 * `fleetAnalytics` → `analyzeStore` → `backtestItem` нь бараа тутамд ~68
 * хоногийн walk-forward гүйдэг. Товчны цаана байхад зөв, харин board нь хуудас
 * нээх мөчид ачаалагддаг тул сөрөг секунд байх ёстой. Тиймээс бараа тутамд
 * НЭГ pass: `forecast()`-ыг нэг удаа дуудаад бүх метрикийг түүнээс гаргана.
 *
 * ГОЛ САНАА — `biasConsistency`:
 *   Нэг талын өөрчлөлт  = параметр буруу  → параметрийг зас (TUNE)
 *   Хоёр талын өөрчлөлт = оператор моделд харагдахгүй зүйл мэднэ → хүнийг үлдээ (MANUAL)
 * Үүнгүйгээр "надад tune хий" ба "хүнд итгэ" хоёр яг адилхан харагдана
 * (хоёулаа өндөр override + өндөр accuracy).
 */
import type { Db } from "@/lib/db/index";
import type { ConfigLayer, OrderMode } from "@/lib/config/types";
import { getStoreHistory } from "@/lib/db/repositories/metrics";
import { categoryKeyOf, listItems, type ItemRow } from "@/lib/db/repositories/config";
import {
  getOperator,
  listOperatorStores,
  listStores,
  type StoreRow,
} from "@/lib/db/repositories/stores";
import { latestIngestionRun, listOpenAlerts } from "@/lib/db/repositories/ops";
import {
  densifyDaily,
  detectRegimeChange,
  forecast,
  inferStockouts,
  seasonFactor,
  toDailyPoints,
} from "@/lib/engine";
import { addDays, clamp, dateToYmd, daysBetween, dowOf } from "@/lib/engine/util";
import type { FleetStatus } from "./fleet";
import { prefetchStoreConfigs, resolveFor, storeModeOf } from "./configBulk";

// --- Verdict ---------------------------------------------------------------

export type Verdict = "AUTO_OK" | "TUNE" | "MANUAL" | "WATCH" | "DATA";
export type TuneDirection = "up" | "down" | null;

export const VERDICT_LABEL: Record<Verdict, string> = {
  AUTO_OK: "Автомат хэвээр",
  TUNE: "Тохируулга шаардлагатай",
  MANUAL: "Гараар үнэ цэнэ нэмж байна",
  WATCH: "Хянах",
  DATA: "Дата дутуу",
};

/** Хүндрэлийн дараалал — WorkQueue болон heat grid-ийн эрэмбэ. */
export const VERDICT_SEVERITY: Record<Verdict, number> = {
  TUNE: 0,
  WATCH: 1,
  DATA: 2,
  MANUAL: 3,
  AUTO_OK: 4,
};

/**
 * Босго утгууд. `serviceLevel` ±0.03 алхам ба 0.5/0.99 clamp-ыг
 * `recommendTuning` (autotune.ts:39)-ээс ХУУЛСАН — board-ын зөвлөмж ба
 * Гүйцэтгэл таб хэзээ ч зөрчилдөхгүй.
 */
export const BOARD_THRESHOLDS = {
  minItems: 5,
  minHistoryDays: 21,
  lowConfidence: 0.45,
  watchConfidence: 0.6,
  minOverrideSamples: 8,
  overrideRateManual: 0.15,
  overrideRateWatch: 0.08,
  accuracyManual: 0.6,
  accuracyTune: 0.55,
  biasOneSided: 0.55,
  serviceTune: 0.93,
  serviceWatch: 0.97,
  overstockTune: 0.6,
  overstockWatch: 0.3,
  regimeTune: 0.25,
  regimeWatch: 0.1,
  /** Ангилалд verdict өгөхөд шаардах хамгийн бага барааны тоо */
  minCategoryItems: 3,
} as const;

// --- Төрлүүд ---------------------------------------------------------------

export interface BoardMetrics {
  items: number;
  itemsSkipped: number;
  historyDays: number;
  demand: number;
  gmv: number;

  serviceRate: number;
  fillRate: number;
  overstockRatio: number;
  wasteRatio: number | null;
  wasteMnt: number;
  overstockMnt: number;
  /** Нөөц дууссанаас болж алдагдсан борлуулалт (₮) */
  lostMnt: number;
  avgConfidence: number;
  regimeShare: number;
  regimeRatio: number;

  orderLines: number;
  touchRate: number;
  overrideRate: number;
  overrideSamples: number;
  overrideAccuracy: number;
  overrideValueMnt: number;
  overrideBias: number;
  biasConsistency: number;
  autoMae: number;
  manualMae: number;
}

export interface BoardAction {
  kind: "tune" | "switch_mode" | "ingest" | "review";
  scope?: "store" | "category" | "item";
  scopeKey?: string | null;
  param?: "serviceLevel" | "coverDays";
  from?: number;
  to?: number;
  mode?: OrderMode;
  label: string;
}

export interface BoardVerdict {
  verdict: Verdict;
  score: number;
  confidenceOfVerdict: number;
  direction: TuneDirection;
  headline: string;
  reasons: string[];
  action: BoardAction | null;
  /** Эрсдэлд байгаа ₮ — WorkQueue-ийн эрэмбэ */
  impactMnt: number;
}

export interface BoardItem {
  itemCd: string;
  name: string;
  categoryKey: string;
  price: number | null;
  soldQty: number;
  mu: number;
  cov: number;
  confidence: number;
  serviceRate: number;
  overstockRatio: number;
  overrideRate: number;
  overrideAccuracy: number | null;
  overrideValueMnt: number;
  regimeChanged: boolean;
  regimeRatio: number;
  verdict: Verdict;
}

export interface BoardCategory {
  key: string;
  name: string;
  mode: OrderMode;
  modeSource: ConfigLayer;
  metrics: BoardMetrics;
  verdictInfo: BoardVerdict;
  topItems: BoardItem[];
}

export interface BoardStore {
  storeId: number;
  name: string;
  code: string | null;
  short: string;
  lat: number | null;
  lng: number | null;
  mode: OrderMode;
  modeSource: ConfigLayer;
  offline: boolean;
  lastSyncAt: string | null;
  fleetStatus: FleetStatus;
  alerts: { critical: number; warn: number };
  latestOrder: {
    id: number;
    orderDate: string;
    status: string;
    totalQty: number;
    totalAmount: number;
    lineCount: number;
  } | null;
  metrics: BoardMetrics;
  verdictInfo: BoardVerdict;
  categories: BoardCategory[];
}

export interface BoardTotals {
  stores: number;
  autoStores: number;
  manualStores: number;
  byVerdict: Record<Verdict, number>;
  metrics: BoardMetrics;
  /** ₮ босго — түүнээс дээш захиалга батлах дараалалд орно */
  approvalThreshold: number | null;
  autoVsManual: {
    autoLines: number;
    manualLines: number;
    autoMae: number;
    manualMae: number;
    manualWinRate: number;
    manualValueMnt: number;
    verdict: "manual_wins" | "auto_wins" | "mixed";
  };
}

export interface FleetTrendPoint {
  weekStart: string;
  weekEnd: string;
  label: string;
  fillRate: number;
  serviceRate: number;
  overrideRate: number;
  avgConfidence: number;
  gmv: number;
  orderLines: number;
  manualLines: number;
  /**
   * Тухайн долоо хоногт нөөц дууссан бараа-өдрийн тоо.
   *
   * Нөхөлт (fillRate) нь 99-100% хооронд байдаг тул чартад бараг хөдөлдөггүй —
   * харин нөөц дуусалт нь баярын үед 5-10 дахин өсдөг. "Цаг үеэ мэдэрч байна
   * уу?" гэдгийг ХАРУУЛАХ бодит хэмжигдэхүүн нь энэ.
   */
  stockoutDays: number;
  events: string[];
  regime: TuneDirection;
  /** Долоо хоног дуусаагүй (сүүлийн bucket) — чартад тасархай зураасаар */
  partial: boolean;
}

export interface DecisionBoard {
  asOf: string;
  windowDays: number;
  operator: { id: number; name: string; role: string } | null;
  totals: BoardTotals;
  stores: BoardStore[];
  trend: FleetTrendPoint[];
  /** Сүүлийн метрик asOf-оос хоцорсон эсэх (демог дахин seed хийх шаардлага) */
  staleSeed: boolean;
  generatedAt: string;
  computeMs: number;
}

export interface BoardOptions {
  asOf?: string;
  windowDays?: number;
  trendWeeks?: number;
  overrideWindowDays?: number;
}

const DEFAULTS = {
  windowDays: 90,
  // Захиалгын түүхтэй тэнцүү байлгана — өгөгдөлгүй долоо хоногийг "гараар
  // оролцоо 0%" гэж харуулбал чарт худал өгүүлнэ.
  trendWeeks: 8,
  overrideWindowDays: 56,
};

// --- Дотоод туслахууд ------------------------------------------------------

function emptyMetrics(): BoardMetrics {
  return {
    items: 0, itemsSkipped: 0, historyDays: 0, demand: 0, gmv: 0,
    serviceRate: 1, fillRate: 1, overstockRatio: 0, wasteRatio: null,
    wasteMnt: 0, overstockMnt: 0, lostMnt: 0, avgConfidence: 0, regimeShare: 0, regimeRatio: 1,
    orderLines: 0, touchRate: 0, overrideRate: 0, overrideSamples: 0,
    overrideAccuracy: 0.5, overrideValueMnt: 0, overrideBias: 0,
    biasConsistency: 0, autoMae: 0, manualMae: 0,
  };
}

/** Нэг барааны эрэлтээр жигнэсэн хувь нэмэр. */
interface ItemAgg {
  w: number;
  serviceRate: number;
  fillRate: number;
  overstockRatio: number;
  confidence: number;
  regimeChanged: boolean;
  regimeRatio: number;
  demand: number;
  gmv: number;
  waste: number;
  delivered: number;
  wasteMnt: number;
  overstockMnt: number;
  lostMnt: number;
}

/** Захиалгын мөрийн override статистикийн хуримтлагч. */
interface OverrideAgg {
  lines: number;
  touched: number;
  samples: number;
  wins: number;
  losses: number;
  sumDelta: number;
  sumAbsDelta: number;
  sumSuggested: number;
  sumErrAuto: number;
  sumErrManual: number;
  valueMnt: number;
}

function newOverrideAgg(): OverrideAgg {
  return {
    lines: 0, touched: 0, samples: 0, wins: 0, losses: 0,
    sumDelta: 0, sumAbsDelta: 0, sumSuggested: 0,
    sumErrAuto: 0, sumErrManual: 0, valueMnt: 0,
  };
}

function addOverride(a: OverrideAgg, b: OverrideAgg): void {
  a.lines += b.lines; a.touched += b.touched; a.samples += b.samples;
  a.wins += b.wins; a.losses += b.losses;
  a.sumDelta += b.sumDelta; a.sumAbsDelta += b.sumAbsDelta;
  a.sumSuggested += b.sumSuggested;
  a.sumErrAuto += b.sumErrAuto; a.sumErrManual += b.sumErrManual;
  a.valueMnt += b.valueMnt;
}

function buildMetrics(
  aggs: ItemAgg[],
  ov: OverrideAgg,
  itemsSkipped: number,
  historyDays: number,
): BoardMetrics {
  const m = emptyMetrics();
  m.items = aggs.length;
  m.itemsSkipped = itemsSkipped;
  m.historyDays = historyDays;

  if (aggs.length > 0) {
    // ЭРЭЛТЭЭР ЖИГНЭНЭ, хавтгай дундажаар БИШ. Эс тэгвэл sparse удаан
    // эргэлттэй бараа (тэдний serviceRate нь inferStockouts хэзээ ч flag
    // хийдэггүй тул хоосон 1.0) нь үнэхээр чухал хурдан эргэлттэйг дарна.
    let wSum = 0;
    let service = 0, fill = 0, over = 0, conf = 0, regimeW = 0, ratioW = 0;
    for (const a of aggs) {
      wSum += a.w;
      service += a.w * a.serviceRate;
      fill += a.w * a.fillRate;
      over += a.w * a.overstockRatio;
      conf += a.w * a.confidence;
      if (a.regimeChanged) regimeW += a.w;
      ratioW += a.w * a.regimeRatio;
      m.demand += a.demand;
      m.gmv += a.gmv;
      m.wasteMnt += a.wasteMnt;
      m.overstockMnt += a.overstockMnt;
      m.lostMnt += a.lostMnt;
    }
    const W = Math.max(wSum, 1e-9);
    m.serviceRate = clamp(service / W, 0, 1);
    m.fillRate = clamp(fill / W, 0, 1);
    m.overstockRatio = Math.max(0, over / W);
    m.avgConfidence = clamp(conf / W, 0, 1);
    m.regimeShare = clamp(regimeW / W, 0, 1);
    m.regimeRatio = ratioW / W;

    const waste = aggs.reduce((x, a) => x + a.waste, 0);
    const delivered = aggs.reduce((x, a) => x + a.delivered, 0);
    m.wasteRatio = delivered > 0 ? waste / delivered : null;
  }

  m.orderLines = ov.lines;
  m.touchRate = ov.lines > 0 ? ov.touched / ov.lines : 0;
  m.overrideRate = ov.lines > 0 ? ov.samples / ov.lines : 0;
  m.overrideSamples = ov.samples;
  const decided = ov.wins + ov.losses;
  m.overrideAccuracy = decided > 0 ? ov.wins / decided : 0.5;
  m.overrideValueMnt = ov.valueMnt;
  m.overrideBias = ov.sumSuggested > 0 ? ov.sumDelta / ov.sumSuggested : 0;
  m.biasConsistency = ov.sumAbsDelta > 0 ? Math.abs(ov.sumDelta) / ov.sumAbsDelta : 0;
  m.autoMae = ov.samples > 0 ? ov.sumErrAuto / ov.samples : 0;
  m.manualMae = ov.samples > 0 ? ov.sumErrManual / ov.samples : 0;
  return m;
}

// --- Verdict шийдэх --------------------------------------------------------

export interface DecideInput {
  metrics: BoardMetrics;
  mode: OrderMode;
  offline: boolean;
  scope: "store" | "category";
  scopeKey: string | null;
  config: { serviceLevel: number; coverDays: number };
  label: string;
}

const T = BOARD_THRESHOLDS;

export function decideVerdict(input: DecideInput): BoardVerdict {
  const { metrics: m, mode, offline, scope, scopeKey, config } = input;
  const reasons: string[] = [];

  const score = Math.round(
    100 *
      clamp(
        0.45 * m.fillRate +
          0.2 * (1 - Math.min(m.overstockRatio, 1)) +
          0.2 * m.avgConfidence +
          0.15 * m.serviceRate,
        0,
        1,
      ),
  );
  const confidenceOfVerdict = clamp(
    Math.min(m.items / 20, 1) *
      Math.min(m.historyDays / 60, 1) *
      (m.overrideSamples >= T.minOverrideSamples ? 1 : 0.7),
    0,
    1,
  );

  // Эрсдэлд байгаа ₮ — ширхэгээс тооцно, GMV-ийн хувиас БИШ.
  // Илүүдэл нөөц нь алдагдал биш, зөвхөн гацсан хөрөнгө тул 15%-иар (жилийн
  // ~50% хадгалалтын зардлыг 90 хоногт шилжүүлсэн) оруулна.
  const impactMnt = Math.round(m.lostMnt + m.wasteMnt + 0.15 * m.overstockMnt);

  const base = { score, confidenceOfVerdict, impactMnt };

  // 1) DATA — шийдвэр гаргах үндэслэл хүрэлцэхгүй
  if (
    offline ||
    m.items < (scope === "category" ? T.minCategoryItems : T.minItems) ||
    m.historyDays < T.minHistoryDays ||
    m.avgConfidence < T.lowConfidence
  ) {
    if (offline) reasons.push("POS холболт тасарсан — шинэ дата ирэхгүй байна");
    if (m.items < T.minItems) reasons.push(`Хэмжих бараа цөөн (${m.items})`);
    if (m.historyDays < T.minHistoryDays)
      reasons.push(`Түүх богино (${m.historyDays} хоног)`);
    if (m.avgConfidence < T.lowConfidence)
      reasons.push(`Прогнозын итгэлцэл ${(m.avgConfidence * 100).toFixed(0)}%`);
    return {
      ...base,
      verdict: "DATA",
      direction: null,
      headline: offline
        ? "Дата ирэхгүй байна — POS холболтоо шалгана уу"
        : "Дата дутуу — шийдвэр гаргах үндэслэл хүрэлцэхгүй",
      reasons,
      action: { kind: "ingest", label: offline ? "Холболт шалгах" : "Дата татах" },
    };
  }

  const oneSidedOverride =
    m.overrideSamples >= T.minOverrideSamples &&
    m.overrideRate >= T.overrideRateManual &&
    m.overrideAccuracy >= T.accuracyTune &&
    m.biasConsistency >= T.biasOneSided;

  // 2) TUNE — параметр буруу
  if (
    m.serviceRate < T.serviceTune ||
    m.overstockRatio > T.overstockTune ||
    m.regimeShare > T.regimeTune ||
    oneSidedOverride
  ) {
    const up = m.serviceRate < T.serviceTune || m.regimeRatio > 1 || m.overrideBias > 0;
    const direction: TuneDirection = up ? "up" : "down";

    if (m.serviceRate < T.serviceTune)
      reasons.push(`Нөхөлт ${(m.serviceRate * 100).toFixed(0)}% — зорилтоос доогуур`);
    if (m.overstockRatio > T.overstockTune)
      reasons.push(`Илүүдэл нөөц эрэлтийн ${(m.overstockRatio * 100).toFixed(0)}%`);
    if (m.regimeShare > T.regimeTune)
      reasons.push(
        `Эрэлт ${m.regimeRatio >= 1 ? "өссөн" : "буурсан"} (${(m.regimeRatio * 100 - 100).toFixed(0)}%) — түвшин өөрчлөгдсөн`,
      );
    if (oneSidedOverride)
      reasons.push(
        `Гараар өөрчлөлтийн ${(m.biasConsistency * 100).toFixed(0)}% нь НЭГ ЧИГТ — параметр буруу байна`,
      );

    const to = clamp(
      Math.round((config.serviceLevel + (up ? 0.03 : -0.03)) * 100) / 100,
      0.5,
      0.99,
    );
    return {
      ...base,
      verdict: "TUNE",
      direction,
      headline: oneSidedOverride
        ? "Оператор зөв — гэхдээ ҮРГЭЛЖ нэг чигт. Гараар хийхийн оронд параметрээ зас."
        : up
          ? "Нөөцлөлт дутуу — үйлчилгээний түвшин нэмэх"
          : "Илүүдэл нөөц — үйлчилгээний түвшин бууруулах",
      reasons,
      action:
        to !== config.serviceLevel
          ? {
              kind: "tune",
              scope,
              scopeKey,
              param: "serviceLevel",
              from: config.serviceLevel,
              to,
              label: `Үйлчилгээний түвшин ${config.serviceLevel} → ${to}`,
            }
          : null,
    };
  }

  // 3) MANUAL — оператор моделд харагдахгүй зүйл мэднэ
  if (
    m.overrideSamples >= T.minOverrideSamples &&
    m.overrideRate >= T.overrideRateManual &&
    m.overrideAccuracy >= T.accuracyManual &&
    m.biasConsistency < T.biasOneSided &&
    m.overrideValueMnt > 0
  ) {
    reasons.push(
      `Гараар өөрчлөлтийн ${(m.overrideAccuracy * 100).toFixed(0)}% нь борлуулалтаар зөв гарсан`,
    );
    reasons.push(
      `Өөрчлөлт ХОЁР ТАЛЫН (${(m.biasConsistency * 100).toFixed(0)}%) — системд харагдахгүй мэдээлэл`,
    );
    return {
      ...base,
      verdict: "MANUAL",
      direction: null,
      headline: `Гараар үнэ цэнэ нэмж байна — ${Math.round(m.overrideValueMnt).toLocaleString("mn-MN")}₮`,
      reasons,
      // Engine-ийг дийлж байгаа дэлгүүрийг ХЭЗЭЭ Ч автомат болгож болохгүй
      action: { kind: "review", label: "Ямар мэдээлэл нөлөөлж байгааг тодруулах" },
    };
  }

  // 4) WATCH
  //
  // ⚠️ Гараар оролцооны хувийг АНГИЛЛЫН түвшинд WATCH-ийн шалгуур болгохгүй.
  // Ангилалд 4-6 бараа л байдаг тул 8%-ийн босго нь бараг үргэлж давагдана
  // (флотын дундаж 14%) — үр дүнд heat grid-ийн бараг бүх нүд "Хянах" болж
  // улаанаар дүүрч, сайн ажиллаж байгаа дэлгүүрүүд ч гал авалзсан шиг
  // харагдана. Оролцооны хувь нь ДЭЛГҮҮРИЙН түвшинд л статистик утгатай.
  const overrideWatch =
    scope === "store" && m.overrideRate >= T.overrideRateWatch;

  if (
    m.serviceRate < T.serviceWatch ||
    m.overstockRatio > T.overstockWatch ||
    overrideWatch ||
    m.regimeShare > T.regimeWatch ||
    m.avgConfidence < T.watchConfidence
  ) {
    if (m.serviceRate < T.serviceWatch)
      reasons.push(`Нөхөлт ${(m.serviceRate * 100).toFixed(0)}%`);
    if (m.overstockRatio > T.overstockWatch)
      reasons.push(`Илүүдэл ${(m.overstockRatio * 100).toFixed(0)}%`);
    if (overrideWatch)
      reasons.push(`Гараар оролцоо ${(m.overrideRate * 100).toFixed(0)}%`);
    if (m.regimeShare > T.regimeWatch)
      reasons.push(`Эрэлтийн түвшин хөдөлсөн (${(m.regimeShare * 100).toFixed(0)}%)`);
    if (m.avgConfidence < T.watchConfidence)
      reasons.push(`Итгэлцэл ${(m.avgConfidence * 100).toFixed(0)}%`);
    return {
      ...base,
      verdict: "WATCH",
      direction: null,
      headline: "Хянах — тодорхой шийдвэр гаргах хэмжээнд хүрээгүй",
      reasons,
      action: null,
    };
  }

  // 5) AUTO_OK
  reasons.push(`Нөхөлт ${(m.serviceRate * 100).toFixed(0)}%, илүүдэл бага`);
  if (m.overrideRate > 0 && m.overrideAccuracy < 0.5) {
    reasons.push(
      `Гараар оролцоо (${(m.overrideRate * 100).toFixed(0)}%) үр дүнг САЙЖРУУЛААГҮЙ — хэрэггүй ажил`,
    );
  }
  return {
    ...base,
    verdict: "AUTO_OK",
    direction: null,
    headline:
      mode === "manual"
        ? "Автомат болгож болно — систем аль хэдийн зөв тооцоолж байна"
        : "Автомат хэвээр — сайн ажиллаж байна",
    reasons,
    action:
      mode === "manual"
        ? { kind: "switch_mode", mode: "auto", scope, scopeKey, label: "Автомат болгох" }
        : null,
  };
}

// --- Гол функц -------------------------------------------------------------

interface LineRow {
  order_id: number;
  store_id: number;
  order_date: string;
  item_cd: string;
  category_key: string | null;
  price: number | null;
  suggested_qty: number;
  final_qty: number;
  decided_by: string;
  factors_snapshot: string | null;
}

export function buildDecisionBoard(
  db: Db,
  operatorId?: number | null,
  opts: BoardOptions = {},
): DecisionBoard {
  const t0 = Date.now();
  const windowDays = opts.windowDays ?? DEFAULTS.windowDays;
  const trendWeeks = opts.trendWeeks ?? DEFAULTS.trendWeeks;
  const overrideWindowDays = opts.overrideWindowDays ?? DEFAULTS.overrideWindowDays;

  const maxD = (
    db.prepare("SELECT MAX(d) AS d FROM daily_metrics").get() as { d: string | null }
  ).d;
  const asOf = opts.asOf ?? maxD ?? "20260101";

  const storeRows: StoreRow[] =
    operatorId != null ? listOperatorStores(db, operatorId) : listStores(db);
  const operatorRow = operatorId != null ? getOperator(db, operatorId) : null;

  const from = addDays(asOf, -(windowDays - 1));
  const overrideFrom = addDays(asOf, -overrideWindowDays);
  const openAlerts = listOpenAlerts(db);

  const stores: BoardStore[] = [];
  const fleetAggs: ItemAgg[] = [];
  const fleetOv = newOverrideAgg();
  let fleetHistoryDays = 0;
  let fleetSkipped = 0;

  // Долоо хоногийн хувиарлалт (trend) — нэмэлт query ХИЙХГҮЙ, ижил түүхээс.
  const weeks = buildWeekBuckets(asOf, trendWeeks);
  const weekOf = (d: string): number => {
    for (let i = 0; i < weeks.length; i++) {
      if (d >= weeks[i].weekStart && d <= weeks[i].weekEnd) return i;
    }
    return -1;
  };
  const weekAcc = weeks.map(() => ({
    sold: 0, unmet: 0, stockoutDays: 0, days: 0, gmv: 0,
    conf: 0, confW: 0, lines: 0, manualLines: 0,
  }));

  let approvalThreshold: number | null = null;

  for (const s of storeRows) {
    const bundle = prefetchStoreConfigs(db, s.id);
    if (approvalThreshold == null) {
      approvalThreshold =
        bundle.store?.autoSubmitMaxAmount ?? bundle.global.autoSubmitMaxAmount ?? null;
    }
    const { mode: storeMode, source: modeSource } = storeModeOf(bundle);

    const history = getStoreHistory(db, s.id, from, asOf);
    const items = new Map(listItems(db, s.id).map((it) => [it.itemCd, it]));

    // --- Захиалгын мөр: НЭГ query, N+1 үгүй ---
    const lineRows = db
      .prepare(
        `SELECT o.id AS order_id, o.store_id, o.order_date, l.item_cd, l.category_key,
                l.price, l.suggested_qty, l.final_qty, l.decided_by, l.factors_snapshot
           FROM orders o JOIN order_lines l ON l.order_id = o.id
          WHERE o.store_id = ? AND o.order_date BETWEEN ? AND ?`,
      )
      .all(s.id, overrideFrom, asOf) as unknown as LineRow[];

    // Долоо хоногийн мөрийн тоо (trend)
    for (const l of lineRows) {
      const wi = weekOf(l.order_date);
      if (wi >= 0) {
        weekAcc[wi].lines++;
        if (Math.abs(l.final_qty - l.suggested_qty) > 1e-6) weekAcc[wi].manualLines++;
      }
    }

    // Бодит эрэлтийн индекс (storeId доторх): itemCd → ymd → {sold, stockout, mu}
    const realized = new Map<string, Map<string, { sold: number; stockout: boolean }>>();

    // --- Бараа тус бүрийн нэг pass ---
    const perItem = new Map<
      string,
      { agg: ItemAgg; f: ReturnType<typeof forecast>; item: ItemRow; P: number; price: number }
    >();
    const byCategory = new Map<string, { aggs: ItemAgg[]; ov: OverrideAgg; items: BoardItem[]; name: string }>();
    let storeSkipped = 0;
    let storeHistoryDays = 0;

    for (const [itemCd, raw] of history) {
      const item = items.get(itemCd);
      if (!item) { storeSkipped++; continue; }

      const dense = densifyDaily(toDailyPoints(raw));
      if (dense.length < 7) { storeSkipped++; continue; }
      const pts = inferStockouts(dense);
      const f = forecast(pts, asOf);
      const rg = detectRegimeChange(pts, asOf, 14);
      const cfg = resolveFor(bundle, item).value;
      const P = Math.max(1, cfg.reviewPeriodDays) + Math.max(0, cfg.leadTimeDays);
      const price = item.price ?? 0;

      storeHistoryDays = Math.max(storeHistoryDays, dense.length);

      // Индекс — мөр тутамд query явуулбал 24,000 query болно
      const dayMap = new Map<string, { sold: number; stockout: boolean }>();
      for (const p of pts) dayMap.set(p.d, { sold: p.soldQty, stockout: p.stockout });
      realized.set(itemCd, dayMap);

      const soldQty = raw.reduce((a, r) => a + r.soldQty, 0);
      const gmv = raw.reduce((a, r) => a + r.soldAmt, 0);
      const waste = raw.reduce((a, r) => a + (r.wasteQty ?? 0), 0);
      const delivered = raw.reduce((a, r) => a + (r.deliveredQty ?? 0), 0);

      // Сүүлийн null биш on_hand_end — latestOnHand-ыг бараа тутамд дуудвал
      // 1,000 нэмэлт query болно, харин утга нь татсан мөрүүдэд аль хэдийн бий.
      let onHand = 0;
      for (let i = raw.length - 1; i >= 0; i--) {
        if (raw[i].onHandEnd != null) { onHand = raw[i].onHandEnd as number; break; }
      }

      const serviceRate = 1 - f.stockoutDays / Math.max(1, f.lookbackDays);
      const unmet = f.stockoutDays * f.baseDailyDemand;
      const fillRate = soldQty + unmet > 0 ? soldQty / (soldQty + unmet) : 1;
      const overstockRatio = clamp(
        (onHand / Math.max(f.baseDailyDemand, 0.05) - P) / Math.max(P, 1),
        0,
        2,
      );

      const agg: ItemAgg = {
        w: Math.max(f.baseDailyDemand * P, 0.1),
        serviceRate, fillRate, overstockRatio,
        confidence: f.confidence,
        regimeChanged: rg.changed,
        regimeRatio: rg.ratio,
        demand: soldQty,
        gmv,
        waste, delivered,
        wasteMnt: waste * price,
        overstockMnt: Math.max(0, onHand - f.baseDailyDemand * P) * price,
        lostMnt: unmet * price,
      };

      perItem.set(itemCd, { agg, f, item, P, price });
      fleetAggs.push(agg);

      const catKey = categoryKeyOf(item);
      let cat = byCategory.get(catKey);
      if (!cat) {
        cat = { aggs: [], ov: newOverrideAgg(), items: [], name: item.mclsNm ?? "Ангилалгүй" };
        byCategory.set(catKey, cat);
      }
      cat.aggs.push(agg);

      // Долоо хоногийн нэгтгэл
      for (const r of raw) {
        const wi = weekOf(r.d);
        if (wi < 0) continue;
        const w = weekAcc[wi];
        w.sold += r.soldQty;
        w.gmv += r.soldAmt;
        w.days++;
        if (r.stockoutFlag) {
          w.stockoutDays++;
          w.unmet += f.baseDailyDemand;
        }
        w.conf += f.confidence * Math.max(f.baseDailyDemand, 0.1);
        w.confW += Math.max(f.baseDailyDemand, 0.1);
      }
    }

    // --- Override статистик ---
    const storeOv = newOverrideAgg();
    const itemOv = new Map<string, OverrideAgg>();

    for (const l of lineRows) {
      const info = perItem.get(l.item_cd);
      if (!info) continue;
      const catKey = l.category_key ?? categoryKeyOf(info.item);
      const cat = byCategory.get(catKey);

      const perItemAgg = itemOv.get(l.item_cd) ?? newOverrideAgg();
      itemOv.set(l.item_cd, perItemAgg);

      const one = newOverrideAgg();
      one.lines = 1;
      if (l.decided_by === "manual") one.touched = 1;

      const delta = l.final_qty - l.suggested_qty;
      one.sumSuggested = l.suggested_qty;

      if (Math.abs(delta) > 1e-6) {
        // Хамгаалалтын цонх ба нөөцийн байрлалыг мөрийн snapshot-оос авна
        let P = info.P;
        let ip = 0;
        if (l.factors_snapshot) {
          try {
            const fs = JSON.parse(l.factors_snapshot) as {
              protectionDays?: number;
              inventoryPosition?: number;
            };
            if (typeof fs.protectionDays === "number" && fs.protectionDays > 0) P = fs.protectionDays;
            if (typeof fs.inventoryPosition === "number") ip = fs.inventoryPosition;
          } catch { /* хуучин формат — config-ын P-г ашиглана */ }
        }

        // Бодит эрэлт: D+1 … D+P. Нөөц дууссан өдөрт μ-ээр орлуулна — энэ нь
        // forecast-ын censoring залруулгатай ижил. Үүнгүйгээр илүү ЗӨВ (их)
        // захиалсан гараар мөр нь тайрсан борлуулалттай харьцуулагдаж, буруу
        // харагдана.
        const dayMap = realized.get(l.item_cd);
        let realizedQty = 0;
        for (let k = 1; k <= P; k++) {
          const d = addDays(l.order_date, k);
          const rec = dayMap?.get(d);
          if (!rec) continue;
          realizedQty += rec.stockout ? Math.max(rec.sold, info.f.baseDailyDemand) : rec.sold;
        }

        // ⚠️ Захиалгын тоог БОДИТ ЭРЭЛТТЭЙ шууд жишиж БОЛОХГҮЙ. `suggested` нь
        // (R,S) бодлогын `S − IP`, өөрөөр хэлбэл БАЙГАА нөөцөө хассан тоо.
        // Нөөцийг оруулахгүй бол хоёулаа эрэлтээс хамаагүй бага гарч, "илүү их
        // захиалсан нь үргэлж хожно" гэсэн хазайлт үүсдэг — тэгвэл нэг талын
        // (үргэлж нэмдэг) оператор зохиомлоор сайн, харин хоёр талын оператор
        // зоос шидсэнтэй адил харагдана.
        // Зөв харьцуулалт: захиалсны дараах нөөцийн байрлал vs P хоногийн эрэлт.
        const errAuto = Math.abs(ip + l.suggested_qty - realizedQty);
        const errManual = Math.abs(ip + l.final_qty - realizedQty);
        const tol = Math.max(0.5, 0.05 * realizedQty);

        one.samples = 1;
        one.sumDelta = delta;
        one.sumAbsDelta = Math.abs(delta);
        one.sumErrAuto = errAuto;
        one.sumErrManual = errManual;
        one.valueMnt = (errAuto - errManual) * (l.price ?? 0);
        if (errManual < errAuto - tol) one.wins = 1;
        else if (errManual > errAuto + tol) one.losses = 1;
      }

      addOverride(storeOv, one);
      addOverride(perItemAgg, one);
      if (cat) addOverride(cat.ov, one);
      addOverride(fleetOv, one);
    }

    // Офлайн эсэхийг ангиллын verdict-ээс ӨМНӨ тодорхойлно: хуучирсан датан
    // дээр ангилал тус бүрд "бүх зүйл сайн" гэж бат итгэлтэй дүгнэлт гаргавал
    // дэлгүүрийн "Дата дутуу" төлөвтэй зөрчилдөж, heat grid-ийн мөр нь ✓-ээр
    // дүүрч, POS тасарсныг нуух болно.
    const run = latestIngestionRun(db, s.id);
    const STALE_MS = 1000 * 60 * 60 * 36;
    const offline =
      !s.lastSyncAt ||
      run?.status === "failed" ||
      Date.now() - new Date(s.lastSyncAt).getTime() > STALE_MS;

    // --- Ангиллын verdict ---
    const categories: BoardCategory[] = [];
    for (const [key, c] of byCategory) {
      const cm = buildMetrics(c.aggs, c.ov, 0, storeHistoryDays);
      const catCfgRow = bundle.categories.get(key);
      const catMode: OrderMode = catCfgRow?.mode ?? storeMode;
      const catModeSource: ConfigLayer = catCfgRow?.mode ? "category" : modeSource;
      const cfgForCat = {
        serviceLevel: catCfgRow?.serviceLevel ?? bundle.store?.serviceLevel ?? bundle.global.serviceLevel,
        coverDays: catCfgRow?.coverDays ?? bundle.store?.coverDays ?? bundle.global.coverDays,
      };

      // Ангиллын доторх бараануудыг эрсдэлээр эрэмбэлж дээд 5-ыг авна
      const topItems: BoardItem[] = [];
      for (const [itemCd, info] of perItem) {
        if (categoryKeyOf(info.item) !== key) continue;
        const io = itemOv.get(itemCd) ?? newOverrideAgg();
        const decided = io.wins + io.losses;
        topItems.push({
          itemCd,
          name: info.item.name,
          categoryKey: key,
          price: info.item.price,
          soldQty: Math.round(info.agg.demand),
          mu: Math.round(info.f.baseDailyDemand * 10) / 10,
          cov: Math.round(info.f.cov * 100) / 100,
          confidence: Math.round(info.f.confidence * 100) / 100,
          serviceRate: info.agg.serviceRate,
          overstockRatio: info.agg.overstockRatio,
          overrideRate: io.lines > 0 ? io.samples / io.lines : 0,
          overrideAccuracy: decided > 0 ? io.wins / decided : null,
          overrideValueMnt: io.valueMnt,
          regimeChanged: info.agg.regimeChanged,
          regimeRatio: info.agg.regimeRatio,
          verdict:
            info.agg.serviceRate < T.serviceTune
              ? "TUNE"
              : info.f.confidence < T.lowConfidence
                ? "DATA"
                : info.agg.overstockRatio > T.overstockTune
                  ? "TUNE"
                  : "AUTO_OK",
        });
      }
      topItems.sort((a, b) => b.soldQty - a.soldQty);

      categories.push({
        key,
        name: c.name,
        mode: catMode,
        modeSource: catModeSource,
        metrics: cm,
        verdictInfo: decideVerdict({
          metrics: cm,
          mode: catMode,
          offline,
          scope: "category",
          scopeKey: key,
          config: cfgForCat,
          label: c.name,
        }),
        topItems: topItems.slice(0, 5),
      });
    }
    categories.sort(
      (a, b) =>
        VERDICT_SEVERITY[a.verdictInfo.verdict] - VERDICT_SEVERITY[b.verdictInfo.verdict] ||
        b.metrics.gmv - a.metrics.gmv,
    );

    // --- Дэлгүүрийн verdict ---
    const storeAggs = [...perItem.values()].map((v) => v.agg);
    const sm = buildMetrics(storeAggs, storeOv, storeSkipped, storeHistoryDays);
    fleetHistoryDays = Math.max(fleetHistoryDays, storeHistoryDays);
    fleetSkipped += storeSkipped;

    const orderRow = db
      .prepare(
        `SELECT o.id, o.order_date, o.status, o.total_qty, o.total_amount,
                (SELECT COUNT(1) FROM order_lines l WHERE l.order_id = o.id) AS line_count
           FROM orders o WHERE o.store_id = ? ORDER BY o.id DESC LIMIT 1`,
      )
      .get(s.id) as
      | { id: number; order_date: string; status: string; total_qty: number; total_amount: number; line_count: number }
      | undefined;

    const sa = openAlerts.filter((a) => a.storeId === s.id);
    const critical = sa.filter((a) => a.severity === "critical").length;
    const warn = sa.filter((a) => a.severity === "warn").length;

    let fleetStatus: FleetStatus;
    if (!orderRow && offline) fleetStatus = "offline";
    else if (critical > 0) fleetStatus = "stockout";
    else if (warn > 0) fleetStatus = "tuning";
    else fleetStatus = "healthy";

    stores.push({
      storeId: s.id,
      name: s.name,
      code: s.code,
      short: shortLabel(s.name, s.code),
      lat: s.lat,
      lng: s.lng,
      mode: storeMode,
      modeSource,
      offline,
      lastSyncAt: s.lastSyncAt,
      fleetStatus,
      alerts: { critical, warn },
      latestOrder: orderRow
        ? {
            id: Number(orderRow.id),
            orderDate: orderRow.order_date,
            status: orderRow.status,
            totalQty: orderRow.total_qty,
            totalAmount: orderRow.total_amount,
            lineCount: Number(orderRow.line_count),
          }
        : null,
      metrics: sm,
      verdictInfo: decideVerdict({
        metrics: sm,
        mode: storeMode,
        offline,
        scope: "store",
        scopeKey: null,
        config: {
          serviceLevel: bundle.store?.serviceLevel ?? bundle.global.serviceLevel,
          coverDays: bundle.store?.coverDays ?? bundle.global.coverDays,
        },
        label: s.name,
      }),
      categories,
    });
  }

  // --- Флотын нийлбэр ---
  const fleetMetrics = buildMetrics(fleetAggs, fleetOv, fleetSkipped, fleetHistoryDays);
  const byVerdict: Record<Verdict, number> = { AUTO_OK: 0, TUNE: 0, MANUAL: 0, WATCH: 0, DATA: 0 };
  for (const s of stores) byVerdict[s.verdictInfo.verdict]++;

  const manualWinRate = fleetMetrics.overrideAccuracy;
  const maeDiff =
    fleetMetrics.autoMae > 0
      ? (fleetMetrics.autoMae - fleetMetrics.manualMae) / fleetMetrics.autoMae
      : 0;

  const totals: BoardTotals = {
    stores: stores.length,
    autoStores: stores.filter((s) => s.mode === "auto").length,
    manualStores: stores.filter((s) => s.mode === "manual").length,
    byVerdict,
    metrics: fleetMetrics,
    approvalThreshold,
    autoVsManual: {
      autoLines: fleetOv.lines - fleetOv.samples,
      manualLines: fleetOv.samples,
      autoMae: fleetMetrics.autoMae,
      manualMae: fleetMetrics.manualMae,
      manualWinRate,
      manualValueMnt: fleetMetrics.overrideValueMnt,
      verdict: maeDiff > 0.05 ? "manual_wins" : maeDiff < -0.05 ? "auto_wins" : "mixed",
    },
  };

  const trend: FleetTrendPoint[] = weeks.map((w, i) => {
    const acc = weekAcc[i];
    const fillRate = acc.sold + acc.unmet > 0 ? acc.sold / (acc.sold + acc.unmet) : 1;
    return {
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      label: `${w.weekStart.slice(4, 6)}/${w.weekStart.slice(6, 8)}`,
      fillRate: clamp(fillRate, 0, 1),
      serviceRate: clamp(acc.days > 0 ? 1 - acc.stockoutDays / acc.days : 1, 0, 1),
      overrideRate: acc.lines > 0 ? acc.manualLines / acc.lines : 0,
      avgConfidence: acc.confW > 0 ? clamp(acc.conf / acc.confW, 0, 1) : fleetMetrics.avgConfidence,
      gmv: acc.gmv,
      orderLines: acc.lines,
      manualLines: acc.manualLines,
      stockoutDays: acc.stockoutDays,
      events: w.events,
      regime: null,
      partial: w.weekEnd > asOf,
    };
  });
  markTrendRegimes(trend);

  return {
    asOf,
    windowDays,
    operator: operatorRow
      ? { id: operatorRow.id, name: operatorRow.name, role: operatorRow.role }
      : null,
    totals,
    stores,
    trend,
    // Хамгийн сүүлийн дата ХЭР ХУУЧИРСАН — `asOf`-той БИШ, БОДИТ өнөөдөртэй
    // жишнэ. `asOf` нь өгөгдөөгүй үедээ `maxD` өөрөө болдог тул asOf-той
    // харьцуулах нь ҮРГЭЛЖ false буцаадаг байсан (үхмэл нөхцөл). Үүний улмаас
    // seed хуучирахад сануулга гарахын оронд `lastSyncAt` 36 цагийн босгыг
    // давж, БҮХ дэлгүүр чимээгүйхэн "Дата дутуу (офлайн)" болж хувирдаг байв.
    // Тодорхой asOf өгсөн бол тэр нь түүхэн харагдац тул түүнийг цаг болгоно.
    staleSeed: maxD != null && maxD < addDays(opts.asOf ?? dateToYmd(new Date()), -1),
    generatedAt: new Date().toISOString(),
    computeMs: Date.now() - t0,
  };
}

// --- Trend туслахууд -------------------------------------------------------

interface WeekBucket {
  weekStart: string;
  weekEnd: string;
  events: string[];
}

/** Даваа-гаас эхэлсэн N долоо хоног, хамгийн сүүлийнх нь asOf-ыг агуулна. */
function buildWeekBuckets(asOf: string, count: number): WeekBucket[] {
  const dow = dowOf(asOf); // 0 = Ням
  const backToMonday = dow === 0 ? 6 : dow - 1;
  const lastMonday = addDays(asOf, -backToMonday);

  const out: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = addDays(lastMonday, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    // Хуанлийн эвентийг ЭНГИЙН `seasonFactor`-оос авна — чартын тэмдэглэгээ нь
    // engine үнэхээр хэрэглэсэн коэффициент байх ёстой, тусдаа хуанли биш.
    const events = new Set<string>();
    for (let k = 0; k < 7; k++) {
      const label = seasonFactor(addDays(weekStart, k)).label;
      if (label) events.add(label);
    }
    out.push({ weekStart, weekEnd, events: [...events] });
  }
  return out;
}

/**
 * Долоо хоногийн эрэлтийг өмнөх 4 долоо хоногийн дундажтай харьцуулж ±25%
 * хазайлтыг тэмдэглэнэ.
 *
 * `detectRegimeChange`-ыг ЭНД хэрэглэхгүй: тэр нь нэг барааны `asOf`-relative
 * "сүүлийн vs өмнөх" хуваалт хийдэг тул долоо хоног бүрт ижил хариу өгнө.
 */
function markTrendRegimes(trend: FleetTrendPoint[]): void {
  // ӨДРИЙН дунджаар харьцуулна — дуусаагүй сүүлийн долоо хоног нийт дүнгээрээ
  // жижиг гардаг тул нийлбэрээр жишвэл худал "эрэлт унасан" гэж тэмдэглэнэ.
  const perDay = (p: FleetTrendPoint): number => {
    const days = Math.max(1, daysBetween(p.weekStart, p.weekEnd) + 1);
    return p.gmv / days;
  };
  for (let i = 4; i < trend.length; i++) {
    if (trend[i].partial) continue;
    const base = trend.slice(i - 4, i).reduce((a, p) => a + perDay(p), 0) / 4;
    if (base <= 0) continue;
    const ratio = perDay(trend[i]) / base;
    if (ratio >= 1.25) trend[i].regime = "up";
    else if (ratio <= 0.75) trend[i].regime = "down";
  }
}

/** Бөмбөлөг дээрх 2-3 тэмдэгтийн шошго. */
function shortLabel(name: string, code: string | null): string {
  const cleaned = name.replace(/^GS25\s*/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (cleaned.length >= 2) return cleaned.slice(0, 2).toUpperCase();
  return code?.slice(-2) ?? "??";
}

// --- Кэш -------------------------------------------------------------------

declare global {
  var __boardCache: Map<string, { at: number; board: DecisionBoard }> | undefined;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 8;

function cacheStore(): Map<string, { at: number; board: DecisionBoard }> {
  // globalThis — Next dev нь HMR үед route модулийг дахин үнэлдэг тул
  // module-level const кэш чимээгүйхэн алга болно.
  if (!globalThis.__boardCache) globalThis.__boardCache = new Map();
  return globalThis.__boardCache;
}

export function cachedBoard(
  db: Db,
  operatorId: number | null,
  opts: BoardOptions,
  refresh: boolean,
): { board: DecisionBoard; cached: boolean; ageMs: number } {
  const key = `${operatorId ?? "all"}|${opts.asOf ?? "auto"}|${opts.windowDays ?? DEFAULTS.windowDays}|${opts.trendWeeks ?? DEFAULTS.trendWeeks}`;
  const cache = cacheStore();
  const hit = cache.get(key);
  const now = Date.now();

  if (!refresh && hit && now - hit.at < TTL_MS) {
    return { board: hit.board, cached: true, ageMs: now - hit.at };
  }

  const board = buildDecisionBoard(db, operatorId, opts);
  cache.set(key, { at: now, board });
  while (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    cache.delete(oldest[0]);
  }
  return { board, cached: false, ageMs: 0 };
}

export function invalidateBoardCache(): void {
  globalThis.__boardCache?.clear();
}

/** daysBetween-ыг re-export — insights.ts-д хэрэгтэй. */
export { daysBetween };
