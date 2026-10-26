/** GET → SMS/API захиалгын outbox (?storeId=N бол тухайн дэлгүүрийнх). */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { listRecentOutbox, listStoreOutbox } from "@/lib/db/repositories/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("storeId");
  const db = getDb();
  if (raw != null) {
    const storeId = Number(raw);
    if (!Number.isFinite(storeId)) {
      return NextResponse.json({ error: "Буруу storeId" }, { status: 400 });
    }
    return NextResponse.json({ messages: listStoreOutbox(db, storeId) });
  }
  return NextResponse.json({ messages: listRecentOutbox(db) });
}
