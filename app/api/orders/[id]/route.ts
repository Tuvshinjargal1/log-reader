/**
 * Захиалгын үйлдлүүд:
 *  - GET  ?export=csv → захиалгын хуудсыг CSV болгож татах
 *  - GET             → захиалга + мөр
 *  - PATCH { lineId, finalQty } → мөрийн эцсийн тоог гараар засах
 *  - POST  { action: "submit", by? } → sink-ээр илгээх
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getOrder, updateLineFinalQty } from "@/lib/db/repositories/orders";
import { getStore } from "@/lib/db/repositories/stores";
import { orderToCsv } from "@/lib/ordering/exportSheet";
import { submitOrder } from "@/lib/ordering/submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const orderId = parseId(id);
  if (orderId == null) return NextResponse.json({ error: "Буруу id" }, { status: 400 });

  const db = getDb();
  const order = getOrder(db, orderId);
  if (!order) return NextResponse.json({ error: "Захиалга олдсонгүй" }, { status: 404 });

  const url = new URL(req.url);
  if (url.searchParams.get("export") === "csv") {
    const store = getStore(db, order.storeId);
    const csv = orderToCsv(order, store?.name ?? String(order.storeId));
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="order-${orderId}.csv"`,
      },
    });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const orderId = parseId(id);
  if (orderId == null) return NextResponse.json({ error: "Буруу id" }, { status: 400 });

  let body: { lineId?: unknown; finalQty?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }
  const lineId = Number(body.lineId);
  const finalQty = Number(body.finalQty);
  if (!Number.isFinite(lineId) || !Number.isFinite(finalQty) || finalQty < 0) {
    return NextResponse.json({ error: "lineId/finalQty буруу" }, { status: 400 });
  }

  const db = getDb();
  updateLineFinalQty(db, orderId, lineId, finalQty);
  return NextResponse.json({ order: getOrder(db, orderId) });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const orderId = parseId(id);
  if (orderId == null) return NextResponse.json({ error: "Буруу id" }, { status: 400 });

  let body: { action?: unknown; by?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // хоосон зөвшөөрнө
  }

  const db = getDb();
  if (body.action === "submit") {
    try {
      const res = await submitOrder(db, orderId, String(body.by ?? "operator"));
      return NextResponse.json({ result: res, order: getOrder(db, orderId) });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 },
      );
    }
  }
  return NextResponse.json({ error: "Тодорхойгүй action" }, { status: 400 });
}
