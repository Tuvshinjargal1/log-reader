/** Tuning түүх (tuning_history) repository. */
import type { Db } from "../index";

export interface TuningHistoryInput {
  storeId: number | null;
  scope: "store" | "category" | "item";
  scopeKey?: string | null;
  param: string;
  fromValue: unknown;
  toValue: unknown;
  reason?: string | null;
  appliedBy?: string | null;
}

export function addTuningHistory(db: Db, e: TuningHistoryInput): void {
  db.prepare(
    `INSERT INTO tuning_history (store_id, scope, scope_key, param, from_value, to_value, reason, applied_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    e.storeId,
    e.scope,
    e.scopeKey ?? null,
    e.param,
    e.fromValue != null ? JSON.stringify(e.fromValue) : null,
    e.toValue != null ? JSON.stringify(e.toValue) : null,
    e.reason ?? null,
    e.appliedBy ?? null,
  );
}

export interface TuningHistoryRow {
  id: number;
  at: string;
  storeId: number | null;
  scope: string;
  scopeKey: string | null;
  param: string;
  fromValue: string | null;
  toValue: string | null;
  reason: string | null;
  appliedBy: string | null;
}

export function listTuningHistory(
  db: Db,
  storeId: number,
  limit = 50,
): TuningHistoryRow[] {
  const rows = db
    .prepare(
      "SELECT * FROM tuning_history WHERE store_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(storeId, limit) as unknown as {
    id: number;
    at: string;
    store_id: number | null;
    scope: string;
    scope_key: string | null;
    param: string;
    from_value: string | null;
    to_value: string | null;
    reason: string | null;
    applied_by: string | null;
  }[];
  return rows.map((r) => ({
    id: Number(r.id),
    at: r.at,
    storeId: r.store_id != null ? Number(r.store_id) : null,
    scope: r.scope,
    scopeKey: r.scope_key,
    param: r.param,
    fromValue: r.from_value,
    toValue: r.to_value,
    reason: r.reason,
    appliedBy: r.applied_by,
  }));
}
