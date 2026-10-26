/** Улирлын профайл (seasonality_profile) repository. */
import type { Db } from "../index";
import { tx } from "../index";
import type { SeasonalityProfile } from "@/lib/engine/seasonality";

export function saveSeasonality(
  db: Db,
  storeId: number,
  profile: SeasonalityProfile,
): void {
  tx(db, () => {
    const stmt = db.prepare(
      `INSERT INTO seasonality_profile (store_id, scope, bucket, multiplier, sample_count, confidence)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(store_id, scope, bucket) DO UPDATE SET
         multiplier = excluded.multiplier,
         sample_count = excluded.sample_count,
         confidence = excluded.confidence,
         updated_at = datetime('now')`,
    );
    for (const b of profile.dow) {
      stmt.run(storeId, "dow", b.bucket, b.multiplier, b.sampleCount, b.confidence);
    }
    for (const b of profile.month) {
      stmt.run(storeId, "month", b.bucket, b.multiplier, b.sampleCount, b.confidence);
    }
  });
}

export interface StoredSeasonBucket {
  scope: string;
  bucket: number;
  multiplier: number;
  sampleCount: number;
  confidence: number;
}

export function getSeasonality(db: Db, storeId: number): StoredSeasonBucket[] {
  const rows = db
    .prepare(
      "SELECT scope, bucket, multiplier, sample_count, confidence FROM seasonality_profile WHERE store_id = ? ORDER BY scope, bucket",
    )
    .all(storeId) as unknown as {
    scope: string;
    bucket: number;
    multiplier: number;
    sample_count: number;
    confidence: number;
  }[];
  return rows.map((r) => ({
    scope: r.scope,
    bucket: r.bucket,
    multiplier: r.multiplier,
    sampleCount: r.sample_count,
    confidence: r.confidence,
  }));
}
