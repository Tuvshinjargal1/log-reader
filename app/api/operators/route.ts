/**
 * Оператор ба тэдний хариуцах дэлгүүрийн тоо.
 *  - GET → { operators: (OperatorRow & { storeCount })[] }
 *
 * `operators` / `operator_stores` хүснэгтийг repository давхаргаас ДЭЭШ
 * ашиглаж буй анхны газар — схем нь v1-ээс хойш байсан ч хэрэглэгдээгүй.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { listOperatorsWithCounts } from "@/lib/db/repositories/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    return NextResponse.json({ operators: listOperatorsWithCounts(db) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
