/** GET → fleet overview (бүх дэлгүүрийн төлөв, factor matrix, дохио). */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { fleetSummary } from "@/lib/replenish/fleet";
import { listOpenAlerts } from "@/lib/db/repositories/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const stores = fleetSummary(db);
  const alerts = listOpenAlerts(db);
  return NextResponse.json({ stores, alerts });
}
