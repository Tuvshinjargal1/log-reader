/**
 * Схем тодорхойгүй асуулгыг хэд хэдэн хувилбараар туршиж, эхний ажиллаж буйг
 * буцаана (graceful degradation). Ажилласан хувилбарын id-г кэшлэхэд ашиглана.
 */
import type sql from "mssql";

export interface ProbeVariant {
  id: string;
  sql: string;
}

export interface ProbeResult<T> {
  rows: T[];
  variant: string;
}

/**
 * @param preferId store_schema_map-д кэшлэсэн хувилбар байвал эхэлж түүнийг туршина.
 * @param bind    @from/@to зэрэг параметр холбох (шаардлагатай бол).
 */
export async function probeQuery<T>(
  pool: sql.ConnectionPool,
  variants: ProbeVariant[],
  opts?: {
    preferId?: string | null;
    bind?: (req: sql.Request) => sql.Request;
  },
): Promise<ProbeResult<T> | null> {
  const ordered = [...variants];
  if (opts?.preferId) {
    ordered.sort((a, b) =>
      a.id === opts.preferId ? -1 : b.id === opts.preferId ? 1 : 0,
    );
  }
  for (const v of ordered) {
    try {
      let req = pool.request();
      if (opts?.bind) req = opts.bind(req);
      const r = await req.query<T>(v.sql);
      return { rows: r.recordset, variant: v.id };
    } catch {
      // дараагийн хувилбар руу
    }
  }
  return null;
}
