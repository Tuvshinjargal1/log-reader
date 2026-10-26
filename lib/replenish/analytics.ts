/**
 * Аналитик — backtest-ийг бараа/дэлгүүр/fleet түвшинд нэгтгэж KPI, эрүүл мэнд,
 * AUTO-vs-baseline нотолгооны тайлан, улирлын профайл гаргана. Зөвхөн хадгалсан
 * daily_metrics дээр ажиллана (live POS шаардахгүй).
 */
import type { Db } from "@/lib/db/index";
import { getStore, listStores } from "@/lib/db/repositories/stores";
import { listItems, resolveItemConfig, categoryKeyOf } from "@/lib/db/repositories/config";
import { getStoreHistory, storeAggregates } from "@/lib/db/repositories/metrics";
import {
  backtestItem,
  computeHealth,
  computeSeasonality,
  densifyDaily,
  detectRegimeChange,
  forecast,
  inferStockouts,
  recommendTuning,
  toDailyPoints,
  type BacktestResult,
  type HealthResult,
  type SeasonalityProfile,
  type TuneRecommendation,
} from "@/lib/engine";
import { addDays } from "@/lib/engine/util";
import type { DailyPoint } from "@/lib/engine/types";

const MIN_POINTS = 12; // тасралтгүй болгосны дараах доод хоног
const MIN_TOTAL_SOLD = 10;

export interface ItemAnalysis {
  itemCd: string;
  name: string;
  categoryKey: string;
  categoryNm: string;
  price: number | null;
  totalSold: number;
  confidence: number;
  backtest: BacktestResult;
  health: HealthResult;
  tuning: TuneRecommendation[];
}

export interface StoreKpi {
  itemsAnalyzed: number;
  engineFillRate: number;
  baselineFillRate: number;
  engineServiceLevel: number;
  baselineServiceLevel: number;
  lostSalesAvoided: number;
  overstockReduced: number;
  gmv: number;
  wastePct: number | null;
  health: { good: number; watch: number; poor: number };
}

export interface StoreAnalysis {
  storeId: number;
  name: string;
  kpi: StoreKpi;
  items: ItemAnalysis[];
  seasonality: SeasonalityProfile;
}

interface AnalyzeOptions {
  asOf: string;
  lookbackDays?: number;
  maxItems?: number; // fleet KPI-д хурдасгах cap (борлуулалтаар эрэмбэлж)
}

function buildStoreSeasonalitySeries(
  history: Map<string, { d: string; soldQty: number }[]>,
): DailyPoint[] {
  const byDate = new Map<string, number>();
  for (const points of history.values()) {
    for (const p of points) {
      byDate.set(p.d, (byDate.get(p.d) ?? 0) + p.soldQty);
    }
  }
  return [...byDate.entries()]
    .map(([d, soldQty]) => ({ d, soldQty, stockout: false }))
    .sort((a, b) => a.d.localeCompare(b.d));
}

export function analyzeStore(
  db: Db,
  storeId: number,
  opts: AnalyzeOptions,
): StoreAnalysis {
  const store = getStore(db, storeId);
  if (!store) throw new Error(`Дэлгүүр олдсонгүй: ${storeId}`);

  const lookback = opts.lookbackDays ?? 84;
  const from = addDays(opts.asOf, -(lookback - 1));
  const to = opts.asOf;

  const historyRaw = getStoreHistory(db, storeId, from, to);
  const items = new Map(listItems(db, storeId).map((it) => [it.itemCd, it]));

  // Барааг борлуулалтаар эрэмбэлж, cap байвал шүүнэ
  let entries = [...historyRaw.entries()];
  const totalSoldOf = (pts: { soldQty: number }[]) =>
    pts.reduce((a, p) => a + p.soldQty, 0);
  entries.sort((a, b) => totalSoldOf(b[1]) - totalSoldOf(a[1]));
  if (opts.maxItems) entries = entries.slice(0, opts.maxItems);

  const analyses: ItemAnalysis[] = [];
  for (const [itemCd, hist] of entries) {
    const item = items.get(itemCd);
    if (!item) continue;
    const totalSold = totalSoldOf(hist);
    // ЧУХАЛ: зарагдаагүй өдрүүдийг 0-ээр нөхөж тасралтгүй цуваа болгоно
    const points = densifyDaily(toDailyPoints(hist));
    if (points.length < MIN_POINTS || totalSold < MIN_TOTAL_SOLD) continue;

    const resolved = resolveItemConfig(db, storeId, item);
    const inferred = inferStockouts(points);
    // Богино түүхэнд тохируулж train цонхыг динамикаар
    const minTrain = Math.max(7, Math.min(14, Math.floor(points.length / 2)));
    const bt = backtestItem(points, resolved.value, {
      itemCd,
      price: item.price,
      minTrain,
    });
    if (bt.evaluatedPeriods < 3) continue;

    const f = forecast(inferred, opts.asOf);
    const health = computeHealth({
      backtest: bt,
      confidence: f.confidence,
      perishable: resolved.value.perishable,
    });
    const regime = detectRegimeChange(inferred, opts.asOf);
    const tuning = recommendTuning({ backtest: bt, config: resolved.value, regime });

    analyses.push({
      itemCd,
      name: item.name,
      categoryKey: categoryKeyOf(item),
      categoryNm: item.mclsNm ?? "Ангилалгүй",
      price: item.price,
      totalSold,
      confidence: f.confidence,
      backtest: bt,
      health,
      tuning,
    });
  }

  const kpi = aggregateKpi(db, storeId, from, to, analyses);
  const seasonality = computeSeasonality(buildStoreSeasonalitySeries(historyRaw));

  // Анхаарал татах эрэмбэ: муу эрүүл мэнд эхэнд, дараа нь ₮ нөлөө
  analyses.sort(
    (a, b) =>
      a.health.score - b.health.score ||
      b.backtest.lostSalesAvoided +
        b.backtest.overstockReduced -
        (a.backtest.lostSalesAvoided + a.backtest.overstockReduced),
  );

  return { storeId, name: store.name, kpi, items: analyses, seasonality };
}

function aggregateKpi(
  db: Db,
  storeId: number,
  from: string,
  to: string,
  items: ItemAnalysis[],
): StoreKpi {
  let wDemand = 0;
  let engFill = 0;
  let baseFill = 0;
  let engSvc = 0;
  let baseSvc = 0;
  let lostSalesAvoided = 0;
  let overstockReduced = 0;
  const health = { good: 0, watch: 0, poor: 0 };

  for (const it of items) {
    const w = Math.max(it.backtest.engine.totalDemand, 1);
    wDemand += w;
    engFill += w * it.backtest.engine.fillRate;
    baseFill += w * it.backtest.baseline.fillRate;
    engSvc += w * it.backtest.engine.cycleServiceLevel;
    baseSvc += w * it.backtest.baseline.cycleServiceLevel;
    lostSalesAvoided += it.backtest.lostSalesAvoided;
    overstockReduced += it.backtest.overstockReduced;
    health[it.health.grade === "good" ? "good" : it.health.grade === "watch" ? "watch" : "poor"]++;
  }

  const agg = storeAggregates(db, storeId, from, to);
  const wastePct =
    agg.delivered > 0 ? agg.waste / agg.delivered : agg.waste > 0 ? 1 : null;

  return {
    itemsAnalyzed: items.length,
    engineFillRate: wDemand > 0 ? engFill / wDemand : 0,
    baselineFillRate: wDemand > 0 ? baseFill / wDemand : 0,
    engineServiceLevel: wDemand > 0 ? engSvc / wDemand : 0,
    baselineServiceLevel: wDemand > 0 ? baseSvc / wDemand : 0,
    lostSalesAvoided,
    overstockReduced,
    gmv: agg.gmv,
    wastePct,
    health,
  };
}

// --- Fleet түвшин ---

export interface FleetKpi {
  storeCount: number;
  itemsAnalyzed: number;
  engineFillRate: number;
  baselineFillRate: number;
  lostSalesAvoided: number;
  overstockReduced: number;
  gmv: number;
  wastePct: number | null;
  health: { good: number; watch: number; poor: number };
}

export interface FleetStoreKpi {
  storeId: number;
  name: string;
  kpi: StoreKpi;
}

export interface FleetAnalytics {
  fleet: FleetKpi;
  stores: FleetStoreKpi[];
}

const FLEET_MAX_ITEMS = 80;

export function fleetAnalytics(
  db: Db,
  opts: AnalyzeOptions,
): FleetAnalytics {
  const stores = listStores(db);
  const perStore: FleetStoreKpi[] = [];

  let wDemand = 0;
  let engFill = 0;
  let baseFill = 0;
  let itemsAnalyzed = 0;
  let lostSalesAvoided = 0;
  let overstockReduced = 0;
  let gmv = 0;
  let wasteNum = 0;
  let wasteDen = 0;
  const health = { good: 0, watch: 0, poor: 0 };

  for (const s of stores) {
    const a = analyzeStore(db, s.id, {
      ...opts,
      maxItems: opts.maxItems ?? FLEET_MAX_ITEMS,
    });
    perStore.push({ storeId: s.id, name: s.name, kpi: a.kpi });

    // fleet нэгтгэл — борлуулалтаар жинлэнэ
    for (const it of a.items) {
      const w = Math.max(it.backtest.engine.totalDemand, 1);
      wDemand += w;
      engFill += w * it.backtest.engine.fillRate;
      baseFill += w * it.backtest.baseline.fillRate;
    }
    itemsAnalyzed += a.kpi.itemsAnalyzed;
    lostSalesAvoided += a.kpi.lostSalesAvoided;
    overstockReduced += a.kpi.overstockReduced;
    gmv += a.kpi.gmv;
    if (a.kpi.wastePct != null) {
      wasteNum += a.kpi.wastePct * a.kpi.gmv;
      wasteDen += a.kpi.gmv;
    }
    health.good += a.kpi.health.good;
    health.watch += a.kpi.health.watch;
    health.poor += a.kpi.health.poor;
  }

  return {
    fleet: {
      storeCount: stores.length,
      itemsAnalyzed,
      engineFillRate: wDemand > 0 ? engFill / wDemand : 0,
      baselineFillRate: wDemand > 0 ? baseFill / wDemand : 0,
      lostSalesAvoided,
      overstockReduced,
      gmv,
      wastePct: wasteDen > 0 ? wasteNum / wasteDen : null,
      health,
    },
    stores: perStore,
  };
}
