/** Barааны каталог + config давхаргууд + effective config-ийн DB холбогч. */
import type { Db } from "../index";
import { resolveEffectiveConfig } from "@/lib/config/effective";
import type {
  CategoryConfigRow,
  GlobalDefaults,
  ItemCatalog,
  ItemConfigRow,
  OrderMode,
  ResolvedConfig,
  StoreConfigRow,
} from "@/lib/config/types";

// --- Global defaults ---

export function getGlobalDefaults(db: Db): GlobalDefaults {
  const r = db.prepare("SELECT * FROM global_defaults WHERE id = 1").get() as
    | {
        mode: string;
        review_period_days: number;
        lead_time_days: number;
        cover_days: number;
        service_level: number;
        auto_submit_max_amount: number | null;
      }
    | undefined;
  if (!r) {
    return {
      mode: "manual",
      reviewPeriodDays: 1,
      leadTimeDays: 1,
      coverDays: 3,
      serviceLevel: 0.95,
      autoSubmitMaxAmount: null,
    };
  }
  return {
    mode: (r.mode as OrderMode) ?? "manual",
    reviewPeriodDays: r.review_period_days,
    leadTimeDays: r.lead_time_days,
    coverDays: r.cover_days,
    serviceLevel: r.service_level,
    autoSubmitMaxAmount: r.auto_submit_max_amount,
  };
}

export function updateGlobalDefaults(
  db: Db,
  patch: Partial<GlobalDefaults>,
): void {
  const cur = getGlobalDefaults(db);
  const next = { ...cur, ...patch };
  db.prepare(
    `UPDATE global_defaults
        SET mode = ?, review_period_days = ?, lead_time_days = ?,
            cover_days = ?, service_level = ?, auto_submit_max_amount = ?,
            updated_at = datetime('now')
      WHERE id = 1`,
  ).run(
    next.mode,
    next.reviewPeriodDays,
    next.leadTimeDays,
    next.coverDays,
    next.serviceLevel,
    next.autoSubmitMaxAmount,
  );
}

// --- Item catalog ---

export interface UpsertItemInput {
  storeId: number;
  itemCd: string;
  name: string;
  mclsCd?: string | null;
  mclsNm?: string | null;
  sclsCd?: string | null;
  sclsNm?: string | null;
  price?: number | null;
}

/** Барааг каталогт бүртгэх/шинэчлэх. Оператор тохируулсан талбарыг дардаггүй. */
export function upsertItem(db: Db, input: UpsertItemInput): void {
  db.prepare(
    `INSERT INTO items (store_id, item_cd, name, mcls_cd, mcls_nm, scls_cd, scls_nm, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, item_cd) DO UPDATE SET
       name = excluded.name,
       mcls_cd = excluded.mcls_cd,
       mcls_nm = excluded.mcls_nm,
       scls_cd = excluded.scls_cd,
       scls_nm = excluded.scls_nm,
       price = excluded.price,
       updated_at = datetime('now')`,
  ).run(
    input.storeId,
    input.itemCd,
    input.name,
    input.mclsCd ?? null,
    input.mclsNm ?? null,
    input.sclsCd ?? null,
    input.sclsNm ?? null,
    input.price ?? null,
  );
}

interface ItemDbRow {
  item_cd: string;
  name: string;
  mcls_cd: string | null;
  mcls_nm: string | null;
  scls_cd: string | null;
  scls_nm: string | null;
  price: number | null;
  order_multiple: number;
  min_qty: number | null;
  max_qty: number | null;
  lead_time_days: number | null;
  shelf_life_days: number | null;
  perishable: number;
}

export interface ItemRow {
  itemCd: string;
  name: string;
  mclsCd: string | null;
  mclsNm: string | null;
  sclsCd: string | null;
  sclsNm: string | null;
  price: number | null;
  catalog: ItemCatalog;
}

function mapItem(r: ItemDbRow): ItemRow {
  return {
    itemCd: r.item_cd,
    name: r.name,
    mclsCd: r.mcls_cd,
    mclsNm: r.mcls_nm,
    sclsCd: r.scls_cd,
    sclsNm: r.scls_nm,
    price: r.price,
    catalog: {
      orderMultiple: r.order_multiple ?? 1,
      minQty: r.min_qty,
      maxQty: r.max_qty,
      leadTimeDays: r.lead_time_days,
      shelfLifeDays: r.shelf_life_days,
      perishable: r.perishable === 1,
    },
  };
}

export function listItems(db: Db, storeId: number): ItemRow[] {
  const rows = db
    .prepare("SELECT * FROM items WHERE store_id = ?")
    .all(storeId) as unknown as ItemDbRow[];
  return rows.map(mapItem);
}

export function getItem(
  db: Db,
  storeId: number,
  itemCd: string,
): ItemRow | null {
  const r = db
    .prepare("SELECT * FROM items WHERE store_id = ? AND item_cd = ?")
    .get(storeId, itemCd) as ItemDbRow | undefined;
  return r ? mapItem(r) : null;
}

// --- Config override давхаргууд ---

export function getStoreConfig(db: Db, storeId: number): StoreConfigRow | null {
  const r = db
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
  if (!r) return null;
  return {
    mode: (r.mode as OrderMode | null) ?? null,
    reviewPeriodDays: r.review_period_days,
    leadTimeDays: r.lead_time_days,
    coverDays: r.cover_days,
    serviceLevel: r.service_level,
    autoSubmitMaxAmount: r.auto_submit_max_amount,
  };
}

export function setStoreConfig(
  db: Db,
  storeId: number,
  patch: Partial<StoreConfigRow>,
): void {
  const cur = getStoreConfig(db, storeId);
  const n: StoreConfigRow = {
    mode: null,
    reviewPeriodDays: null,
    leadTimeDays: null,
    coverDays: null,
    serviceLevel: null,
    autoSubmitMaxAmount: null,
    ...cur,
    ...patch,
  };
  db.prepare(
    `INSERT INTO store_config
       (store_id, mode, review_period_days, lead_time_days, cover_days, service_level, auto_submit_max_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id) DO UPDATE SET
       mode = excluded.mode,
       review_period_days = excluded.review_period_days,
       lead_time_days = excluded.lead_time_days,
       cover_days = excluded.cover_days,
       service_level = excluded.service_level,
       auto_submit_max_amount = excluded.auto_submit_max_amount,
       updated_at = datetime('now')`,
  ).run(
    storeId,
    n.mode,
    n.reviewPeriodDays,
    n.leadTimeDays,
    n.coverDays,
    n.serviceLevel,
    n.autoSubmitMaxAmount,
  );
}

export function getCategoryConfig(
  db: Db,
  storeId: number,
  categoryKey: string,
): CategoryConfigRow | null {
  const r = db
    .prepare(
      "SELECT * FROM category_config WHERE store_id = ? AND category_key = ?",
    )
    .get(storeId, categoryKey) as
    | { mode: string | null; cover_days: number | null; service_level: number | null }
    | undefined;
  if (!r) return null;
  return {
    mode: (r.mode as OrderMode | null) ?? null,
    coverDays: r.cover_days,
    serviceLevel: r.service_level,
  };
}

export function setCategoryConfig(
  db: Db,
  storeId: number,
  categoryKey: string,
  patch: Partial<CategoryConfigRow>,
): void {
  const cur = getCategoryConfig(db, storeId, categoryKey);
  const n: CategoryConfigRow = {
    mode: null,
    coverDays: null,
    serviceLevel: null,
    ...cur,
    ...patch,
  };
  db.prepare(
    `INSERT INTO category_config (store_id, category_key, mode, cover_days, service_level)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(store_id, category_key) DO UPDATE SET
       mode = excluded.mode,
       cover_days = excluded.cover_days,
       service_level = excluded.service_level,
       updated_at = datetime('now')`,
  ).run(storeId, categoryKey, n.mode, n.coverDays, n.serviceLevel);
}

export function getItemConfig(
  db: Db,
  storeId: number,
  itemCd: string,
): ItemConfigRow | null {
  const r = db
    .prepare("SELECT * FROM item_config WHERE store_id = ? AND item_cd = ?")
    .get(storeId, itemCd) as
    | {
        mode: string | null;
        cover_days: number | null;
        service_level: number | null;
        order_multiple: number | null;
        min_qty: number | null;
        max_qty: number | null;
        shelf_life_days: number | null;
      }
    | undefined;
  if (!r) return null;
  return {
    mode: (r.mode as OrderMode | null) ?? null,
    coverDays: r.cover_days,
    serviceLevel: r.service_level,
    orderMultiple: r.order_multiple,
    minQty: r.min_qty,
    maxQty: r.max_qty,
    shelfLifeDays: r.shelf_life_days,
  };
}

export function setItemConfig(
  db: Db,
  storeId: number,
  itemCd: string,
  patch: Partial<ItemConfigRow>,
): void {
  const cur = getItemConfig(db, storeId, itemCd);
  const n: ItemConfigRow = {
    mode: null,
    coverDays: null,
    serviceLevel: null,
    orderMultiple: null,
    minQty: null,
    maxQty: null,
    shelfLifeDays: null,
    ...cur,
    ...patch,
  };
  db.prepare(
    `INSERT INTO item_config
       (store_id, item_cd, mode, cover_days, service_level, order_multiple, min_qty, max_qty, shelf_life_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, item_cd) DO UPDATE SET
       mode = excluded.mode,
       cover_days = excluded.cover_days,
       service_level = excluded.service_level,
       order_multiple = excluded.order_multiple,
       min_qty = excluded.min_qty,
       max_qty = excluded.max_qty,
       shelf_life_days = excluded.shelf_life_days,
       updated_at = datetime('now')`,
  ).run(
    storeId,
    itemCd,
    n.mode,
    n.coverDays,
    n.serviceLevel,
    n.orderMultiple,
    n.minQty,
    n.maxQty,
    n.shelfLifeDays,
  );
}

/** items.mcls_cd-г ангиллын түлхүүр болгож ашиглана (том ангилал). */
export function categoryKeyOf(item: Pick<ItemRow, "mclsCd">): string {
  return item.mclsCd?.trim() || "_none";
}

/**
 * Тухайн дэлгүүрийн нэг барааны эцсийн (effective) config-ыг бүх давхаргыг
 * татаж resolve хийнэ. Provenance-тэй. Engine болон диаграм үүнийг дуудна.
 */
export function resolveItemConfig(
  db: Db,
  storeId: number,
  item: ItemRow,
): ResolvedConfig {
  const global = getGlobalDefaults(db);
  const store = getStoreConfig(db, storeId);
  const categoryKey = categoryKeyOf(item);
  const category = getCategoryConfig(db, storeId, categoryKey);
  const itemCfg = getItemConfig(db, storeId, item.itemCd);
  return resolveEffectiveConfig({
    global,
    store,
    category,
    item: itemCfg,
    catalog: item.catalog,
  });
}
