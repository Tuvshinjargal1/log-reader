import { NextResponse } from "next/server";
import sql from "mssql";
import type { SmsItemSale, SmsPosResult } from "@/lib/sms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 8;
const MAX_IPS_PER_REQUEST = 40;

function posConfig(ip: string): sql.config {
  return {
    server: ip,
    port: Number(process.env.POS_DB_PORT ?? 1433),
    user: process.env.POS_DB_USER ?? "sa",
    password: process.env.POS_DB_PASSWORD ?? "",
    database: process.env.POS_DB_NAME ?? "DCSPS",
    connectionTimeout: 6000,
    requestTimeout: 60000,
    pool: { max: 2, min: 0 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}

const ITEM_SALES_QUERY = `
  SELECT i.item_cd,
         m.item_nm,
         m.short_item_nm,
         m.sprc,
         mc.item_mcls_nm,
         sc.item_scls_nm,
         SUM(CAST(i.sell_qty AS FLOAT)) AS qty,
         COUNT(DISTINCT i.sale_dt) AS days_sold
    FROM TP_TR_ITEM i WITH (NOLOCK)
    JOIN TP_TR_HDR h WITH (NOLOCK)
      ON h.sale_dt = i.sale_dt
     AND h.pos_no = i.pos_no
     AND h.sell_seqno = i.sell_seqno
    LEFT JOIN TP_MS_ITEM m WITH (NOLOCK) ON m.item_cd = i.item_cd
    LEFT JOIN TP_MS_MCLS mc WITH (NOLOCK) ON mc.item_mcls_cd = m.item_mcls_cd
    LEFT JOIN TP_MS_SCLS sc WITH (NOLOCK)
      ON sc.item_mcls_cd = m.item_mcls_cd
     AND sc.item_scls_cd = m.item_scls_cd
   WHERE i.sale_dt BETWEEN @from AND @to
     AND h.deal_sp_cd = '01'
     AND ISNULL(i.sku_cncl_yn, 'N') = 'N'
   GROUP BY i.item_cd, m.item_nm, m.short_item_nm, m.sprc,
            mc.item_mcls_nm, sc.item_scls_nm
`;

async function readBizplCd(pool: sql.ConnectionPool): Promise<string | undefined> {
  const queries = [
    "SELECT TOP 1 fst_cvs_site_cd AS cd FROM TP_SS_POS_CNF WITH (NOLOCK)",
    "SELECT TOP 1 cvs_site_cd AS cd FROM TP_MS_SITE WITH (NOLOCK)",
  ];
  for (const q of queries) {
    try {
      const r = await pool.request().query<{ cd: string }>(q);
      const cd = r.recordset[0]?.cd?.trim();
      if (cd) return cd;
    } catch {
      // дараагийн хувилбар
    }
  }
  return undefined;
}

/** Нөөц унших оролдлого — схем тодорхойгүй тул хэдэн баганы нэрийг туршина */
async function readStockMap(
  pool: sql.ConnectionPool,
): Promise<{ map: Map<string, number>; available: boolean }> {
  const candidates = [
    `SELECT item_cd AS item_cd, CAST(stk_qty AS FLOAT) AS qty FROM TP_ST_SKU_STK WITH (NOLOCK)`,
    `SELECT item_cd AS item_cd, CAST(pres_qty AS FLOAT) AS qty FROM TP_ST_SKU_STK WITH (NOLOCK)`,
    `SELECT goods_cd AS item_cd, CAST(stk_qty AS FLOAT) AS qty FROM TP_ST_SKU_STK WITH (NOLOCK)`,
  ];

  for (const q of candidates) {
    try {
      const r = await pool.request().query<{ item_cd: string; qty: number | null }>(q);
      const map = new Map<string, number>();
      for (const row of r.recordset) {
        const cd = String(row.item_cd ?? "").trim();
        if (!cd) continue;
        map.set(cd, Number(row.qty ?? 0));
      }
      return { map, available: true };
    } catch {
      // багана/хүснэгт тохирохгүй
    }
  }
  return { map: new Map(), available: false };
}

async function analyzePos(
  ip: string,
  from: string,
  to: string,
): Promise<SmsPosResult> {
  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await new sql.ConnectionPool(posConfig(ip)).connect();
    const bizplCd = await readBizplCd(pool);

    const res = await pool
      .request()
      .input("from", sql.VarChar(8), from)
      .input("to", sql.VarChar(8), to)
      .query<{
        item_cd: string;
        item_nm: string | null;
        short_item_nm: string | null;
        sprc: number | null;
        item_mcls_nm: string | null;
        item_scls_nm: string | null;
        qty: number;
        days_sold: number;
      }>(ITEM_SALES_QUERY);

    const { map: stockMap, available: stockAvailable } = await readStockMap(pool);

    const items: SmsItemSale[] = res.recordset.map((row) => {
      const itemCd = String(row.item_cd ?? "").trim();
      const name =
        (row.item_nm || row.short_item_nm || itemCd || "Нэргүй").trim();
      const category =
        [row.item_mcls_nm, row.item_scls_nm]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(" › ") || null;
      const stock = stockAvailable ? (stockMap.get(itemCd) ?? 0) : null;
      return {
        itemCd,
        name,
        category,
        price: row.sprc != null ? Number(row.sprc) : null,
        qty: Number(row.qty ?? 0),
        daysSold: Number(row.days_sold ?? 0),
        stock,
      };
    });

    return { ip, ok: true, bizplCd, items, stockAvailable };
  } catch (e) {
    return {
      ip,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    try {
      await pool?.close();
    } catch {
      // ignore
    }
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  if (!process.env.POS_DB_PASSWORD) {
    return NextResponse.json(
      { error: "POS_DB_PASSWORD тохируулаагүй байна (.env.local файлд нэмнэ үү)" },
      { status: 500 },
    );
  }

  let body: { ips?: unknown; from?: unknown; to?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }

  const ips = Array.isArray(body.ips)
    ? [...new Set(body.ips.map((v) => String(v).trim()).filter(Boolean))]
    : [];
  const from = String(body.from ?? "");
  const to = String(body.to ?? "");

  if (ips.length === 0) {
    return NextResponse.json({ error: "IP жагсаалт хоосон байна" }, { status: 400 });
  }
  if (ips.length > MAX_IPS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Нэг хүсэлтэд дээд тал нь ${MAX_IPS_PER_REQUEST} IP байна` },
      { status: 400 },
    );
  }
  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) {
    return NextResponse.json(
      { error: "from/to нь YYYYMMDD форматтай байх ёстой" },
      { status: 400 },
    );
  }

  const results = await runWithConcurrency(ips, CONCURRENCY, (ip) =>
    analyzePos(ip, from, to),
  );

  return NextResponse.json({ results });
}
