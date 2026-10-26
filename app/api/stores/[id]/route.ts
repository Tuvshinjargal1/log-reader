/** GET → нэг дэлгүүрийн дэлгэрэнгүй (хамгийн сүүлийн захиалга + мөр + factor). */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import {
  clearStoreData,
  deleteStore,
  getStore,
} from "@/lib/db/repositories/stores";
import { getStoreConfig, getGlobalDefaults } from "@/lib/db/repositories/config";
import { getLatestOrder } from "@/lib/db/repositories/orders";
import { audit, latestIngestionRun } from "@/lib/db/repositories/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const storeId = Number(id);
  if (!Number.isFinite(storeId)) {
    return NextResponse.json({ error: "Буруу id" }, { status: 400 });
  }

  const db = getDb();
  const store = getStore(db, storeId);
  if (!store) {
    return NextResponse.json({ error: "Дэлгүүр олдсонгүй" }, { status: 404 });
  }

  const global = getGlobalDefaults(db);
  const storeCfg = getStoreConfig(db, storeId);
  const order = getLatestOrder(db, storeId);
  const ingestion = latestIngestionRun(db, storeId);

  return NextResponse.json({
    store,
    mode: storeCfg?.mode ?? global.mode,
    order,
    ingestion,
  });
}

/**
 * DELETE            → дэлгүүрийг бүрэн устгах
 * DELETE ?data=1    → зөвхөн татсан датаг цэвэрлэх (дэлгүүр, тохиргоо үлдэнэ)
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const storeId = Number(id);
  if (!Number.isFinite(storeId)) {
    return NextResponse.json({ error: "Буруу id" }, { status: 400 });
  }
  const db = getDb();
  const store = getStore(db, storeId);
  if (!store) {
    return NextResponse.json({ error: "Дэлгүүр олдсонгүй" }, { status: 404 });
  }

  const dataOnly = new URL(req.url).searchParams.get("data") === "1";
  if (dataOnly) {
    clearStoreData(db, storeId);
    audit(db, { action: "clear_store_data", entity: "store", entityId: id });
    return NextResponse.json({ ok: true, cleared: true });
  }
  deleteStore(db, storeId);
  audit(db, {
    action: "delete_store",
    entity: "store",
    entityId: id,
    before: { name: store.name, ip: store.ip },
  });
  return NextResponse.json({ ok: true, deleted: true });
}
