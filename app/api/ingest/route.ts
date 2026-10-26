/**
 * POS-оос өдөр тутмын датаг татаж SQLite-д хадгална (bootstrap + ingest).
 * POST { ips: string[], from: "YYYYMMDD", to: "YYYYMMDD" }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { upsertStore } from "@/lib/db/repositories/stores";
import { ingestStore } from "@/lib/pos/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 6;
const MAX_IPS = 60;

/** Нэг дэлгүүр хэт удаан блоклохоос сэргийлж хатуу timeout тавина. */
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(onTimeout()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(onTimeout());
      },
    );
  });
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
      { error: "POS_DB_PASSWORD тохируулаагүй байна (.env.local)" },
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
    return NextResponse.json({ error: "IP жагсаалт хоосон" }, { status: 400 });
  }
  if (ips.length > MAX_IPS) {
    return NextResponse.json(
      { error: `Дээд тал нь ${MAX_IPS} IP` },
      { status: 400 },
    );
  }
  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) {
    return NextResponse.json(
      { error: "from/to нь YYYYMMDD байх ёстой" },
      { status: 400 },
    );
  }

  const db = getDb();

  // Bootstrap — IP тус бүрийг бүртгэнэ (нэр ingest дотор bizpl-ээр шинэчлэгдэнэ)
  const stores = ips.map((ip) => ({
    id: upsertStore(db, { ip, name: `IP ${ip}` }),
    ip,
  }));

  const results = await runWithConcurrency(stores, CONCURRENCY, (s) =>
    withTimeout(ingestStore(db, s, { from, to }), 45000, () => ({
      storeId: s.id,
      ok: false,
      datasets: { sales: false, stock: false, waste: false, delivery: false, tx: false },
      rows: 0,
      error: "Хугацаа хэтэрсэн (45 сек)",
    })),
  );

  return NextResponse.json({
    from,
    to,
    results: results.map((r, i) => ({ ip: stores[i].ip, ...r })),
  });
}
