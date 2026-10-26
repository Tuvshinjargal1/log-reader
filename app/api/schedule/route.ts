/**
 * Автоматжуулалтын хуваарь (симуляц).
 *  - GET  → одоогийн хуваарь
 *  - POST { enabled?, timeOfDay?, autoSubmit? } → шинэчлэх (next run дахин тооцно)
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getSchedule, updateSchedule, computeNextRun } from "@/lib/db/repositories/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json({ schedule: getSchedule(db) });
}

export async function POST(req: Request) {
  let body: { enabled?: unknown; timeOfDay?: unknown; autoSubmit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }

  const db = getDb();
  const patch: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.autoSubmit === "boolean") patch.autoSubmit = body.autoSubmit;
  if (typeof body.timeOfDay === "string" && /^\d{2}:\d{2}$/.test(body.timeOfDay)) {
    patch.timeOfDay = body.timeOfDay;
  }

  const timeOfDay =
    (patch.timeOfDay as string) ?? getSchedule(db).timeOfDay;
  patch.nextRunAt =
    patch.enabled === false ? null : computeNextRun(timeOfDay, new Date());

  updateSchedule(db, patch);
  return NextResponse.json({ schedule: getSchedule(db) });
}
