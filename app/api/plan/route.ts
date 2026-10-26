/**
 * Нөхөн дүүргэлтийн төлөвлөгөө гаргана (engine ажиллуулна). Live POS шаардахгүй
 * — зөвхөн хадгалсан daily_metrics ашиглана.
 * POST { asOf?: "YYYYMMDD", storeId?: number, lookbackDays?: number, autoSubmit?: boolean }
 *   storeId байхгүй бол БҮХ дэлгүүрт төлөвлөнө. АВТОМАТ горимтой дэлгүүрийг
 *   (autoSubmit=true үед) шууд илгээнэ.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { listStores } from "@/lib/db/repositories/stores";
import { planStore } from "@/lib/replenish/planStore";
import { submitOrder } from "@/lib/ordering/submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export async function POST(req: Request) {
  let body: {
    asOf?: unknown;
    storeId?: unknown;
    lookbackDays?: unknown;
    autoSubmit?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    // хоосон body зөвшөөрнө
  }

  const asOf = /^\d{8}$/.test(String(body.asOf ?? ""))
    ? String(body.asOf)
    : todayYmd();
  const lookbackDays =
    typeof body.lookbackDays === "number" ? body.lookbackDays : undefined;
  const autoSubmit = body.autoSubmit === true;

  const db = getDb();

  const targets =
    typeof body.storeId === "number"
      ? [body.storeId]
      : listStores(db).map((s) => s.id);

  const results = [];
  for (const storeId of targets) {
    try {
      const plan = planStore(db, storeId, { asOf, lookbackDays });
      let submitted = false;
      let externalRef: string | null = null;
      if (
        autoSubmit &&
        plan.orderId != null &&
        plan.storeMode === "auto"
      ) {
        const res = await submitOrder(db, plan.orderId, "auto");
        submitted = res.ok;
        externalRef = res.externalRef;
      }
      results.push({ ...plan, submitted, externalRef });
    } catch (e) {
      results.push({
        storeId,
        orderId: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ asOf, results });
}
