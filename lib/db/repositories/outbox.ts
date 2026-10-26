/** SMS/API захиалгын outbox repository (P3 симуляц). */
import type { Db } from "../index";

export type SmsStatus = "queued" | "sent" | "delivered" | "failed";

export interface OutboxMessageInput {
  orderId: number;
  storeId: number;
  toNumber: string;
  segments: number;
  body: string;
  status: SmsStatus;
  gatewayRef?: string | null;
  deliveredAt?: string | null;
  error?: string | null;
}

export function addOutboxMessage(db: Db, m: OutboxMessageInput): number {
  const res = db
    .prepare(
      `INSERT INTO sms_outbox
         (order_id, store_id, to_number, segments, body, status, gateway_ref, delivered_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.orderId,
      m.storeId,
      m.toNumber,
      m.segments,
      m.body,
      m.status,
      m.gatewayRef ?? null,
      m.deliveredAt ?? null,
      m.error ?? null,
    );
  return Number(res.lastInsertRowid);
}

export interface OutboxRow {
  id: number;
  orderId: number | null;
  storeId: number | null;
  toNumber: string;
  segments: number;
  body: string;
  status: SmsStatus;
  gatewayRef: string | null;
  createdAt: string;
  deliveredAt: string | null;
  error: string | null;
}

interface OutboxDbRow {
  id: number;
  order_id: number | null;
  store_id: number | null;
  to_number: string;
  segments: number;
  body: string;
  status: string;
  gateway_ref: string | null;
  created_at: string;
  delivered_at: string | null;
  error: string | null;
}

function mapRow(r: OutboxDbRow): OutboxRow {
  return {
    id: Number(r.id),
    orderId: r.order_id != null ? Number(r.order_id) : null,
    storeId: r.store_id != null ? Number(r.store_id) : null,
    toNumber: r.to_number,
    segments: r.segments,
    body: r.body,
    status: r.status as SmsStatus,
    gatewayRef: r.gateway_ref,
    createdAt: r.created_at,
    deliveredAt: r.delivered_at,
    error: r.error,
  };
}

export function listRecentOutbox(db: Db, limit = 100): OutboxRow[] {
  const rows = db
    .prepare("SELECT * FROM sms_outbox ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as OutboxDbRow[];
  return rows.map(mapRow);
}

export function listStoreOutbox(db: Db, storeId: number, limit = 50): OutboxRow[] {
  const rows = db
    .prepare("SELECT * FROM sms_outbox WHERE store_id = ? ORDER BY id DESC LIMIT ?")
    .all(storeId, limit) as unknown as OutboxDbRow[];
  return rows.map(mapRow);
}

export function markDelivered(db: Db, id: number, deliveredAt: string): void {
  db.prepare(
    "UPDATE sms_outbox SET status = 'delivered', delivered_at = ? WHERE id = ?",
  ).run(deliveredAt, id);
}
