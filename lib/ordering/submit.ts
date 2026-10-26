/** Захиалгыг sink-ээр илгээх үйлчилгээ (статус + аудит шинэчилнэ). */
import type { Db } from "@/lib/db/index";
import {
  getOrder,
  markSubmitted,
  setOrderStatus,
} from "@/lib/db/repositories/orders";
import { getStore } from "@/lib/db/repositories/stores";
import { audit } from "@/lib/db/repositories/ops";
import { SimulatedSmsSink } from "./smsSink";
import type { OrderSink, SubmitResult } from "./sink";

export async function submitOrder(
  db: Db,
  orderId: number,
  by: string,
  sink?: OrderSink,
): Promise<SubmitResult> {
  const activeSink = sink ?? new SimulatedSmsSink(db);
  const order = getOrder(db, orderId);
  if (!order) throw new Error(`Захиалга олдсонгүй: ${orderId}`);
  const store = getStore(db, order.storeId);
  if (!store) throw new Error(`Дэлгүүр олдсонгүй: ${order.storeId}`);

  if (order.status === "proposed" || order.status === "edited") {
    setOrderStatus(db, orderId, "confirmed");
  }

  const res = await activeSink.submit(order, store);
  if (res.ok) {
    markSubmitted(db, orderId, {
      by,
      sinkType: res.sinkType,
      externalRef: res.externalRef,
    });
  } else {
    setOrderStatus(db, orderId, "failed");
  }

  audit(db, {
    actor: by,
    action: "submit_order",
    entity: "order",
    entityId: String(orderId),
    after: { ok: res.ok, sinkType: res.sinkType, externalRef: res.externalRef },
  });

  return res;
}
