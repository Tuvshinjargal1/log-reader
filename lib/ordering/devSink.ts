/**
 * Dev/stub захиалгын sink — бодит SMS/API-гүйгээр илгээлтийг симуляц хийж,
 * гадаад лавлагааны дугаар (external_ref) буцаана. Prod API бэлэн болоход
 * зөвхөн энэ файлыг бодит хэрэгжүүлэлтээр солино.
 */
import type { OrderWithLines } from "@/lib/db/repositories/orders";
import type { StoreRow } from "@/lib/db/repositories/stores";
import type { OrderSink, SubmitResult } from "./sink";

export class DevOrderSink implements OrderSink {
  readonly type = "dev";

  async submit(
    order: OrderWithLines,
    store: StoreRow,
  ): Promise<SubmitResult> {
    // Бодит илгээлтийг дуурайлган богино саатал
    await new Promise((r) => setTimeout(r, 20));
    const ref = `DEV-${store.code ?? store.id}-${order.orderDate}-${order.id}`;
    return {
      ok: true,
      sinkType: this.type,
      externalRef: ref,
      message: `Симуляц: ${order.lines.length} мөр, ${order.totalQty} ширхэг илгээв`,
    };
  }
}

export const defaultSink: OrderSink = new DevOrderSink();
