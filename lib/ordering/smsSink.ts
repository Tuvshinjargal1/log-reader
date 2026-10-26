/**
 * SMS/API захиалгын СИМУЛЯЦ sink (P3). Бодит GS25 SMS/API-гүйгээр захиалгыг
 * SMS мессеж(үүд) болгон "илгээж", gateway лавлагаа, segment тоо, хүргэгдсэн
 * төлөвтэйгээр sms_outbox-д бүртгэнэ. Танилцуулгад бодит SMS gateway шиг
 * харагдана. Бодит API бэлэн болоход зөвхөн энэ файлыг солино.
 */
import type { Db } from "@/lib/db/index";
import type { OrderWithLines } from "@/lib/db/repositories/orders";
import type { StoreRow } from "@/lib/db/repositories/stores";
import { addOutboxMessage, markDelivered } from "@/lib/db/repositories/outbox";
import type { OrderSink, SubmitResult } from "./sink";

/** GS25 захиалгын төвийн богино дугаар (симуляц) */
export const ORDER_CENTER_NUMBER = "1348";
const LINES_PER_SMS = 16;

/** Латин бус (ASCII бус) тэмдэгттэй эсэх — SMS segment уртад нөлөөлнө */
function isUnicode(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return true;
  }
  return false;
}

/** SMS segment тоо (GSM-7: 160/153, Unicode: 70/67) */
export function smsSegments(body: string): number {
  const len = body.length;
  if (isUnicode(body)) {
    return len <= 70 ? 1 : Math.ceil(len / 67);
  }
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

export interface ComposedSms {
  toNumber: string;
  body: string;
  segments: number;
}

/** Захиалгыг нэг буюу хэд хэдэн SMS болгон бүрдүүлнэ (олон бараатай бол хэсэгчилнэ). */
export function composeMessages(
  order: OrderWithLines,
  store: StoreRow,
): ComposedSms[] {
  const code = store.code ?? store.bizplCd ?? String(store.id);
  const batches: ComposedSms[] = [];
  const lines = order.lines;
  const total = Math.ceil(lines.length / LINES_PER_SMS) || 1;

  for (let i = 0; i < lines.length; i += LINES_PER_SMS) {
    const chunk = lines.slice(i, i + LINES_PER_SMS);
    const part = Math.floor(i / LINES_PER_SMS) + 1;
    const items = chunk.map((l) => `${l.itemCd}*${l.finalQty}`).join(" ");
    const body = [
      `GS25 ЗАХИАЛГА (${part}/${total})`,
      `Салбар: ${code}  ${order.orderDate}`,
      items,
    ].join("\n");
    batches.push({ toNumber: ORDER_CENTER_NUMBER, body, segments: smsSegments(body) });
  }

  if (batches.length === 0) {
    const body = `GS25 ЗАХИАЛГА\nСалбар: ${code}  ${order.orderDate}`;
    batches.push({ toNumber: ORDER_CENTER_NUMBER, body, segments: smsSegments(body) });
  }
  return batches;
}

export class SimulatedSmsSink implements OrderSink {
  readonly type = "sms-sim";
  constructor(private db: Db) {}

  async submit(order: OrderWithLines, store: StoreRow): Promise<SubmitResult> {
    const messages = composeMessages(order, store);
    const stamp = Date.now().toString(36).toUpperCase();
    const refs: string[] = [];
    let totalSegments = 0;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      // Илгээлтийн саатлыг дуурайна
      await new Promise((r) => setTimeout(r, 15));
      const gatewayRef = `SMS-${stamp}-${order.id}-${i + 1}`;
      refs.push(gatewayRef);
      totalSegments += m.segments;

      const id = addOutboxMessage(this.db, {
        orderId: order.id,
        storeId: order.storeId,
        toNumber: m.toNumber,
        segments: m.segments,
        body: m.body,
        status: "sent",
        gatewayRef,
      });
      // Хүргэгдсэн хариу (ack)-г дуурайна
      markDelivered(this.db, id, new Date().toISOString());
    }

    return {
      ok: true,
      sinkType: this.type,
      externalRef: refs[0] ?? null,
      message: `${messages.length} SMS (${totalSegments} segment) илгээгдэж хүргэгдлээ`,
    };
  }
}
