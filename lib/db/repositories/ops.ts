/** Ingestion гүйлт, probe кэш, аудит, дохионы repository. */
import type { Db } from "../index";

// --- Ingestion runs ---

export interface DatasetStatus {
  sales: boolean;
  stock: boolean;
  waste: boolean;
  delivery: boolean;
  tx?: boolean;
}

export function startIngestionRun(db: Db, storeId: number | null): number {
  const res = db
    .prepare("INSERT INTO ingestion_runs (store_id, status) VALUES (?, 'running')")
    .run(storeId);
  return Number(res.lastInsertRowid);
}

export function finishIngestionRun(
  db: Db,
  runId: number,
  info: {
    status: "ok" | "degraded" | "failed";
    datasets?: DatasetStatus;
    rows?: number;
    error?: string | null;
  },
): void {
  db.prepare(
    `UPDATE ingestion_runs
        SET finished_at = datetime('now'), status = ?, datasets = ?, rows = ?, error = ?
      WHERE id = ?`,
  ).run(
    info.status,
    info.datasets ? JSON.stringify(info.datasets) : null,
    info.rows ?? null,
    info.error ?? null,
    runId,
  );
}

export interface IngestionRunRow {
  id: number;
  storeId: number | null;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  datasets: DatasetStatus | null;
  rows: number | null;
  error: string | null;
}

export function latestIngestionRun(
  db: Db,
  storeId: number,
): IngestionRunRow | null {
  const r = db
    .prepare(
      "SELECT * FROM ingestion_runs WHERE store_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(storeId) as
    | {
        id: number;
        store_id: number | null;
        started_at: string;
        finished_at: string | null;
        status: string;
        datasets: string | null;
        rows: number | null;
        error: string | null;
      }
    | undefined;
  if (!r) return null;
  let datasets: DatasetStatus | null = null;
  if (r.datasets) {
    try {
      datasets = JSON.parse(r.datasets) as DatasetStatus;
    } catch {
      datasets = null;
    }
  }
  return {
    id: Number(r.id),
    storeId: r.store_id != null ? Number(r.store_id) : null,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    datasets,
    rows: r.rows,
    error: r.error,
  };
}

// --- Probe (schema) кэш ---

export function getSchemaVariant(
  db: Db,
  storeId: number,
  dataset: string,
): string | null {
  const r = db
    .prepare(
      "SELECT query_variant FROM store_schema_map WHERE store_id = ? AND dataset = ?",
    )
    .get(storeId, dataset) as { query_variant: string } | undefined;
  return r?.query_variant ?? null;
}

export function setSchemaVariant(
  db: Db,
  storeId: number,
  dataset: string,
  variant: string,
): void {
  db.prepare(
    `INSERT INTO store_schema_map (store_id, dataset, query_variant)
     VALUES (?, ?, ?)
     ON CONFLICT(store_id, dataset) DO UPDATE SET
       query_variant = excluded.query_variant, updated_at = datetime('now')`,
  ).run(storeId, dataset, variant);
}

// --- Audit ---

export function audit(
  db: Db,
  entry: {
    actor?: string | null;
    action: string;
    entity?: string | null;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
): void {
  db.prepare(
    `INSERT INTO audit_log (actor, action, entity, entity_id, before, after)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.actor ?? null,
    entry.action,
    entry.entity ?? null,
    entry.entityId ?? null,
    entry.before != null ? JSON.stringify(entry.before) : null,
    entry.after != null ? JSON.stringify(entry.after) : null,
  );
}

export interface AuditRow {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  before: string | null;
  after: string | null;
}

/** Аудитын бүртгэл (сүүлийнхээс нааш). storeId өгвөл тухайн дэлгүүрээр шүүнэ. */
export function listAuditLog(
  db: Db,
  opts: { storeId?: number | null; limit?: number } = {},
): AuditRow[] {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  // audit_log-д store_id багана байхгүй — after/before JSON доторх storeId
  // болон order entity-ээр шүүнэ.
  const rows =
    opts.storeId != null
      ? (db
          .prepare(
            `SELECT a.* FROM audit_log a
              WHERE a.after LIKE ?
                 OR (a.entity = 'order' AND a.entity_id IN
                      (SELECT CAST(id AS TEXT) FROM orders WHERE store_id = ?))
              ORDER BY a.id DESC LIMIT ?`,
          )
          .all(`%"storeId":${opts.storeId}%`, opts.storeId, limit) as unknown as AuditRow[])
      : (db
          .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?")
          .all(limit) as unknown as AuditRow[]);

  return rows.map((r) => ({
    id: Number(r.id),
    at: r.at,
    actor: r.actor,
    action: r.action,
    entity: r.entity,
    entityId: (r as unknown as { entity_id: string | null }).entity_id ?? r.entityId,
    before: r.before,
    after: r.after,
  }));
}

// --- Alerts ---

export type AlertKind =
  | "stockout_risk"
  | "offline"
  | "stale"
  | "spike"
  | "waste"
  | "low_confidence";
export type AlertSeverity = "info" | "warn" | "critical";

export interface AlertRow {
  id: number;
  storeId: number | null;
  kind: AlertKind;
  severity: AlertSeverity;
  itemCd: string | null;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

export function raiseAlert(
  db: Db,
  a: {
    storeId: number | null;
    kind: AlertKind;
    severity: AlertSeverity;
    itemCd?: string | null;
    message: string;
  },
): void {
  db.prepare(
    `INSERT INTO alerts (store_id, kind, severity, item_cd, message)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(a.storeId, a.kind, a.severity, a.itemCd ?? null, a.message);
}

export function listOpenAlerts(db: Db): AlertRow[] {
  const rows = db
    .prepare(
      "SELECT * FROM alerts WHERE resolved_at IS NULL ORDER BY created_at DESC",
    )
    .all() as unknown as {
    id: number;
    store_id: number | null;
    kind: string;
    severity: string;
    item_cd: string | null;
    message: string;
    created_at: string;
    resolved_at: string | null;
  }[];
  return rows.map((r) => ({
    id: Number(r.id),
    storeId: r.store_id != null ? Number(r.store_id) : null,
    kind: r.kind as AlertKind,
    severity: r.severity as AlertSeverity,
    itemCd: r.item_cd,
    message: r.message,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));
}

/** Тухайн дэлгүүрийн шийдэгдээгүй дохиог цэвэрлэнэ (шинээр тооцохын өмнө). */
export function clearStoreAlerts(db: Db, storeId: number): void {
  db.prepare(
    "UPDATE alerts SET resolved_at = datetime('now') WHERE store_id = ? AND resolved_at IS NULL",
  ).run(storeId);
}
