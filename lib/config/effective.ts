/**
 * Config давхрааллыг (global → store → category → item) талбар тус бүрээр
 * coalesce хийж эцсийн утгыг гаргана. Ямар ч DB-ээс хамааралгүй PURE функц —
 * тестлэхэд хялбар, диаграм болон engine хоёул үүнийг ашиглана.
 *
 * Талбар бүрд `sources[field]` нь утгыг АЛЬ давхаргаас авснаа тэмдэглэнэ.
 * Энэ нь диаграмын tooltip дээр "cover 5 — category түвшинд тавьсан" гэх мэт
 * тайлбар гаргах эх сурвалж.
 */
import type {
  CategoryConfigRow,
  ConfigLayer,
  ConfigSources,
  EffectiveConfig,
  GlobalDefaults,
  ItemCatalog,
  ItemConfigRow,
  ResolvedConfig,
  StoreConfigRow,
} from "./types";

export interface ResolveInput {
  global: GlobalDefaults;
  store?: StoreConfigRow | null;
  category?: CategoryConfigRow | null;
  item?: ItemConfigRow | null;
  catalog?: ItemCatalog | null;
}

/** null биш эхний утгыг давхаргын нэрийн хамт буцаана */
function pick<T>(
  candidates: Array<[ConfigLayer, T | null | undefined]>,
): { value: T; layer: ConfigLayer } | null {
  for (const [layer, v] of candidates) {
    if (v !== null && v !== undefined) return { value: v, layer };
  }
  return null;
}

export function resolveEffectiveConfig(input: ResolveInput): ResolvedConfig {
  const { global, store, category, item, catalog } = input;
  const sources: ConfigSources = {};

  // Талбар тус бүрд давхаргын дараалал (өндөр → нам). global үргэлж утгатай.
  function resolve<K extends keyof EffectiveConfig>(
    key: K,
    candidates: Array<[ConfigLayer, EffectiveConfig[K] | null | undefined]>,
    fallback: EffectiveConfig[K],
  ): EffectiveConfig[K] {
    const hit = pick(candidates);
    if (hit) {
      sources[key] = hit.layer;
      return hit.value;
    }
    return fallback;
  }

  const value: EffectiveConfig = {
    mode: resolve(
      "mode",
      [
        ["item", item?.mode],
        ["category", category?.mode],
        ["store", store?.mode],
        ["global", global.mode],
      ],
      global.mode,
    ),
    reviewPeriodDays: resolve(
      "reviewPeriodDays",
      [
        ["store", store?.reviewPeriodDays],
        ["global", global.reviewPeriodDays],
      ],
      global.reviewPeriodDays,
    ),
    leadTimeDays: resolve(
      "leadTimeDays",
      [
        ["item", catalog?.leadTimeDays],
        ["store", store?.leadTimeDays],
        ["global", global.leadTimeDays],
      ],
      global.leadTimeDays,
    ),
    coverDays: resolve(
      "coverDays",
      [
        ["item", item?.coverDays],
        ["category", category?.coverDays],
        ["store", store?.coverDays],
        ["global", global.coverDays],
      ],
      global.coverDays,
    ),
    serviceLevel: resolve(
      "serviceLevel",
      [
        ["item", item?.serviceLevel],
        ["category", category?.serviceLevel],
        ["store", store?.serviceLevel],
        ["global", global.serviceLevel],
      ],
      global.serviceLevel,
    ),
    orderMultiple: resolve(
      "orderMultiple",
      [
        ["item", item?.orderMultiple],
        ["item", catalog?.orderMultiple],
      ],
      1,
    ),
    minQty: resolve(
      "minQty",
      [
        ["item", item?.minQty],
        ["item", catalog?.minQty],
      ],
      null,
    ),
    maxQty: resolve(
      "maxQty",
      [
        ["item", item?.maxQty],
        ["item", catalog?.maxQty],
      ],
      null,
    ),
    shelfLifeDays: resolve(
      "shelfLifeDays",
      [
        ["item", item?.shelfLifeDays],
        ["item", catalog?.shelfLifeDays],
      ],
      null,
    ),
    perishable: catalog?.perishable ?? false,
    autoSubmitMaxAmount: resolve(
      "autoSubmitMaxAmount",
      [
        ["store", store?.autoSubmitMaxAmount],
        ["global", global.autoSubmitMaxAmount],
      ],
      null,
    ),
  };

  if (catalog) sources.perishable = "item";

  return { value, sources };
}

/** Давхаргын нэрийг монгол шошгоор */
export const LAYER_LABEL: Record<ConfigLayer, string> = {
  global: "Ерөнхий",
  store: "Дэлгүүр",
  category: "Ангилал",
  item: "Бараа",
};
