/**
 * Бүтэн мөчлөгийг ажиллуулна (төлөвлөх + автомат илгээх). Windows Task Scheduler
 * / cron-оос дуудаж автоматжуулж болно.
 * POST { asOf?: "YYYYMMDD", autoSubmit?: boolean }
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { runFullCycle } from "@/lib/replenish/cycle";
import { getSchedule } from "@/lib/db/repositories/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export async function POST(req: Request) {
  let body: { asOf?: unknown; autoSubmit?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // хоосон body зөвшөөрнө
  }
  const db = getDb();
  const sched = getSchedule(db);
  const asOf = /^\d{8}$/.test(String(body.asOf ?? "")) ? String(body.asOf) : todayYmd();
  const autoSubmit =
    body.autoSubmit != null ? body.autoSubmit === true : sched.autoSubmit;

  const result = await runFullCycle(db, { asOf, autoSubmit });
  return NextResponse.json(result);
}
