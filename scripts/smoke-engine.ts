/**
 * P1b engine smoke: forecast + (R,S) replenish + shelf-life cap + stockout хасалт.
 * Ажиллуулах: npx tsx scripts/smoke-engine.ts
 */
import { computeSuggestion } from "../lib/engine";
import { invNormCdf, roundUpTo } from "../lib/engine/util";
import type { DailyMetric } from "../lib/db/repositories/metrics";
import type { EffectiveConfig } from "../lib/config/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}
function near(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

// --- туслах: тогтмол өдрийн борлуулалттай түүх үүсгэх ---
function steadyHistory(fromYmd: string, days: number, perDay: number): DailyMetric[] {
  const out: DailyMetric[] = [];
  const y = Number(fromYmd.slice(0, 4));
  const m = Number(fromYmd.slice(4, 6)) - 1;
  const d0 = Number(fromYmd.slice(6, 8));
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m, d0 + i));
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
    out.push({
      d,
      soldQty: perDay,
      soldAmt: perDay * 1000,
      onHandEnd: 20,
      wasteQty: null,
      deliveredQty: null,
      stockoutFlag: false,
    });
  }
  return out;
}

const baseConfig: EffectiveConfig = {
  mode: "manual",
  reviewPeriodDays: 1,
  leadTimeDays: 2,
  coverDays: 3,
  serviceLevel: 0.95,
  orderMultiple: 1,
  minQty: null,
  maxQty: null,
  shelfLifeDays: null,
  perishable: false,
  autoSubmitMaxAmount: null,
};

// --- invNormCdf sanity ---
assert(near(invNormCdf(0.95), 1.645, 0.01), `z(0.95)≈1.645 got ${invNormCdf(0.95)}`);
assert(near(invNormCdf(0.5), 0, 0.001), `z(0.5)=0 got ${invNormCdf(0.5)}`);

// --- roundUpTo ---
assert(roundUpTo(5, 6) === 6, "5→6 (multiple 6)");
assert(roundUpTo(6, 6) === 6, "6→6");
assert(roundUpTo(7, 6) === 12, "7→12");

// --- Тогтмол эрэлт: μ≈4, σ≈0, тул SS≈0; P=3; D_P≈4*P=12; onHand=5 → ~7 ---
{
  const hist = steadyHistory("20260601", 28, 4);
  const s = computeSuggestion({
    itemCd: "STEADY",
    history: hist,
    config: baseConfig,
    asOf: "20260629",
    onHand: 5,
  });
  const f = s.factors;
  assert(near(f.baseDailyDemand, 4, 0.2), `μ≈4 got ${f.baseDailyDemand}`);
  assert(f.protectionDays === 3, `P=3 got ${f.protectionDays}`);
  assert(f.demandStdDev < 0.01, `σ≈0 (тогтмол) got ${f.demandStdDev}`);
  assert(near(f.safetyStock, 0, 0.01), `SS≈0 got ${f.safetyStock}`);
  // D_P = μ * Σ(dow*season). Тогтмол тул dow≈1; season өдрөөс хамаарна.
  assert(f.forecastDemand > 10 && f.forecastDemand < 16, `D_P~12 got ${f.forecastDemand}`);
  assert(f.inventoryPosition === 5, "IP=onHand=5");
  assert(s.suggestedQty === Math.max(0, f.afterRounding), "suggest=afterRounding");
  assert(s.suggestedQty > 0, "тогтмол эрэлттэй бол захиалах ёстой");
}

// --- Хангалттай нөөц → 0 захиалга ---
{
  const hist = steadyHistory("20260601", 28, 4);
  const s = computeSuggestion({
    itemCd: "FULL",
    history: hist,
    config: baseConfig,
    asOf: "20260629",
    onHand: 100,
  });
  assert(s.suggestedQty === 0, `хэт их нөөцтэй бол 0 got ${s.suggestedQty}`);
}

// --- Stockout өдрийг хасах: сүүлийн 5 өдөр stockout (0 борлуулалт) ---
{
  const hist = steadyHistory("20260601", 28, 4);
  for (let i = 23; i < 28; i++) {
    hist[i].soldQty = 0;
    hist[i].stockoutFlag = true;
  }
  const s = computeSuggestion({
    itemCd: "CENSORED",
    history: hist,
    config: baseConfig,
    asOf: "20260629",
    onHand: 0,
  });
  // stockout өдрийг хассан тул μ нь 0 руу унахгүй, ~4 хэвээр
  assert(s.factors.stockoutDays === 5, `5 stockout өдөр got ${s.factors.stockoutDays}`);
  assert(near(s.factors.baseDailyDemand, 4, 0.3), `μ≈4 (censored хассан) got ${s.factors.baseDailyDemand}`);
}

// --- order_multiple дугуйруулалт ---
{
  const hist = steadyHistory("20260601", 28, 4);
  const s = computeSuggestion({
    itemCd: "PACK",
    history: hist,
    config: { ...baseConfig, orderMultiple: 6 },
    asOf: "20260629",
    onHand: 5,
  });
  assert(s.suggestedQty % 6 === 0, `6-ийн үржвэр байх ёстой got ${s.suggestedQty}`);
}

// --- Shelf-life cap (perishable) ---
{
  const hist = steadyHistory("20260601", 28, 10);
  const s = computeSuggestion({
    itemCd: "FRESH",
    history: hist,
    config: {
      ...baseConfig,
      perishable: true,
      shelfLifeDays: 2,
      leadTimeDays: 5, // P том → cap-гүй бол их захиална
    },
    asOf: "20260629",
    onHand: 0,
  });
  // shelf-life 2 хоног: ~2*10=20-оос ихгүй байх ёстой
  assert(s.factors.shelfLifeCap != null, "shelf-life cap тооцсон");
  assert(s.suggestedQty <= 21, `shelf-life cap ажиллах ёстой got ${s.suggestedQty}`);
}

console.log("smoke-engine: OK");
