/**
 * Захиалга илгээх pluggable интерфейс. Prod дээр GS25-ийн SMS/захиалгын API-г
 * хэрэгжүүлсэн sink нэмэгдэнэ; одоохондоо DevOrderSink (dev/stub) ашиглана.
 */
import type { OrderWithLines } from "@/lib/db/repositories/orders";
import type { StoreRow } from "@/lib/db/repositories/stores";

export interface SubmitResult {
  ok: boolean;
  sinkType: string;
  externalRef: string | null;
  message?: string;
}

export interface OrderSink {
  readonly type: string;
  submit(order: OrderWithLines, store: StoreRow): Promise<SubmitResult>;
}
