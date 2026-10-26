/**
 * Гүйлгээний ачааллын API.
 *
 * GET  ?storeId=N[&asOf=YYYYMMDD]  → нэг дэлгүүр (кэш)
 * GET  [&asOf=YYYYMMDD]            → бүх дэлгүүр
 * POST { storeId | storeIds, asOf?, refresh? }
 *      refresh=true үед POS-оос дахин татаж кэш шинэчилнэ.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getStore, listStores } from "@/lib/db/repositories/stores";
import {
  getStoreTxStats,
  hasTxHourly,
  listTxHourly,
  upsertTxHourly,
} from "@/lib/db/repositories/txStats";
import {
  fetchTxFromPos,
  statsLookback,
  summarizeTx,
  todayYmd,
  type TxStats,
} from "@/lib/pos/txStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface StoreTxPayload {
  storeId: number;
  name: string;
  ip: string;
  stats: TxStats;
  source: "cache" | "pos";
}

function resolveAsOf(raw: unknown): string {
  const s = raw != null ? String(raw) : "";
  if (/^\d{8}$/.test(s)) return s;
  return todayYmd();
}

function payloadFor(storeId: number, name: string, ip: string, asOf: string): StoreTxPayload {
  return {
    storeId,
    name,
    ip,
    stats: getStoreTxStats(getDb(), storeId, asOf),
    source: "cache",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeIdRaw = url.searchParams.get("storeId");
  const asOfParam = url.searchParams.get("asOf");
  const db = getDb();

  if (storeIdRaw) {
    const storeId = Number(storeIdRaw);
    if (!Number.isFinite(storeId)) {
      return NextResponse.json({ error: "Буруу storeId" }, { status: 400 });
    }
    const store = getStore(db, storeId);
    if (!store) {
      return NextResponse.json({ error: "Дэлгүүр олдсонгүй" }, { status: 404 });
    }
    const asOf = resolveAsOf(asOfParam);
    return NextResponse.json(payloadFor(store.id, store.name, store.ip, asOf));
  }

  const stores = listStores(db);
  const asOfDefault = resolveAsOf(asOfParam);
  return NextResponse.json({
    asOf: asOfDefault,
    stores: stores.map((s) => {
      const asOf = resolveAsOf(asOfParam);
      return payloadFor(s.id, s.name, s.ip, asOf);
    }),
  });
}

export async function POST(req: Request) {
  let body: {
    storeId?: unknown;
    storeIds?: unknown;
    asOf?: unknown;
    refresh?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }

  const db = getDb();
  const ids: number[] = [];
  if (Array.isArray(body.storeIds)) {
    for (const v of body.storeIds) {
      const n = Number(v);
      if (Number.isFinite(n)) ids.push(n);
    }
  } else if (body.storeId != null) {
    const n = Number(body.storeId);
    if (Number.isFinite(n)) ids.push(n);
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "storeId шаардлагатай" }, { status: 400 });
  }

  const refresh = body.refresh === true;
  const results: StoreTxPayload[] = [];
  const errors: { storeId: number; error: string }[] = [];

  for (const id of ids) {
    const store = getStore(db, id);
    if (!store) {
      errors.push({ storeId: id, error: "Дэлгүүр олдсонгүй" });
      continue;
    }
    const asOf = resolveAsOf(body.asOf);

    if (refresh) {
      if (!process.env.POS_DB_PASSWORD) {
        errors.push({
          storeId: id,
          error: "POS_DB_PASSWORD тохируулаагүй — кэшээс уншив",
        });
        results.push(payloadFor(store.id, store.name, store.ip, asOf));
        continue;
      }
      const { from } = statsLookback(asOf);
      try {
        const rows = await fetchTxFromPos(store.ip, from, asOf);
        upsertTxHourly(db, store.id, rows);
        results.push({
          storeId: store.id,
          name: store.name,
          ip: store.ip,
          stats: summarizeTx(listTxHourly(db, store.id, from, asOf), asOf),
          source: "pos",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ storeId: id, error: msg });
        if (hasTxHourly(db, store.id)) {
          results.push(payloadFor(store.id, store.name, store.ip, asOf));
        }
      }
    } else {
      results.push(payloadFor(store.id, store.name, store.ip, asOf));
    }
  }

  return NextResponse.json({ results, errors });
}
