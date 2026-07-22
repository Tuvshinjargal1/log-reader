import { normalizeCode } from "@/lib/load/aggregate";
import type { Gs25Branch } from "@/lib/load/types";
import type {
  OrderSuggestion,
  SmsItemSale,
  SmsPosResult,
  StoreOrderView,
} from "./types";

/** Нэг барааны захиалгын санал */
export function suggestForItem(
  item: SmsItemSale,
  periodDays: number,
  coverDays: number,
): OrderSuggestion {
  const days = Math.max(periodDays, 1);
  const avgDaily = item.qty / days;
  const need = Math.ceil(avgDaily * coverDays);
  const suggestQty =
    item.stock != null ? Math.max(0, need - item.stock) : need;

  return {
    itemCd: item.itemCd,
    name: item.name,
    category: item.category,
    price: item.price,
    qty: item.qty,
    daysSold: item.daysSold,
    avgDaily,
    stock: item.stock,
    need,
    suggestQty,
  };
}

export function buildSuggestions(
  items: SmsItemSale[],
  periodDays: number,
  coverDays: number,
): OrderSuggestion[] {
  return items
    .map((item) => suggestForItem(item, periodDays, coverDays))
    .filter((s) => s.suggestQty > 0)
    .sort((a, b) => b.suggestQty - a.suggestQty || b.qty - a.qty);
}

function branchName(
  bizplCd: string | undefined,
  branches: Gs25Branch[],
): string | null {
  if (!bizplCd) return null;
  const code = normalizeCode(bizplCd);
  const hit = branches.find((b) => normalizeCode(b.code) === code);
  return hit?.name ?? null;
}

/** Амжилттай POS үр дүнг дэлгүүрийн харагдац болгоно */
export function buildStoreViews(
  results: SmsPosResult[],
  branches: Gs25Branch[],
  periodDays: number,
  coverDays: number,
): StoreOrderView[] {
  const stores: StoreOrderView[] = [];

  for (const r of results) {
    if (!r.ok || !r.items) continue;
    const bizplCd = r.bizplCd?.trim() || r.ip;
    const name =
      branchName(r.bizplCd, branches) ??
      (r.bizplCd ? `Салбар ${r.bizplCd}` : `IP ${r.ip}`);
    const suggestions = buildSuggestions(r.items, periodDays, coverDays);

    stores.push({
      key: `${r.ip}|${bizplCd}`,
      ip: r.ip,
      bizplCd,
      name,
      itemCount: r.items.length,
      suggestions,
      stockAvailable: r.stockAvailable === true,
    });
  }

  stores.sort((a, b) => a.name.localeCompare(b.name, "mn"));
  return stores;
}

/** YYYYMMDD from/to хоорондын хоногийн тоо (inclusive) */
export function countPeriodDays(from: string, to: string): number {
  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) return 7;
  const y1 = Number(from.slice(0, 4));
  const m1 = Number(from.slice(4, 6)) - 1;
  const d1 = Number(from.slice(6, 8));
  const y2 = Number(to.slice(0, 4));
  const m2 = Number(to.slice(4, 6)) - 1;
  const d2 = Number(to.slice(6, 8));
  const a = Date.UTC(y1, m1, d1);
  const b = Date.UTC(y2, m2, d2);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Өнөөдрөөс өмнөх N бүтэн хоногийн from/to (YYYYMMDD) — өнөөдрийг оруулахгүй */
export function lastNDaysRange(n: number, endDate?: Date): {
  from: string;
  to: string;
} {
  const end = endDate ? new Date(endDate) : new Date();
  // төгсгөл = өчигдөр (бүтэн өдөр)
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (n - 1));

  const pad = (x: number) => String(x).padStart(2, "0");
  const ymd = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return { from: ymd(start), to: ymd(end) };
}

export function ymdToIso(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

export function isoToYmd(iso: string): string {
  return iso.replace(/-/g, "");
}
