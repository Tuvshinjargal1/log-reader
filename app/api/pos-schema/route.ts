/**
 * POS схемийн нээлт — тухайн IP-ийн POS-оос stock/waste/delivery хүснэгтийн
 * нэрсийг олж буцаана. Эдгээрийг .env (POS_WASTE_TABLE гэх мэт)-д тохируулж
 * ingest-ийг таарууулна.
 * POST { ip: string }
 */
import { NextResponse } from "next/server";
import { connectPos } from "@/lib/pos/connect";
import { discoverSchema } from "@/lib/pos/discover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.POS_DB_PASSWORD) {
    return NextResponse.json(
      { error: "POS_DB_PASSWORD тохируулаагүй байна" },
      { status: 500 },
    );
  }
  let body: { ip?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }
  const ip = String(body.ip ?? "").trim();
  if (!ip) {
    return NextResponse.json({ error: "ip шаардлагатай" }, { status: 400 });
  }

  let pool;
  try {
    pool = await connectPos(ip);
    const schema = await discoverSchema(pool);
    return NextResponse.json({ ip, schema });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  } finally {
    try {
      await pool?.close();
    } catch {
      // ignore
    }
  }
}
