/**
 * Шийдвэрийн зураглал (Decision Board).
 *  - GET ?operatorId=&asOf=&window=&trendWeeks=&refresh=1
 *      → { board, cached, ageMs }
 *
 * Хуудас нээх мөчид ачаалагддаг тул backtest ХИЙХГҮЙ (`/api/analytics` нь
 * товчны цаана байна). 60 секундын кэштэй; mutation-ы дараа UI нь `refresh=1`
 * дамжуулж шинэчилнэ.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { cachedBoard } from "@/lib/replenish/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);

  const operatorRaw = url.searchParams.get("operatorId");
  let operatorId: number | null = null;
  if (operatorRaw != null && operatorRaw !== "" && operatorRaw !== "all") {
    operatorId = Number(operatorRaw);
    if (!Number.isFinite(operatorId)) {
      return NextResponse.json({ error: "Буруу operatorId" }, { status: 400 });
    }
  }

  const asOfRaw = url.searchParams.get("asOf");
  // asOf өгөөгүй бол board нь daily_metrics-ийн MAX(d)-г авна — өнөөдрийг
  // хатуу тавивал сүүлийн мөрөөс хэтэрч, бүх recency жин чимээгүйхэн хазайна.
  const asOf = asOfRaw && /^\d{8}$/.test(asOfRaw) ? asOfRaw : undefined;

  const windowDays = Number(url.searchParams.get("window")) || undefined;
  const trendWeeks = Number(url.searchParams.get("trendWeeks")) || undefined;
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    const db = getDb();
    const { board, cached, ageMs } = cachedBoard(
      db,
      operatorId,
      { asOf, windowDays, trendWeeks },
      refresh,
    );
    // Хоосон сан нь АЛДАА БИШ — UI нь EmptyState харуулна, улаан Alert биш.
    return NextResponse.json({ board, cached, ageMs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
