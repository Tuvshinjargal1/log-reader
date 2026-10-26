/**
 * Нэг дэлгүүрийн POS-оос ӨДӨР ТУТМЫН датаг татаж SQLite (daily_metrics, items)
 * руу бичнэ. Schema тодорхойгүй dataset-уудыг probe хийж, graceful degradation
 * хийнэ. Оператор офлайн байсан ч хадгалсан түүхээр шийдвэр гарна.
 *
 * ТЭМДЭГЛЭЛ: түүхэн өдрийн НӨӨЦ POS-д ихэвчлэн хадгалагддаггүй тул одоогийн
 * нөөцийг зөвхөн хамгийн сүүлийн өдөрт (on_hand_end) бичнэ. Өдөр тутмын нөөц/
 * stockout илрүүлэлт нь P2-ийн өдөр бүрийн snapshot job-оор нэмэгдэнэ.
 */
import sql from "mssql";
import { normalizeCode } from "@/lib/load/aggregate";
import { type Db, tx } from "@/lib/db/index";
import { setStoreLastSync, upsertStore } from "@/lib/db/repositories/stores";
import {
  finishIngestionRun,
  getSchemaVariant,
  setSchemaVariant,
  startIngestionRun,
  type DatasetStatus,
} from "@/lib/db/repositories/ops";
import { connectPos } from "./connect";
import { probeQuery } from "./probe";
import {
  ACHIV_QUERY,
  BIZPL_QUERIES,
  DAILY_SALES_QUERY,
  HOURLY_TX_QUERY,
  deliveryQueries,
  stockQueries,
  wasteQueries,
} from "./queries";
import { statsLookback, type TxHourlyRow } from "./txStats";
import { upsertTxHourly } from "@/lib/db/repositories/txStats";

export interface IngestRange {
  from: string; // YYYYMMDD
  to: string; // YYYYMMDD
}

export interface IngestResult {
  storeId: number;
  ok: boolean;
  datasets: DatasetStatus;
  rows: number;
  error?: string;
}

interface DailySaleRow {
  d: string;
  item_cd: string;
  item_nm: string | null;
  short_item_nm: string | null;
  sprc: number | null;
  mcls_cd: string | null;
  mcls_nm: string | null;
  scls_cd: string | null;
  scls_nm: string | null;
  qty: number;
  amt: number;
}

export async function ingestStore(
  db: Db,
  store: { id: number; ip: string },
  range: IngestRange,
): Promise<IngestResult> {
  const runId = startIngestionRun(db, store.id);
  const datasets: DatasetStatus = {
    sales: false,
    stock: false,
    waste: false,
    delivery: false,
    tx: false,
  };
  let rowCount = 0;
  let pool: sql.ConnectionPool | undefined;

  const bind = (req: sql.Request) =>
    req
      .input("from", sql.VarChar(8), range.from)
      .input("to", sql.VarChar(8), range.to);

  try {
    pool = await connectPos(store.ip);

    // =========== POS УНШИЛТ (бүх await энд, DB бичилтээс өмнө) ===========

    // --- bizpl_cd (салбарын код) ---
    const bizpl = await probeQuery<{ cd: string }>(pool, BIZPL_QUERIES, {
      preferId: getSchemaVariant(db, store.id, "bizpl"),
    });
    if (bizpl && bizpl.rows[0]?.cd) {
      const cd = String(bizpl.rows[0].cd).trim();
      upsertStore(db, {
        ip: store.ip,
        name: `Салбар ${cd}`,
        bizplCd: cd,
        code: normalizeCode(cd),
      });
      setSchemaVariant(db, store.id, "bizpl", bizpl.variant);
    }

    // --- Өдөр тутмын борлуулалт (заавал) ---
    const salesRes = await bind(pool.request()).query<DailySaleRow>(DAILY_SALES_QUERY);
    datasets.sales = true;

    // --- Нэмэлт (нөөц/хаягдал/нийлүүлэлт): ACHIV эсвэл тусдаа probe ---
    interface ExtraRow {
      itemCd: string;
      d: string;
      onHand: number | null;
      waste: number | null;
      delivered: number | null;
    }
    const extras: ExtraRow[] = [];
    let achivOk = false;
    try {
      const achiv = await bind(pool.request()).query<{
        d: string;
        item_cd: string;
        waste: number;
        delivered: number;
        on_hand: number;
      }>(ACHIV_QUERY);
      for (const r of achiv.recordset) {
        const itemCd = String(r.item_cd ?? "").trim();
        const d = String(r.d ?? "").trim();
        if (!itemCd || !/^\d{8}$/.test(d)) continue;
        extras.push({
          itemCd,
          d,
          onHand: Number(r.on_hand ?? 0),
          waste: Number(r.waste ?? 0),
          delivered: Number(r.delivered ?? 0),
        });
      }
      datasets.stock = true;
      datasets.waste = true;
      datasets.delivery = true;
      setSchemaVariant(db, store.id, "achiv", "TP_ST_SKU_ACHIV");
      achivOk = true;
    } catch {
      // ACHIV байхгүй — тусдаа probe-ууд руу
    }
    if (!achivOk) {
      const stock = await probeQuery<{ item_cd: string; qty: number | null }>(
        pool,
        stockQueries(),
        { preferId: getSchemaVariant(db, store.id, "stock") },
      );
      if (stock) {
        datasets.stock = true;
        setSchemaVariant(db, store.id, "stock", stock.variant);
        for (const r of stock.rows) {
          const itemCd = String(r.item_cd ?? "").trim();
          if (!itemCd) continue;
          extras.push({ itemCd, d: range.to, onHand: Number(r.qty ?? 0), waste: null, delivered: null });
        }
      }
      const waste = await probeQuery<{ d: string; item_cd: string; qty: number | null }>(
        pool,
        wasteQueries(),
        { preferId: getSchemaVariant(db, store.id, "waste"), bind },
      );
      if (waste) {
        datasets.waste = true;
        setSchemaVariant(db, store.id, "waste", waste.variant);
        for (const r of waste.rows) {
          const itemCd = String(r.item_cd ?? "").trim();
          const d = String(r.d ?? "").trim();
          if (!itemCd || !/^\d{8}$/.test(d)) continue;
          extras.push({ itemCd, d, onHand: null, waste: Number(r.qty ?? 0), delivered: null });
        }
      }
      const delivery = await probeQuery<{ d: string; item_cd: string; qty: number | null }>(
        pool,
        deliveryQueries(),
        { preferId: getSchemaVariant(db, store.id, "delivery"), bind },
      );
      if (delivery) {
        datasets.delivery = true;
        setSchemaVariant(db, store.id, "delivery", delivery.variant);
        for (const r of delivery.rows) {
          const itemCd = String(r.item_cd ?? "").trim();
          const d = String(r.d ?? "").trim();
          if (!itemCd || !/^\d{8}$/.test(d)) continue;
          extras.push({ itemCd, d, onHand: null, waste: null, delivered: Number(r.qty ?? 0) });
        }
      }
    }

    // --- Гүйлгээний тоо (чек — TP_TR_HDR), үргэлж now−1month цонх ---
    let txRows: TxHourlyRow[] = [];
    try {
      const txWin = statsLookback(range.to);
      const txRes = await pool
        .request()
        .input("from", sql.VarChar(8), txWin.from)
        .input("to", sql.VarChar(8), txWin.to)
        .query<{
          sale_dt: string;
          hr: number;
          tx_cnt: number;
          amt: number | null;
        }>(HOURLY_TX_QUERY);
      txRows = txRes.recordset
        .filter((r) => r.hr != null && r.sale_dt)
        .map((r) => ({
          saleDt: String(r.sale_dt).trim(),
          hour: Number(r.hr),
          txCount: Number(r.tx_cnt),
          amount: Number(r.amt ?? 0),
        }))
        .filter((r) => r.hour >= 0 && r.hour <= 23 && /^\d{8}$/.test(r.saleDt));
      datasets.tx = true;
    } catch {
      // TP_TR_HDR уншигдсангүй — борлуулалтын ingest үргэлжилнэ
    }

    // =========== DB БИЧИЛТ (нэг transaction, prepared statement дахин ашиглана) ===========
    tx(db, () => {
      const insItem = db.prepare(
        `INSERT INTO items (store_id, item_cd, name, mcls_cd, mcls_nm, scls_cd, scls_nm, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(store_id, item_cd) DO UPDATE SET
           name=excluded.name, mcls_cd=excluded.mcls_cd, mcls_nm=excluded.mcls_nm,
           scls_cd=excluded.scls_cd, scls_nm=excluded.scls_nm, price=excluded.price,
           updated_at=datetime('now')`,
      );
      const insSale = db.prepare(
        `INSERT INTO daily_metrics (store_id, item_cd, d, sold_qty, sold_amt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(store_id, item_cd, d) DO UPDATE SET
           sold_qty=excluded.sold_qty, sold_amt=excluded.sold_amt`,
      );
      const insExtra = db.prepare(
        `INSERT INTO daily_metrics
           (store_id, item_cd, d, sold_qty, sold_amt, on_hand_end, waste_qty, delivered_qty, stockout_flag)
         VALUES (?, ?, ?, 0, 0, ?, ?, ?, 0)
         ON CONFLICT(store_id, item_cd, d) DO UPDATE SET
           on_hand_end=COALESCE(excluded.on_hand_end, daily_metrics.on_hand_end),
           waste_qty=COALESCE(excluded.waste_qty, daily_metrics.waste_qty),
           delivered_qty=COALESCE(excluded.delivered_qty, daily_metrics.delivered_qty)`,
      );

      const seenItems = new Set<string>();
      for (const row of salesRes.recordset) {
        const itemCd = String(row.item_cd ?? "").trim();
        if (!itemCd) continue;
        const d = String(row.d ?? "").trim();
        if (!/^\d{8}$/.test(d)) continue;
        if (!seenItems.has(itemCd)) {
          seenItems.add(itemCd);
          insItem.run(
            store.id,
            itemCd,
            (row.item_nm || row.short_item_nm || itemCd).trim(),
            row.mcls_cd?.trim() || null,
            row.mcls_nm?.trim() || null,
            row.scls_cd?.trim() || null,
            row.scls_nm?.trim() || null,
            row.sprc != null ? Number(row.sprc) : null,
          );
        }
        insSale.run(store.id, itemCd, d, Number(row.qty ?? 0), Number(row.amt ?? 0));
        rowCount++;
      }
      for (const e of extras) {
        insExtra.run(store.id, e.itemCd, e.d, e.onHand, e.waste, e.delivered);
      }
      upsertTxHourly(db, store.id, txRows);
    });

    setStoreLastSync(db, store.id, new Date().toISOString());
    const status = datasets.sales ? (datasets.stock ? "ok" : "degraded") : "degraded";
    finishIngestionRun(db, runId, { status, datasets, rows: rowCount });
    return { storeId: store.id, ok: true, datasets, rows: rowCount };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    finishIngestionRun(db, runId, { status: "failed", datasets, rows: rowCount, error });
    return { storeId: store.id, ok: false, datasets, rows: rowCount, error };
  } finally {
    try {
      await pool?.close();
    } catch {
      // ignore
    }
  }
}
