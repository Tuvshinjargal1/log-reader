/**
 * Демо дэлгүүрийн ӨДӨР ӨДРӨӨР хийх нөөцийн симуляц (pure, DB-гүй).
 *
 * ЯАГААД СИМУЛЯЦ, ЯАГААД ЗҮГЭЭР ТОО БИЧЭЭД БОЛОХГҮЙ ВЭ:
 * Хэрэв бид `daily_metrics`-ыг эрэлтийн муруйгаас шууд бичээд, `order_lines`-ын
 * `suggested_qty`-г гараар сонговол "автомат сайн уу, гараар сайн уу" гэсэн
 * харьцуулалт нь хуурамч тоог хуурамч тоотой жиших болно. Тиймээс:
 *
 *   1. Эрэлт нь НУУГДМАЛ ҮНЭН — хэзээ ч хадгалагдахгүй.
 *   2. Борлуулалт = min(эрэлт, нөөц) → censoring, нөөц дуусалт ӨӨРӨӨ үүснэ.
 *   3. Захиалгыг БОДИТ `computeSuggestion` гаргана, зөвхөн системд харагдах
 *      (emit хийсэн) мөрүүдийг өгнө.
 *   4. Оператор нь `operatorPolicy`-оор саналыг засна.
 *
 * Ингэснээр `stockout_flag`, `on_hand_end`, `waste_qty`, `delivered_qty` бүгд
 * бие биетэйгээ нийцнэ, `backtestItem`-ийн fill-rate ба board-ын `serviceRate`
 * хоёр зөрөхгүй.
 *
 * ⚠️ Ирээдүйн эрэлт рүү "харах" эрх нь ЗӨВХӨН `operatorPolicy`-д байна — энэ нь
 * "оператор сургуулийн арга хэмжээний тухай мэднэ" гэдгийг загварчилж байгаа юм.
 * Engine-ийн ямар ч зам үүнийг хардаггүй.
 */
import type { EffectiveConfig, GlobalDefaults, OrderMode } from "@/lib/config/types";
import type { DailyMetric } from "@/lib/db/repositories/metrics";
import { computeSuggestion, seasonFactor } from "@/lib/engine";
import { addDays, clamp, dowOf, roundUpTo, ymdToDate } from "@/lib/engine/util";
import type { StoreArchetype } from "./archetypes";
import { CATEGORY_BY_CD, type DemoCategory, type DemoSku } from "./catalog";
import type { DemoBranch } from "./branches";
import { between, gauss, streamFor, type Rng } from "./rng";

/**
 * Түүхэн мөрд хадгалах ХӨНГӨН factor snapshot.
 *
 * Бүтэн `DecisionFactors` нь `windowDays[]`-тэй тул ~2.5KB/мөр — 12,000 мөрд
 * ~30MB. Түүхэн мөрд шаардлагагүй: `FactorDetail` нь `config &&`-аар
 * хамгаалагдсан, `buildStoreFlow` нь зөвхөн доорх талбаруудыг уншдаг.
 */
export interface MiniFactors {
  asOf: string;
  protectionDays: number;
  baseDailyDemand: number;
  demandStdDev: number;
  forecastDemand: number;
  safetyStock: number;
  orderUpTo: number;
  inventoryPosition: number;
  onHand: number;
  onOrder: number;
  rawQty: number;
  orderMultiple: number;
  suggestedQty: number;
  confidence: number;
  lowConfidence: boolean;
  trend: number;
  dowFactorAvg: number;
  seasonFactorAvg: number;
  mode: OrderMode;
}

export interface SimDay {
  d: string;
  soldQty: number;
  soldAmt: number;
  onHandEnd: number;
  wasteQty: number;
  deliveredQty: number;
  stockoutFlag: boolean;
  /** false = POS энэ өдөр мөр үүсгээгүй (борлуулалтгүй удаан эргэлттэй бараа) */
  emit: boolean;
}

export interface SimOrderLine {
  itemCd: string;
  name: string;
  categoryKey: string;
  categoryNm: string;
  price: number;
  suggestedQty: number;
  finalQty: number;
  decidedBy: OrderMode;
  factors: MiniFactors;
}

export interface SimOrder {
  d: string;
  lines: SimOrderLine[];
}

export interface SimItemMeta {
  itemCd: string;
  name: string;
  mclsCd: string;
  mclsNm: string;
  sclsCd: string;
  sclsNm: string;
  price: number;
  orderMultiple: number;
  shelfLifeDays: number | null;
  perishable: boolean;
}

export interface SimulateStoreInput {
  branch: DemoBranch;
  archetype: StoreArchetype;
  skus: readonly DemoSku[];
  global: GlobalDefaults;
  /** YYYYMMDD — симуляцийн сүүлийн өдөр */
  asOf: string;
  /** Сүүлийн хэдэн хоногт бүтэн engine ажиллуулах (өмнөх нь хямд warm-up) */
  engineDays: number;
  /** Түүхэн захиалга бичих хоногийн тоо (asOf−2-оос ухарна) */
  orderHistoryDays: number;
}

export interface SimulateStoreResult {
  metrics: Map<string, SimDay[]>;
  orders: SimOrder[];
  items: SimItemMeta[];
  /** Диагностик — seed-ийн хураангуйд хэвлэнэ */
  stats: {
    metricRows: number;
    orderLines: number;
    touchedLines: number;
    stockoutDays: number;
    wasteQty: number;
  };
}

interface Batch {
  qty: number;
  /** null = мөхөшгүй */
  expiresOn: string | null;
}

interface ItemState {
  meta: SimItemMeta;
  cat: DemoCategory;
  cfg: EffectiveConfig;
  /** Нуугдмал үнэн эрэлт, өдөр бүрээр урьдчилан тооцсон */
  demand: number[];
  onHand: number;
  batches: Batch[];
  /** ymd → тухайн өдөр ирэх хүргэлт */
  pipeline: Map<string, number>;
  days: SimDay[];
  /** Engine-д өгөх түүх (зөвхөн emit хийсэн мөр) */
  emitted: DailyMetric[];
  rng: Rng;
  spiky: boolean;
}

/**
 * ХУАНЛИЙН ДУТУУ ТООЦООЛОЛ — цаг хугацааны мэдрэмжийн түүхийн эх сурвалж.
 *
 * `seasonFactor` (engine) нь Наадамд ×1.25 гэж мэддэг. Бодит дээр баярын үед
 * ундаа/амттан/архины эрэлт үүнээс ХАМААГҮЙ их өсдөг. Тэр зөрүү нь флот дундаа
 * нөхөлтийг унагаж, оператор гараар нөхөх шаардлага гаргана — яг "систем цаг
 * үеэ мэдэрч tune хийх шаардлагатай" гэдгийн жишээ.
 *
 * Энэ нь ЗӨВХӨН симуляцын нуугдмал эрэлтэд нөлөөлнө; engine хэзээ ч харахгүй.
 */
const CALENDAR_UNDERESTIMATE: {
  label: string;
  extra: number;
  categories: readonly string[];
}[] = [
  { label: "Наадам", extra: 1.55, categories: ["20", "50", "60", "31", "40"] },
  { label: "Шинэ жил", extra: 1.45, categories: ["20", "50", "60"] },
];

function calendarExtra(ymd: string, mclsCd: string): number {
  const label = seasonFactor(ymd).label;
  if (!label) return 1;
  const hit = CALENDAR_UNDERESTIMATE.find((c) => c.label === label);
  if (!hit || !hit.categories.includes(mclsCd)) return 1;
  return hit.extra;
}

function buildDays(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur.localeCompare(to) <= 0 && guard++ < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Ангиллын үнийн/эрэлтийн хүрээнд SKU-гийн индексээр байрлуулна. */
function lerp(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * clamp(t, 0, 1);
}

export function simulateStore(input: SimulateStoreInput): SimulateStoreResult {
  const { branch, archetype: a, skus, global, asOf, engineDays, orderHistoryDays } = input;

  const lastDay = addDays(asOf, -a.endsDaysBeforeAsOf);
  const firstDay = addDays(lastDay, -(a.historyDays - 1));
  const days = buildDays(firstDay, lastDay);

  const engineFrom = days[Math.max(0, days.length - engineDays)];
  // Захиалгыг бичих цонх: D + P ≤ asOf байх ёстой (override-ыг хэмжихийн тулд),
  // тул хамгийн шинэ түүхэн захиалга нь asOf−2. asOf-ын захиалгыг planStore бичнэ.
  const orderTo = addDays(asOf, -2);
  const orderFrom = addDays(orderTo, -(orderHistoryDays - 1));

  const states: ItemState[] = [];

  skus.forEach((sku, i) => {
    const cat = CATEGORY_BY_CD.get(sku.mclsCd);
    if (!cat) return;
    const rng = streamFor(branch.slot, i);
    const spiky = i < a.lowConfidenceItems;

    const price = Math.round(lerp(cat.price, sku.priceIndex) / 100) * 100;
    const meta: SimItemMeta = {
      itemCd: sku.itemCd,
      name: sku.name,
      mclsCd: cat.mclsCd,
      mclsNm: cat.mclsNm,
      sclsCd: sku.sclsCd,
      sclsNm: sku.sclsNm,
      price,
      orderMultiple: cat.orderMultiple,
      shelfLifeDays: cat.shelfLifeDays,
      perishable: cat.perishable,
    };

    const cfg: EffectiveConfig = {
      mode: a.mode,
      reviewPeriodDays: global.reviewPeriodDays,
      leadTimeDays: global.leadTimeDays,
      coverDays: a.coverDays ?? global.coverDays,
      serviceLevel: a.serviceLevel ?? global.serviceLevel,
      orderMultiple: cat.orderMultiple,
      minQty: null,
      maxQty: null,
      shelfLifeDays: cat.shelfLifeDays,
      perishable: cat.perishable,
      autoSubmitMaxAmount: global.autoSubmitMaxAmount,
    };

    // --- Нуугдмал эрэлтийг бүх өдрөөр УРЬДЧИЛАН тооцно ---
    // Нөөцөөс хамааралгүй тул урьдчилан тооцоолж болно; энэ нь operatorPolicy-д
    // "ирээдүйг харах" боломж өгнө (оператор арга хэмжээг мэддэгийг загварчилна).
    const baseMu =
      lerp(cat.baseDaily, sku.demandIndex) *
      branch.sizeFactor *
      between(rng, a.demandScale[0], a.demandScale[1]);
    const cov = cat.cov * a.covMultiplier * (spiky ? 3 : 1);

    const demand = days.map((d, di) => {
      const age = di - (days.length - 1); // 0 = сүүлийн өдөр, сөрөг = өмнөх
      let f = 1;
      f *= cat.dow[dowOf(d)];
      f *= Math.pow(1 + a.trendPerDay, days.length - 1 + age);
      f *= seasonFactor(d).factor;
      // Engine-ийн мэддэг коэффициентээс ДАВСАН баярын эрэлт (engine харахгүй)
      f *= calendarExtra(d, cat.mclsCd);
      if (cat.monthFactor) f *= cat.monthFactor(ymdToDate(d).getUTCMonth() + 1);

      const fromEnd = days.length - 1 - di;
      if (a.regimeStep && fromEnd <= a.regimeStep.daysBeforeEnd &&
          a.regimeStep.categories.includes(cat.mclsCd)) {
        f *= a.regimeStep.factor;
      }
      if (a.hiddenWeekly && a.hiddenWeekly.dows.includes(dowOf(d)) &&
          a.hiddenWeekly.categories.includes(cat.mclsCd)) {
        f *= a.hiddenWeekly.factor;
      }
      if (a.hiddenEvents && a.hiddenEvents.daysBeforeEnd.includes(fromEnd) &&
          a.hiddenEvents.categories.includes(cat.mclsCd)) {
        f *= a.hiddenEvents.factor;
      }
      if (a.hiddenLulls && a.hiddenLulls.daysBeforeEnd.includes(fromEnd) &&
          a.hiddenLulls.categories.includes(cat.mclsCd)) {
        f *= a.hiddenLulls.factor;
      }

      // Log-normal шуугиан — сөрөг эрэлт гарахгүй, баруун сүүл нь бодитой.
      // БҮХЭЛ тоо: бутархай үлдэгдэл нь `Math.round`-оор 0 болж, planStore-т
      // худал "нөөц дууссан" critical дохио үүсгэдэг.
      const noise = Math.exp(gauss(rng) * cov - (cov * cov) / 2);
      return Math.max(0, Math.round(baseMu * f * noise));
    });

    // Эхний нөөц: хамгаалалтын цонх + нөөцлөх хоног — warm-up-ын эхэнд
    // дэлгүүр хоосон биш, бодит байдалтай ойр эхэлнэ.
    const openingStock = Math.max(
      2,
      roundUpTo(baseMu * (global.reviewPeriodDays + global.leadTimeDays + (a.coverDays ?? global.coverDays)),
        cat.orderMultiple),
    );

    states.push({
      meta, cat, cfg, demand,
      onHand: openingStock,
      batches: [{ qty: openingStock, expiresOn: null }],
      pipeline: new Map(),
      days: [],
      emitted: [],
      rng,
      spiky,
    });
  });

  const orders: SimOrder[] = [];
  const stats = { metricRows: 0, orderLines: 0, touchedLines: 0, stockoutDays: 0, wasteQty: 0 };
  const leadTime = Math.max(0, global.leadTimeDays);
  const protection = Math.max(1, global.reviewPeriodDays) + leadTime;

  for (let di = 0; di < days.length; di++) {
    const d = days[di];
    const isOrderDay = d.localeCompare(engineFrom) >= 0 && d.localeCompare(asOf) < 0;
    const writeOrder = d.localeCompare(orderFrom) >= 0 && d.localeCompare(orderTo) <= 0;
    const lines: SimOrderLine[] = [];

    for (const s of states) {
      // 1) Хүргэлт ирнэ
      const arrived = s.pipeline.get(d) ?? 0;
      if (arrived > 0) {
        s.pipeline.delete(d);
        s.onHand += arrived;
        s.batches.push({
          qty: arrived,
          expiresOn: s.meta.shelfLifeDays != null ? addDays(d, s.meta.shelfLifeDays) : null,
        });
      }

      // 2) Эрэлт → борлуулалт (censoring)
      const want = s.demand[di];
      const sold = Math.min(want, s.onHand);
      const stockout = sold < want - 1e-6;
      if (stockout) stats.stockoutDays++;

      // FIFO-оор нөөцөөс хасна
      let remain = sold;
      for (const b of s.batches) {
        if (remain <= 1e-9) break;
        const take = Math.min(b.qty, remain);
        b.qty -= take;
        remain -= take;
      }
      s.onHand = Math.max(0, s.onHand - sold);

      // 3) Хугацаа дууссан багц → хаягдал
      let waste = 0;
      for (const b of s.batches) {
        if (b.qty > 1e-9 && b.expiresOn != null && b.expiresOn.localeCompare(d) <= 0) {
          waste += b.qty;
          b.qty = 0;
        }
      }
      if (waste > 0) {
        s.onHand = Math.max(0, s.onHand - waste);
        stats.wasteQty += waste;
      }
      s.batches = s.batches.filter((b) => b.qty > 1e-9);

      const soldQty = Math.round(sold);
      const onHandEnd = Math.round(s.onHand);
      const wasteQty = Math.round(waste);

      // 4) POS мөр бичих эсэх — борлуулалтгүй өдөр удаан эргэлттэй бараанд
      //    мөр үүсдэггүй (энэ нь densifyDaily-г үнэхээр ажиллуулна).
      //    Сүүлийн өдөр нь ҮРГЭЛЖ бичигдэнэ — latestOnHand шинэлэг байх ёстой.
      const sparseP = Math.min(0.9, s.cat.sparseProb + a.sparseBoost);
      const emit = di === days.length - 1 || soldQty > 0 || s.rng() >= sparseP;

      const day: SimDay = {
        d,
        soldQty,
        soldAmt: soldQty * s.meta.price,
        onHandEnd,
        wasteQty,
        deliveredQty: Math.round(arrived),
        stockoutFlag: stockout,
        emit,
      };
      s.days.push(day);
      if (emit) {
        stats.metricRows++;
        s.emitted.push({
          d,
          soldQty,
          soldAmt: day.soldAmt,
          onHandEnd,
          wasteQty,
          deliveredQty: day.deliveredQty,
          stockoutFlag: stockout,
        });
      }

      // 5) Өнөөдрийн захиалга
      if (!isOrderDay) {
        // Warm-up: хямд бодлого (engine дуудахгүй) — 90 хоногийн бүтэн engine
        // гүйлт нь seed-ийг хэдэн минут удаашруулна.
        const trailing = s.demand.slice(Math.max(0, di - 6), di + 1);
        const mu = trailing.reduce((x, y) => x + y, 0) / Math.max(1, trailing.length);
        // Хамгаалалтын цонх + нөөцлөх хоног. Зөвхөн protection-оор захиалбал
        // дэлгүүр архаг хоосорч, engine гартаа авахад 58 хоногийн муу түүх
        // өвлөгдөнө.
        const target = mu * (protection + s.cfg.coverDays);
        const qty = roundUpTo(
          Math.max(0, target - s.onHand - pipelineTotal(s)),
          s.meta.orderMultiple,
        );
        if (qty > 0) schedule(s, d, leadTime, qty);
        continue;
      }

      const sug = computeSuggestion({
        itemCd: s.meta.itemCd,
        history: s.emitted,
        config: s.cfg,
        asOf: d,
        onHand: s.onHand,
        onOrder: pipelineTotal(s),
      });

      const suggested = sug.suggestedQty;
      const { finalQty, touched } = operatorPolicy({
        rng: s.rng,
        archetype: a,
        suggested,
        onHand: s.onHand,
        onOrder: pipelineTotal(s),
        futureDemand: s.demand.slice(di + 1, di + 1 + protection),
        orderMultiple: s.meta.orderMultiple,
      });

      if (finalQty > 0) schedule(s, d, leadTime, finalQty);

      if (writeOrder && (finalQty > 0 || suggested > 0)) {
        const f = sug.factors;
        lines.push({
          itemCd: s.meta.itemCd,
          name: s.meta.name,
          categoryKey: s.meta.mclsCd,
          categoryNm: s.meta.mclsNm,
          price: s.meta.price,
          suggestedQty: suggested,
          finalQty,
          // planStore-той ижил: анх бүгд "auto", оператор хүрсэн үед "manual".
          decidedBy: touched ? "manual" : "auto",
          factors: {
            asOf: f.asOf,
            protectionDays: f.protectionDays,
            baseDailyDemand: round2(f.baseDailyDemand),
            demandStdDev: round2(f.demandStdDev),
            forecastDemand: round2(f.forecastDemand),
            safetyStock: round2(f.safetyStock),
            orderUpTo: round2(f.orderUpTo),
            inventoryPosition: round2(f.inventoryPosition),
            onHand: f.onHand,
            onOrder: f.onOrder,
            rawQty: round2(f.rawQty),
            orderMultiple: f.orderMultiple,
            suggestedQty: f.suggestedQty,
            confidence: round2(f.confidence),
            lowConfidence: f.lowConfidence,
            trend: round2(f.trend),
            dowFactorAvg: round2(f.dowFactorAvg),
            seasonFactorAvg: round2(f.seasonFactorAvg),
            mode: f.mode,
          },
        });
        stats.orderLines++;
        if (touched) stats.touchedLines++;
      }
    }

    if (lines.length > 0) orders.push({ d, lines });
  }

  const metrics = new Map<string, SimDay[]>();
  for (const s of states) metrics.set(s.meta.itemCd, s.days);

  return {
    metrics,
    orders,
    items: states.map((s) => s.meta),
    stats,
  };

  function schedule(s: ItemState, d: string, lt: number, qty: number): void {
    const arriveOn = addDays(d, Math.max(1, lt));
    s.pipeline.set(arriveOn, (s.pipeline.get(arriveOn) ?? 0) + qty);
  }
}

function pipelineTotal(s: ItemState): number {
  let sum = 0;
  for (const v of s.pipeline.values()) sum += v;
  return sum;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

interface OperatorInput {
  rng: Rng;
  archetype: StoreArchetype;
  suggested: number;
  onHand: number;
  onOrder: number;
  /** Ирээдүйн P хоногийн БОДИТ эрэлт — зөвхөн энд харагдана */
  futureDemand: number[];
  orderMultiple: number;
}

/**
 * Операторын шийдвэрийг загварчилна.
 *
 * `skill` = +1 бол "төгс" тоо руу яг хүрнэ, 0 бол толгой-соёо, сөрөг бол
 * саналаас ХОЛДУУЛНА (хэрэггүй оролцоо). `bias` ≠ 0 бол өөрчлөлт нь нэг тал
 * руу хазайна — board энэ нэг талыг олж "гараар биш, параметрээ зас" гэж
 * зөвлөнө.
 */
function operatorPolicy(inp: OperatorInput): { finalQty: number; touched: boolean } {
  const { rng, archetype: a, suggested, onHand, onOrder, futureDemand, orderMultiple } = inp;

  if (rng() >= a.overrideRate) return { finalQty: suggested, touched: false };

  const realized = futureDemand.reduce((x, y) => x + y, 0);
  const sigma = Math.sqrt(
    Math.max(0, futureDemand.reduce((x, y) => x + y * y, 0) / Math.max(1, futureDemand.length)),
  );
  const ideal = Math.max(0, realized + 0.5 * sigma - onHand - onOrder);

  const jitter = gauss(rng) * Math.max(0.5, suggested * 0.08);
  const raw =
    suggested + a.overrideSkill * (ideal - suggested) + a.overrideBias * suggested + jitter;

  const finalQty = roundUpTo(Math.max(0, raw), orderMultiple);
  // Оператор харсан ч зөвшөөрсөн тохиолдол бодитой — decided_by нь "manual"
  // хэвээр, харин δ = 0 тул override статистикт орохгүй.
  return { finalQty, touched: true };
}
