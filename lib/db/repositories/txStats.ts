/** POS гүйлгээний цагийн нэгтгэлийн repository. */
import type { Db } from "../index";
import {
  statsLookback,
  summarizeTx,
  type TxHourlyRow,
  type TxStats,
} from "@/lib/pos/txStats";

export function upsertTxHourly(
  db: Db,
  storeId: number,
  rows: TxHourlyRow[],
): number {
  if (rows.length === 0) return 0;
  const stmt = db.prepare(
    `INSERT INTO tx_hourly (store_id, d, hour, tx_count, amount)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(store_id, d, hour) DO UPDATE SET
       tx_count = excluded.tx_count,
       amount   = excluded.amount`,
  );
  let n = 0;
  for (const r of rows) {
    if (!/^\d{8}$/.test(r.saleDt) || r.hour < 0 || r.hour > 23) continue;
    stmt.run(storeId, r.saleDt, r.hour, r.txCount, r.amount);
    n++;
  }
  return n;
}

export function listTxHourly(
  db: Db,
  storeId: number,
  from: string,
  to: string,
): TxHourlyRow[] {
  const rows = db
    .prepare(
      `SELECT d, hour, tx_count, amount
         FROM tx_hourly
        WHERE store_id = ? AND d BETWEEN ? AND ?
        ORDER BY d, hour`,
    )
    .all(storeId, from, to) as {
    d: string;
    hour: number;
    tx_count: number;
    amount: number;
  }[];
  return rows.map((r) => ({
    saleDt: r.d,
    hour: Number(r.hour),
    txCount: Number(r.tx_count),
    amount: Number(r.amount),
  }));
}

export function hasTxHourly(db: Db, storeId: number): boolean {
  const r = db
    .prepare("SELECT 1 AS ok FROM tx_hourly WHERE store_id = ? LIMIT 1")
    .get(storeId) as { ok: number } | undefined;
  return r != null;
}

/** Хамгийн сүүлд гүйлгээ бүртгэгдсэн өдөр (кэш хоосон бол null). */
export function latestTxDate(db: Db, storeId: number): string | null {
  const r = db
    .prepare("SELECT MAX(d) AS d FROM tx_hourly WHERE store_id = ?")
    .get(storeId) as { d: string | null } | undefined;
  return r?.d ?? null;
}

export function getStoreTxStats(
  db: Db,
  storeId: number,
  asOf: string,
): TxStats {
  const { from } = statsLookback(asOf);
  const rows = listTxHourly(db, storeId, from, asOf);
  return summarizeTx(rows, asOf);
}

export function clearStoreTx(db: Db, storeId: number): void {
  db.prepare("DELETE FROM tx_hourly WHERE store_id = ?").run(storeId);
}
