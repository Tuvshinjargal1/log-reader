/**
 * Аудит / өөрчлөлтийн түүх — "хэн, хэзээ, юуг өөрчилсөн".
 *  - GET ?storeId=&limit= → { events }
 *
 * `audit_log` (үйлдэл) ба `tuning_history` (параметрийн өөрчлөлт) хоёрыг нэг
 * цаг хугацааны урсгал болгож нэгтгэнэ.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { listAuditLog } from "@/lib/db/repositories/ops";
import { listTuningHistory } from "@/lib/db/repositories/tuning";
import { listStores } from "@/lib/db/repositories/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AuditEventKind = "action" | "tuning";

export interface AuditEvent {
  id: string;
  at: string;
  kind: AuditEventKind;
  actor: string;
  /** Монгол товч тайлбар */
  title: string;
  detail: string | null;
  storeId: number | null;
  storeName: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  plan_store: "Захиалга төлөвлөв",
  submit_order: "Захиалга илгээв",
  apply_tuning: "Тохиргоо баталгаажуулав",
  update_line: "Захиалгын мөр зассан",
  clear_store_data: "Дэлгүүрийн дата цэвэрлэв",
  delete_store: "Дэлгүүр устгав",
  ingest: "POS-оос дата татав",
};

const PARAM_LABEL: Record<string, string> = {
  serviceLevel: "Үйлчилгээний түвшин",
  coverDays: "Нөөцлөх хоног",
  mode: "Захиалгын горим",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("storeId");
  const storeId = raw != null && raw !== "" ? Number(raw) : null;
  if (raw != null && raw !== "" && !Number.isFinite(storeId)) {
    return NextResponse.json({ error: "Буруу storeId" }, { status: 400 });
  }
  const limit = Number(url.searchParams.get("limit")) || 120;

  try {
    const db = getDb();
    const storeNames = new Map(listStores(db).map((s) => [s.id, s.name] as const));

    // order → store хамаарлыг нэг query-ээр татна: `submit_order` зэрэг үйлдлийн
    // `after` дотор storeId байдаггүй тул entity_id-аар нөхнө (мөр тутамд query
    // явуулбал N+1 болно).
    const orderStore = new Map<string, number>(
      (
        db.prepare("SELECT id, store_id FROM orders").all() as unknown as {
          id: number;
          store_id: number;
        }[]
      ).map((r) => [String(r.id), Number(r.store_id)] as const),
    );

    const events: AuditEvent[] = [];

    for (const a of listAuditLog(db, { storeId, limit })) {
      let sid: number | null = null;
      let detail: string | null = null;
      if (a.entity === "order" && a.entityId) sid = orderStore.get(a.entityId) ?? null;
      if (a.entity === "store" && a.entityId) sid = Number(a.entityId) || null;
      try {
        const after = a.after ? (JSON.parse(a.after) as Record<string, unknown>) : null;
        if (after && typeof after.storeId === "number") sid = after.storeId;
        if (after && typeof after.lineCount === "number" && typeof after.totalQty === "number") {
          detail = `${after.lineCount} бараа · ${Number(after.totalQty).toLocaleString("mn-MN")} ширхэг`;
        } else if (after && typeof after.sinkType === "string") {
          detail = `${after.sinkType}${after.externalRef ? ` · ${after.externalRef}` : ""}`;
        }
      } catch { /* JSON биш — тайлбаргүй үлдээнэ */ }

      events.push({
        id: `a${a.id}`,
        at: a.at,
        kind: "action",
        actor: a.actor ?? "систем",
        title: ACTION_LABEL[a.action] ?? a.action,
        detail,
        storeId: sid,
        storeName: sid != null ? (storeNames.get(sid) ?? null) : null,
      });
    }

    const tuningStores = storeId != null ? [storeId] : [...storeNames.keys()];
    for (const sid of tuningStores) {
      for (const t of listTuningHistory(db, sid, 30)) {
        events.push({
          id: `t${t.id}`,
          at: t.at,
          kind: "tuning",
          actor: t.appliedBy ?? "оператор",
          title: `${PARAM_LABEL[t.param] ?? t.param}: ${t.fromValue ?? "?"} → ${t.toValue ?? "?"}`,
          detail: t.reason,
          storeId: sid,
          storeName: storeNames.get(sid) ?? null,
        });
      }
    }

    events.sort((a, b) => b.at.localeCompare(a.at));
    return NextResponse.json({ events: events.slice(0, limit) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
