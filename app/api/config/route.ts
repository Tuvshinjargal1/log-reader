/**
 * Config давхаргуудыг унших/бичих.
 *  - GET  → global defaults
 *  - POST { level, storeId?, categoryKey?, itemCd?, patch }
 *      level: "global" | "store" | "category" | "item"
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import {
  getGlobalDefaults,
  setCategoryConfig,
  setItemConfig,
  setStoreConfig,
  updateGlobalDefaults,
} from "@/lib/db/repositories/config";
import { audit } from "@/lib/db/repositories/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json({ global: getGlobalDefaults(db) });
}

export async function POST(req: Request) {
  let body: {
    level?: unknown;
    storeId?: unknown;
    categoryKey?: unknown;
    itemCd?: unknown;
    patch?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }

  const level = String(body.level ?? "");
  const patch = (body.patch ?? {}) as Record<string, unknown>;
  const db = getDb();

  try {
    if (level === "global") {
      updateGlobalDefaults(db, patch);
    } else if (level === "store") {
      const storeId = Number(body.storeId);
      if (!Number.isFinite(storeId)) throw new Error("storeId шаардлагатай");
      setStoreConfig(db, storeId, patch);
    } else if (level === "category") {
      const storeId = Number(body.storeId);
      const key = String(body.categoryKey ?? "");
      if (!Number.isFinite(storeId) || !key)
        throw new Error("storeId/categoryKey шаардлагатай");
      setCategoryConfig(db, storeId, key, patch);
    } else if (level === "item") {
      const storeId = Number(body.storeId);
      const itemCd = String(body.itemCd ?? "");
      if (!Number.isFinite(storeId) || !itemCd)
        throw new Error("storeId/itemCd шаардлагатай");
      setItemConfig(db, storeId, itemCd, patch);
    } else {
      throw new Error("Тодорхойгүй level");
    }

    audit(db, {
      action: "set_config",
      entity: level,
      entityId: String(body.itemCd ?? body.categoryKey ?? body.storeId ?? "global"),
      after: patch,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
