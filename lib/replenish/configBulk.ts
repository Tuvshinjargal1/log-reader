/**
 * Config давхаргыг ДЭЛГҮҮР тутамд нэг удаа татаж, бараа тус бүрд PURE resolve
 * хийх адаптер.
 *
 * `resolveItemConfig` (config.ts:365) нь бараа тутамд 4 query явуулдаг — board
 * дээр 20 дэлгүүр × ~50 бараа = 4,000 query. node:sqlite нь prepare-ыг кэшлэхгүй
 * тул энэ нь мэдэгдэхүйц. Энд дэлгүүр тутамд 4 query болгож бууруулна.
 *
 * ⚠️ Coalesce логик, provenance-ыг ДАВХАРДУУЛААГҮЙ — `resolveEffectiveConfig`
 * pure функцийг л дуудна.
 */
import type { Db } from "@/lib/db/index";
import { resolveEffectiveConfig } from "@/lib/config/effective";
import type {
  CategoryConfigRow,
  GlobalDefaults,
  ItemConfigRow,
  OrderMode,
  ResolvedConfig,
  StoreConfigRow,
} from "@/lib/config/types";
import { categoryKeyOf, getGlobalDefaults, type ItemRow } from "@/lib/db/repositories/config";

export interface StoreConfigBundle {
  global: GlobalDefaults;
  store: StoreConfigRow | null;
  categories: Map<string, CategoryConfigRow>;
  items: Map<string, ItemConfigRow>;
}

export function prefetchStoreConfigs(db: Db, storeId: number): StoreConfigBundle {
  const global = getGlobalDefaults(db);

  const s = db
    .prepare("SELECT * FROM store_config WHERE store_id = ?")
    .get(storeId) as
    | {
        mode: string | null;
        review_period_days: number | null;
        lead_time_days: number | null;
        cover_days: number | null;
        service_level: number | null;
        auto_submit_max_amount: number | null;
      }
    | undefined;
  const store: StoreConfigRow | null = s
    ? {
        mode: (s.mode as OrderMode | null) ?? null,
        reviewPeriodDays: s.review_period_days,
        leadTimeDays: s.lead_time_days,
        coverDays: s.cover_days,
        serviceLevel: s.service_level,
        autoSubmitMaxAmount: s.auto_submit_max_amount,
      }
    : null;

  const catRows = db
    .prepare("SELECT * FROM category_config WHERE store_id = ?")
    .all(storeId) as unknown as {
    category_key: string;
    mode: string | null;
    cover_days: number | null;
    service_level: number | null;
  }[];
  const categories = new Map<string, CategoryConfigRow>(
    catRows.map((r) => [
      r.category_key,
      {
        mode: (r.mode as OrderMode | null) ?? null,
        coverDays: r.cover_days,
        serviceLevel: r.service_level,
      },
    ]),
  );

  const itemRows = db
    .prepare("SELECT * FROM item_config WHERE store_id = ?")
    .all(storeId) as unknown as {
    item_cd: string;
    mode: string | null;
    cover_days: number | null;
    service_level: number | null;
    order_multiple: number | null;
    min_qty: number | null;
    max_qty: number | null;
    shelf_life_days: number | null;
  }[];
  const items = new Map<string, ItemConfigRow>(
    itemRows.map((r) => [
      r.item_cd,
      {
        mode: (r.mode as OrderMode | null) ?? null,
        coverDays: r.cover_days,
        serviceLevel: r.service_level,
        orderMultiple: r.order_multiple,
        minQty: r.min_qty,
        maxQty: r.max_qty,
        shelfLifeDays: r.shelf_life_days,
      },
    ]),
  );

  return { global, store, categories, items };
}

/** Урьдчилж татсан bundle-аас PURE resolve. */
export function resolveFor(bundle: StoreConfigBundle, item: ItemRow): ResolvedConfig {
  return resolveEffectiveConfig({
    global: bundle.global,
    store: bundle.store,
    category: bundle.categories.get(categoryKeyOf(item)) ?? null,
    item: bundle.items.get(item.itemCd) ?? null,
    catalog: item.catalog,
  });
}

/** Дэлгүүрийн эцсийн горим (бараа/ангиллын override-гүйгээр). */
export function storeModeOf(bundle: StoreConfigBundle): {
  mode: OrderMode;
  source: "store" | "global";
} {
  return bundle.store?.mode
    ? { mode: bundle.store.mode, source: "store" }
    : { mode: bundle.global.mode, source: "global" };
}
