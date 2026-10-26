/** Дэлгүүр, оператор, хуваарилалтын repository. */
import type { Db } from "../index";
import { tx } from "../index";

export interface StoreRow {
  id: number;
  ip: string;
  bizplCd: string | null;
  code: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  lastSyncAt: string | null;
}

interface StoreDbRow {
  id: number;
  ip: string;
  bizpl_cd: string | null;
  code: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  enabled: number;
  last_sync_at: string | null;
}

function mapStore(r: StoreDbRow): StoreRow {
  return {
    id: Number(r.id),
    ip: r.ip,
    bizplCd: r.bizpl_cd,
    code: r.code,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    enabled: r.enabled === 1,
    lastSyncAt: r.last_sync_at,
  };
}

export interface UpsertStoreInput {
  ip: string;
  bizplCd?: string | null;
  code?: string | null;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

/** IP-ээр давхардлыг шалгаж дэлгүүрийг бүртгэх/шинэчлэх. store_id буцаана. */
export function upsertStore(db: Db, input: UpsertStoreInput): number {
  const existing = db
    .prepare("SELECT id FROM stores WHERE ip = ?")
    .get(input.ip) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE stores
          SET bizpl_cd = COALESCE(?, bizpl_cd),
              code     = COALESCE(?, code),
              name     = ?,
              lat      = COALESCE(?, lat),
              lng      = COALESCE(?, lng)
        WHERE id = ?`,
    ).run(
      input.bizplCd ?? null,
      input.code ?? null,
      input.name,
      input.lat ?? null,
      input.lng ?? null,
      existing.id,
    );
    return Number(existing.id);
  }

  const res = db
    .prepare(
      `INSERT INTO stores (ip, bizpl_cd, code, name, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.ip,
      input.bizplCd ?? null,
      input.code ?? null,
      input.name,
      input.lat ?? null,
      input.lng ?? null,
    );
  return Number(res.lastInsertRowid);
}

export function getStore(db: Db, id: number): StoreRow | null {
  const r = db.prepare("SELECT * FROM stores WHERE id = ?").get(id) as
    | StoreDbRow
    | undefined;
  return r ? mapStore(r) : null;
}

export function listStores(db: Db): StoreRow[] {
  const rows = db
    .prepare("SELECT * FROM stores ORDER BY name COLLATE NOCASE")
    .all() as unknown as StoreDbRow[];
  return rows.map(mapStore);
}

export function setStoreLastSync(db: Db, id: number, iso: string): void {
  db.prepare("UPDATE stores SET last_sync_at = ? WHERE id = ?").run(iso, id);
}

export function setStoreEnabled(db: Db, id: number, enabled: boolean): void {
  db.prepare("UPDATE stores SET enabled = ? WHERE id = ?").run(
    enabled ? 1 : 0,
    id,
  );
}

/** Дэлгүүрийг бүрэн устгана (метрик, захиалга, config, SMS — бүгд cascade). */
export function deleteStore(db: Db, id: number): void {
  db.prepare("DELETE FROM stores WHERE id = ?").run(id);
}

/**
 * Дэлгүүрийн ТАТСАН/ТООЦСОН датаг цэвэрлэнэ (метрик, каталог, захиалга, SMS,
 * дохио, ingestion, улирал, probe кэш). Дэлгүүр өөрөө, түүний config, оператор
 * хуваарилалт, tuning түүх ХЭВЭЭР үлдэнэ — дахин цэвэрхэн ingest хийх боломжтой.
 */
export function clearStoreData(db: Db, id: number): void {
  tx(db, () => {
    for (const t of [
      "daily_metrics",
      "items",
      "orders", // → order_lines, sms_outbox cascade
      "alerts",
      "ingestion_runs",
      "seasonality_profile",
      "store_schema_map",
      "tx_hourly",
    ]) {
      db.prepare(`DELETE FROM ${t} WHERE store_id = ?`).run(id);
    }
    db.prepare("UPDATE stores SET last_sync_at = NULL WHERE id = ?").run(id);
  });
}

// --- Оператор ---

export interface OperatorRow {
  id: number;
  name: string;
  email: string | null;
  role: string;
}

export function upsertOperator(
  db: Db,
  input: { name: string; email?: string | null; role?: string },
): number {
  const existing = input.email
    ? (db.prepare("SELECT id FROM operators WHERE email = ?").get(input.email) as
        | { id: number }
        | undefined)
    : undefined;
  if (existing) return Number(existing.id);
  const res = db
    .prepare("INSERT INTO operators (name, email, role) VALUES (?, ?, ?)")
    .run(input.name, input.email ?? null, input.role ?? "operator");
  return Number(res.lastInsertRowid);
}

export function assignStore(db: Db, operatorId: number, storeId: number): void {
  db.prepare(
    "INSERT OR IGNORE INTO operator_stores (operator_id, store_id) VALUES (?, ?)",
  ).run(operatorId, storeId);
}

export function listOperators(db: Db): OperatorRow[] {
  return db
    .prepare("SELECT id, name, email, role FROM operators ORDER BY name COLLATE NOCASE")
    .all() as unknown as OperatorRow[];
}

export function getOperator(db: Db, id: number): OperatorRow | null {
  const r = db
    .prepare("SELECT id, name, email, role FROM operators WHERE id = ?")
    .get(id) as OperatorRow | undefined;
  return r ?? null;
}

/** Оператор бүрийг хариуцаж буй дэлгүүрийн тоотой нь хамт жагсаана. */
export function listOperatorsWithCounts(
  db: Db,
): (OperatorRow & { storeCount: number })[] {
  const rows = db
    .prepare(
      `SELECT o.id, o.name, o.email, o.role, COUNT(os.store_id) AS store_count
         FROM operators o
         LEFT JOIN operator_stores os ON os.operator_id = o.id
        GROUP BY o.id
        ORDER BY store_count DESC, o.name COLLATE NOCASE`,
    )
    .all() as unknown as (OperatorRow & { store_count: number })[];
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    email: r.email,
    role: r.role,
    storeCount: Number(r.store_count),
  }));
}

export function listOperatorStores(db: Db, operatorId: number): StoreRow[] {
  const rows = db
    .prepare(
      `SELECT s.* FROM stores s
         JOIN operator_stores os ON os.store_id = s.id
        WHERE os.operator_id = ?
        ORDER BY s.name COLLATE NOCASE`,
    )
    .all(operatorId) as unknown as StoreDbRow[];
  return rows.map(mapStore);
}
