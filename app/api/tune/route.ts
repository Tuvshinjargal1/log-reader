/**
 * Auto-tune зөвлөмжийг батлах / tuning түүх.
 *  - GET  ?storeId=N → tuning түүх
 *  - POST { storeId, scope, scopeKey?, param, from, to, reason?, by? } → батлах
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { applyTuning } from "@/lib/replenish/applyTuning";
import { listTuningHistory } from "@/lib/db/repositories/tuning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("storeId");
  const storeId = Number(raw);
  if (raw == null || !Number.isFinite(storeId)) {
    return NextResponse.json({ error: "storeId шаардлагатай" }, { status: 400 });
  }
  const db = getDb();
  return NextResponse.json({ history: listTuningHistory(db, storeId) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }

  const storeId = Number(body.storeId);
  const scope = String(body.scope ?? "");
  const param = String(body.param ?? "");
  const from = Number(body.from);
  const to = Number(body.to);

  if (!Number.isFinite(storeId)) {
    return NextResponse.json({ error: "storeId буруу" }, { status: 400 });
  }
  if (!["store", "category", "item"].includes(scope)) {
    return NextResponse.json({ error: "scope буруу" }, { status: 400 });
  }
  if (!["serviceLevel", "coverDays"].includes(param)) {
    return NextResponse.json({ error: "param буруу" }, { status: 400 });
  }
  if (!Number.isFinite(to)) {
    return NextResponse.json({ error: "to буруу" }, { status: 400 });
  }

  const db = getDb();
  try {
    applyTuning(db, {
      storeId,
      scope: scope as "store" | "category" | "item",
      scopeKey: body.scopeKey != null ? String(body.scopeKey) : null,
      param: param as "serviceLevel" | "coverDays",
      from,
      to,
      reason: body.reason != null ? String(body.reason) : undefined,
      by: body.by != null ? String(body.by) : "operator",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
