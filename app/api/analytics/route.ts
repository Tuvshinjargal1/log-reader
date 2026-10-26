/**
 * Аналитик / KPI / backtest нотолгоо.
 *  - GET               → fleet KPI + AUTO-vs-baseline нэгдсэн
 *  - GET ?storeId=N     → тухайн дэлгүүрийн бараа тус бүрийн backtest + health +
 *                         tuning зөвлөмж + улирлын профайл (мөн хадгална)
 * Нэмэлт query: asOf=YYYYMMDD, lookback=<days>
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { analyzeStore, fleetAnalytics } from "@/lib/replenish/analytics";
import { saveSeasonality } from "@/lib/db/repositories/seasonality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const asOf = /^\d{8}$/.test(url.searchParams.get("asOf") ?? "")
    ? url.searchParams.get("asOf")!
    : todayYmd();
  const lookback = Number(url.searchParams.get("lookback")) || 84;
  const storeIdParam = url.searchParams.get("storeId");

  const db = getDb();

  try {
    if (storeIdParam) {
      const storeId = Number(storeIdParam);
      if (!Number.isFinite(storeId)) {
        return NextResponse.json({ error: "Буруу storeId" }, { status: 400 });
      }
      const analysis = analyzeStore(db, storeId, { asOf, lookbackDays: lookback });
      // Улирлын профайлыг хадгална (дараагийн prognoz/tune-д)
      saveSeasonality(db, storeId, analysis.seasonality);
      return NextResponse.json({ analysis });
    }

    const fleet = fleetAnalytics(db, { asOf, lookbackDays: lookback });
    return NextResponse.json(fleet);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
