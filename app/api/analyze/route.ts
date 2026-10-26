import { NextResponse } from "next/server";
import sql from "mssql";
import type { HourlyRow, PosAnalyzeResult } from "@/lib/load/types";
import { HOURLY_TX_QUERY } from "@/lib/pos/queries";

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
    requestTimeout: 30000,
    pool: { max: 2, min: 0 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}


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
      // хүснэгт байхгүй бол дараагийн хувилбарыг турших
    }
  }
  return undefined;
}

async function analyzePos(
  ip: string,
  from: string,
  to: string,
): Promise<PosAnalyzeResult> {
  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await new sql.ConnectionPool(posConfig(ip)).connect();

    const bizplCd = await readBizplCd(pool);

    const res = await pool
      .request()
      .input("from", sql.VarChar(8), from)
      .input("to", sql.VarChar(8), to)
      .query<{ sale_dt: string; hr: number; tx_cnt: number; amt: number | null }>(
        HOURLY_TX_QUERY,
      );

    const rows: HourlyRow[] = res.recordset
      .filter((r) => r.hr !== null && r.sale_dt)
      .map((r) => ({
        saleDt: String(r.sale_dt).trim(),
        hour: Number(r.hr),
        txCount: Number(r.tx_cnt),
        amount: Number(r.amt ?? 0),
      }));

    return { ip, status: "ok", bizplCd, rows };
  } catch (e) {
    return {
      ip,
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    try {
      await pool?.close();
    } catch {
      // хаагдахад алдаа гарвал үл тоомсорлоно
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
