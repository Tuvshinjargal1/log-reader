/**
 * node:sqlite (Node 22-д суурилсан) дээрх ганц (singleton) DB холболт.
 *
 * - node:sqlite нь native build ч, туршилтын флаг ч шаардахгүй ажиллана.
 * - Next-ийн dev hot-reload үед олон холболт нээхээс сэргийлж globalThis-д кэшлэнэ.
 * - WAL горим — нэг серверийн бичих/унших зэрэгцээг сайжруулна.
 * - Схемийг PRAGMA user_version-оор хувилбарчилж, шаардлагатай үед migrate хийнэ.
 *
 * Прод дээр better-sqlite3 / Postgres руу шилжихэд энэ модуль болон
 * lib/db/repositories/* л өөрчлөгдөнө (бусад код repository-оор дамжина).
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export type Db = DatabaseSync;

const DB_PATH =
  process.env.REPLENISH_DB_PATH ?? join(process.cwd(), "data", "replenish.db");

declare global {
  var __replenishDb: DatabaseSync | undefined;
}

function migrate(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;
  const current = Number(row?.user_version ?? 0);
  if (current < SCHEMA_VERSION) {
    db.exec(SCHEMA_SQL);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/**
 * Тодорхой замд DB нээнэ (seed/CLI хэрэгслүүдэд; singleton-д нөлөөлөхгүй).
 *
 * `tsx` нь `.env.local`-ыг уншдаггүй, Windows дээр npm script-д inline env var
 * өгөх боломжгүй тул CLI-ууд замаа өөрсдөө шийднэ.
 */
export function openDbAt(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

function open(): DatabaseSync {
  return openDbAt(DB_PATH);
}

/** Процессийн туршид дундын нэг DB холболт буцаана. */
export function getDb(): DatabaseSync {
  if (!globalThis.__replenishDb) {
    globalThis.__replenishDb = open();
  }
  return globalThis.__replenishDb;
}

/** Тестэд зориулж шинэ in-memory DB нээнэ (singleton-д нөлөөлөхгүй). */
export function openTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}

/** Хэд хэдэн бичих үйлдлийг нэг гүйлгээнд боож ажиллуулна. */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
