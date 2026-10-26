/** Өдөр тутмын хэмжигдэхүүний repository (engine-ийн эх сурвалж). */
import type { Db } from "../index";

export interface DailyMetric {
  d: string; // YYYYMMDD
  soldQty: number;
  soldAmt: number;
  onHandEnd: number | null;
  wasteQty: number | null;
  deliveredQty: number | null;
  stockoutFlag: boolean;
}

export interface DailyMetricInput {
  storeId: number;
  itemCd: string;
  d: string;
  soldQty?: number;
  soldAmt?: number;
  onHandEnd?: number | null;
  wasteQty?: number | null;
  deliveredQty?: number | null;
  stockoutFlag?: boolean;
}

interface DailyDbRow {
  d: string;
  sold_qty: number;
  sold_amt: number;
  on_hand_end: number | null;
  waste_qty: number | null;
  delivered_qty: number | null;
  stockout_flag: number;
}

function mapDaily(r: DailyDbRow): DailyMetric {
  return {
    d: r.d,
    soldQty: r.sold_qty,
    soldAmt: r.sold_amt,
    onHandEnd: r.on_hand_end,
    wasteQty: r.waste_qty,
    deliveredQty: r.delivered_qty,
    stockoutFlag: r.stockout_flag === 1,
  };
}

/** Нэг өдрийн нэг барааны хэмжигдэхүүнийг оруулах/шинэчлэх. */
export function upsertDailyMetric(db: Db, input: DailyMetricInput): void {
  db.prepare(
    `INSERT INTO daily_metrics
       (store_id, item_cd, d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, item_cd, d) DO UPDATE SET
       sold_qty = excluded.sold_qty,
       sold_amt = excluded.sold_amt,
       on_hand_end = COALESCE(excluded.on_hand_end, daily_metrics.on_hand_end),
       waste_qty = COALESCE(excluded.waste_qty, daily_metrics.waste_qty),
       delivered_qty = COALESCE(excluded.delivered_qty, daily_metrics.delivered_qty),
       stockout_flag = excluded.stockout_flag`,
  ).run(
    input.storeId,
    input.itemCd,
    input.d,
    input.soldQty ?? 0,
    input.soldAmt ?? 0,
    input.onHandEnd ?? null,
    input.wasteQty ?? null,
    input.deliveredQty ?? null,
    input.stockoutFlag ? 1 : 0,
  );
}

/**
 * Нэмэлт талбаруудыг (нөөц/хаягдал/нийлүүлэлт/stockout) шинэчилнэ. Борлуулалтын
 * (sold_qty/sold_amt) утгыг ХӨНДӨХГҮЙ — тусдаа dataset-ийг бичихэд sold дарагдахаас
 * сэргийлнэ. Мөр байхгүй бол sold=0-оор шинээр үүсгэнэ (дараа нь sales бичихэд солигдоно).
 */
export function applyDailyExtras(
  db: Db,
  input: {
    storeId: number;
    itemCd: string;
    d: string;
    onHandEnd?: number | null;
    wasteQty?: number | null;
    deliveredQty?: number | null;
  },
): void {
  db.prepare(
    `INSERT INTO daily_metrics
       (store_id, item_cd, d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag)
     VALUES (?, ?, ?, 0, 0, ?, ?, ?, 0)
     ON CONFLICT(store_id, item_cd, d) DO UPDATE SET
       on_hand_end   = COALESCE(excluded.on_hand_end, daily_metrics.on_hand_end),
       waste_qty     = COALESCE(excluded.waste_qty, daily_metrics.waste_qty),
       delivered_qty = COALESCE(excluded.delivered_qty, daily_metrics.delivered_qty)`,
  ).run(
    input.storeId,
    input.itemCd,
    input.d,
    input.onHandEnd ?? null,
    input.wasteQty ?? null,
    input.deliveredQty ?? null,
  );
}

/** stockout_flag-ийг тусад нь тохируулна (мөр аль хэдийн үүссэн байх ёстой). */
export function setStockoutFlag(
  db: Db,
  storeId: number,
  itemCd: string,
  d: string,
  flag: boolean,
): void {
  db.prepare(
    "UPDATE daily_metrics SET stockout_flag = ? WHERE store_id = ? AND item_cd = ? AND d = ?",
  ).run(flag ? 1 : 0, storeId, itemCd, d);
}

/** Нэг барааны өдрийн цуваа (өсөх дарааллаар). */
export function getItemHistory(
  db: Db,
  storeId: number,
  itemCd: string,
  fromYmd: string,
  toYmd: string,
): DailyMetric[] {
  const rows = db
    .prepare(
      `SELECT d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag
         FROM daily_metrics
        WHERE store_id = ? AND item_cd = ? AND d BETWEEN ? AND ?
        ORDER BY d ASC`,
    )
    .all(storeId, itemCd, fromYmd, toYmd) as unknown as DailyDbRow[];
  return rows.map(mapDaily);
}

/** Дэлгүүрийн бүх барааны түүхийг item_cd → цуваа болгож буцаана. */
export function getStoreHistory(
  db: Db,
  storeId: number,
  fromYmd: string,
  toYmd: string,
): Map<string, DailyMetric[]> {
  const rows = db
    .prepare(
      `SELECT item_cd, d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag
         FROM daily_metrics
        WHERE store_id = ? AND d BETWEEN ? AND ?
        ORDER BY item_cd, d ASC`,
    )
    .all(storeId, fromYmd, toYmd) as unknown as (DailyDbRow & { item_cd: string })[];

  const out = new Map<string, DailyMetric[]>();
  for (const r of rows) {
    const list = out.get(r.item_cd);
    const m = mapDaily(r);
    if (list) list.push(m);
    else out.set(r.item_cd, [m]);
  }
  return out;
}

/** Хамгийн сүүлийн нөөцийн үлдэгдэл (on_hand_end). */
export function latestOnHand(
  db: Db,
  storeId: number,
  itemCd: string,
): number | null {
  const r = db
    .prepare(
      `SELECT on_hand_end FROM daily_metrics
        WHERE store_id = ? AND item_cd = ? AND on_hand_end IS NOT NULL
        ORDER BY d DESC LIMIT 1`,
    )
    .get(storeId, itemCd) as { on_hand_end: number | null } | undefined;
  return r?.on_hand_end ?? null;
}

/** Дэлгүүрийн хугацааны нэгтгэл: GMV, хаягдал, нийлүүлэлт (KPI-д). */
export function storeAggregates(
  db: Db,
  storeId: number,
  fromYmd: string,
  toYmd: string,
): { gmv: number; soldQty: number; waste: number; delivered: number } {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(sold_amt),0)      AS gmv,
              COALESCE(SUM(sold_qty),0)      AS soldQty,
              COALESCE(SUM(waste_qty),0)     AS waste,
              COALESCE(SUM(delivered_qty),0) AS delivered
         FROM daily_metrics
        WHERE store_id = ? AND d BETWEEN ? AND ?`,
    )
    .get(storeId, fromYmd, toYmd) as {
    gmv: number;
    soldQty: number;
    waste: number;
    delivered: number;
  };
  return r;
}

/** Тухайн дэлгүүрт түүхтэй бүх item_cd. */
export function distinctItemCds(db: Db, storeId: number): string[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT item_cd FROM daily_metrics WHERE store_id = ?",
    )
    .all(storeId) as unknown as { item_cd: string }[];
  return rows.map((r) => r.item_cd);
}
