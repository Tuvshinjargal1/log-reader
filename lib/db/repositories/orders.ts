/** Захиалга + захиалгын мөрийн repository. */
import type { Db } from "../index";
import { tx } from "../index";
import type { OrderMode } from "@/lib/config/types";

export type OrderStatus =
  | "proposed"
  | "edited"
  | "confirmed"
  | "submitted"
  | "received"
  | "failed"
  | "cancelled";

export interface OrderLineInput {
  itemCd: string;
  name: string;
  categoryKey: string | null;
  categoryNm: string | null;
  price: number | null;
  suggestedQty: number;
  finalQty: number;
  decidedBy: OrderMode;
  configSnapshot?: unknown;
  factorsSnapshot?: unknown;
}

export interface OrderLine {
  id: number;
  itemCd: string;
  name: string;
  categoryKey: string | null;
  categoryNm: string | null;
  price: number | null;
  suggestedQty: number;
  finalQty: number;
  decidedBy: OrderMode;
  configSnapshot: unknown;
  factorsSnapshot: unknown;
}

export interface OrderHeader {
  id: number;
  storeId: number;
  status: OrderStatus;
  mode: OrderMode;
  orderDate: string;
  totalQty: number;
  totalAmount: number;
  createdAt: string;
  submittedAt: string | null;
  submittedBy: string | null;
  sinkType: string | null;
  externalRef: string | null;
  note: string | null;
}

export interface OrderWithLines extends OrderHeader {
  lines: OrderLine[];
}

interface OrderDbRow {
  id: number;
  store_id: number;
  status: string;
  mode: string;
  order_date: string;
  total_qty: number;
  total_amount: number;
  created_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
  sink_type: string | null;
  external_ref: string | null;
  note: string | null;
}

interface LineDbRow {
  id: number;
  item_cd: string;
  name: string;
  category_key: string | null;
  category_nm: string | null;
  price: number | null;
  suggested_qty: number;
  final_qty: number;
  decided_by: string;
  config_snapshot: string | null;
  factors_snapshot: string | null;
}

function parseJson(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function mapHeader(r: OrderDbRow): OrderHeader {
  return {
    id: Number(r.id),
    storeId: Number(r.store_id),
    status: r.status as OrderStatus,
    mode: r.mode as OrderMode,
    orderDate: r.order_date,
    totalQty: r.total_qty,
    totalAmount: r.total_amount,
    createdAt: r.created_at,
    submittedAt: r.submitted_at,
    submittedBy: r.submitted_by,
    sinkType: r.sink_type,
    externalRef: r.external_ref,
    note: r.note,
  };
}

function mapLine(r: LineDbRow): OrderLine {
  return {
    id: Number(r.id),
    itemCd: r.item_cd,
    name: r.name,
    categoryKey: r.category_key,
    categoryNm: r.category_nm,
    price: r.price,
    suggestedQty: r.suggested_qty,
    finalQty: r.final_qty,
    decidedBy: r.decided_by as OrderMode,
    configSnapshot: parseJson(r.config_snapshot),
    factorsSnapshot: parseJson(r.factors_snapshot),
  };
}

function totals(lines: OrderLineInput[]): { qty: number; amount: number } {
  let qty = 0;
  let amount = 0;
  for (const l of lines) {
    qty += l.finalQty;
    amount += l.finalQty * (l.price ?? 0);
  }
  return { qty, amount };
}

export interface CreateOrderInput {
  storeId: number;
  mode: OrderMode;
  orderDate: string;
  status?: OrderStatus;
  lines: OrderLineInput[];
}

export function createOrder(db: Db, input: CreateOrderInput): number {
  return tx(db, () => {
    const t = totals(input.lines);
    const res = db
      .prepare(
        `INSERT INTO orders (store_id, status, mode, order_date, total_qty, total_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.storeId,
        input.status ?? "proposed",
        input.mode,
        input.orderDate,
        t.qty,
        t.amount,
      );
    const orderId = Number(res.lastInsertRowid);

    const insLine = db.prepare(
      `INSERT INTO order_lines
         (order_id, item_cd, name, category_key, category_nm, price,
          suggested_qty, final_qty, decided_by, config_snapshot, factors_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const l of input.lines) {
      insLine.run(
        orderId,
        l.itemCd,
        l.name,
        l.categoryKey,
        l.categoryNm,
        l.price,
        l.suggestedQty,
        l.finalQty,
        l.decidedBy,
        l.configSnapshot != null ? JSON.stringify(l.configSnapshot) : null,
        l.factorsSnapshot != null ? JSON.stringify(l.factorsSnapshot) : null,
      );
    }
    return orderId;
  });
}

export function getOrder(db: Db, id: number): OrderWithLines | null {
  const h = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | OrderDbRow
    | undefined;
  if (!h) return null;
  const lines = db
    .prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id")
    .all(id) as unknown as LineDbRow[];
  return { ...mapHeader(h), lines: lines.map(mapLine) };
}

/** Тухайн дэлгүүрийн хамгийн сүүлийн захиалга (одоогийн шийдвэр = диаграмын эх). */
export function getLatestOrder(
  db: Db,
  storeId: number,
): OrderWithLines | null {
  const h = db
    .prepare(
      "SELECT * FROM orders WHERE store_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(storeId) as OrderDbRow | undefined;
  if (!h) return null;
  return getOrder(db, Number(h.id));
}

export function listOrders(db: Db, storeId: number): OrderHeader[] {
  const rows = db
    .prepare("SELECT * FROM orders WHERE store_id = ? ORDER BY id DESC")
    .all(storeId) as unknown as OrderDbRow[];
  return rows.map(mapHeader);
}

/** Мөрийн эцсийн тоо хэмжээг гараар засах. Толгойн дүнг дахин тооцно. */
export function updateLineFinalQty(
  db: Db,
  orderId: number,
  lineId: number,
  finalQty: number,
): void {
  tx(db, () => {
    db.prepare(
      "UPDATE order_lines SET final_qty = ?, decided_by = 'manual' WHERE id = ? AND order_id = ?",
    ).run(finalQty, lineId, orderId);
    recomputeTotals(db, orderId);
    db.prepare(
      "UPDATE orders SET status = 'edited' WHERE id = ? AND status IN ('proposed','edited')",
    ).run(orderId);
  });
}

function recomputeTotals(db: Db, orderId: number): void {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(final_qty),0) AS qty,
              COALESCE(SUM(final_qty * COALESCE(price,0)),0) AS amount
         FROM order_lines WHERE order_id = ?`,
    )
    .get(orderId) as { qty: number; amount: number };
  db.prepare("UPDATE orders SET total_qty = ?, total_amount = ? WHERE id = ?").run(
    r.qty,
    r.amount,
    orderId,
  );
}

export function setOrderStatus(
  db: Db,
  orderId: number,
  status: OrderStatus,
): void {
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
}

export function markSubmitted(
  db: Db,
  orderId: number,
  info: { by: string; sinkType: string; externalRef: string | null },
): void {
  db.prepare(
    `UPDATE orders
        SET status = 'submitted', submitted_at = datetime('now'),
            submitted_by = ?, sink_type = ?, external_ref = ?
      WHERE id = ?`,
  ).run(info.by, info.sinkType, info.externalRef, orderId);
}
