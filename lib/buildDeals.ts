import type {
  BasketItem,
  Deal,
  DealEvent,
  EbarimtInfo,
  ErrorSummary,
  LogEntry,
  ParsedLog,
  PaymentInfo,
} from "./types";
import {
  describeEvent,
  extractAmount,
  extractPaymentMethod,
  extractSalesNo,
} from "./detectEvents";
import {
  extractBasket,
  extractEbarimtInfo,
  extractPaymentInfo,
} from "./extractBasket";
import { extractCustomerInfo } from "./extractCustomer";
import { explainError, technicalName } from "./errorExplain.mn";
import { paymentLabel } from "./labels.mn";
import { timeToMs } from "./parseLine";

const TIMELINE_KINDS = new Set([
  "deal_start",
  "scan",
  "display_message",
  "popup",
  "payment",
  "ebarimt",
  "http_error",
  "exception",
  "receipt",
  "tender",
  "api_send",
  "api_recv",
]);

function shouldIncludeInTimeline(entry: LogEntry): boolean {
  if (entry.isInOut && entry.eventKind === "other") return false;
  if (entry.isHeartbeat) return false;
  if (entry.eventKind === "receipt" && entry.isInOut) {
    // only one receipt marker per print
    return entry.method === "PrintReceipt" && entry.message.trim() === "IN";
  }
  if (entry.eventKind === "api_send" || entry.eventKind === "api_recv") {
    // hide LMS noise unless error; keep payment/ebarimt via their kinds
    return false;
  }
  return TIMELINE_KINDS.has(entry.eventKind);
}

export function buildDeals(entries: LogEntry[]): Deal[] {
  const dealStarts: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].eventKind === "deal_start") dealStarts.push(i);
  }

  if (dealStarts.length === 0) return [];

  const deals: Deal[] = [];

  for (let d = 0; d < dealStarts.length; d++) {
    const startIdx = dealStarts[d];
    const endIdx =
      d + 1 < dealStarts.length ? dealStarts[d + 1] - 1 : entries.length - 1;

    // Include SCANNING that immediately precedes Deal Start
    let sliceFrom = startIdx;
    for (let b = startIdx - 1; b >= Math.max(0, startIdx - 30); b--) {
      if (entries[b].eventKind === "deal_start") break;
      if (entries[b].eventKind === "scan") {
        sliceFrom = b;
        break;
      }
    }

    const slice = entries.slice(sliceFrom, endIdx + 1);
    const startEntry = entries[startIdx];

    const events: DealEvent[] = [];
    let hasError = false;
    let salesNo: string | undefined;
    let amount: number | undefined;
    let paymentMethod: string | undefined;
    let basket: BasketItem[] = [];
    let payment: PaymentInfo | undefined;
    let ebarimt: EbarimtInfo | undefined;
    let receiptLines: string[] | undefined;
    const errors: ErrorSummary[] = [];
    const entryIds: number[] = [];

    for (const entry of slice) {
      entryIds.push(entry.id);
      const text = [entry.message, ...entry.continuation].join("\n");

      if (!salesNo) salesNo = extractSalesNo(text);
      if (!amount && (entry.eventKind === "ebarimt" || entry.eventKind === "payment" || entry.eventKind === "tender")) {
        amount = extractAmount(text);
      }
      if (!paymentMethod) {
        const pm = extractPaymentMethod(text);
        if (pm) paymentMethod = paymentLabel(pm);
      }

      if (entry.eventKind === "ebarimt") {
        if (basket.length === 0 && /\bSEND\b/.test(entry.message)) {
          basket = extractBasket(entry.message);
        }
        if (/\bRECV\b/.test(entry.message)) {
          const info = extractEbarimtInfo(entry.message);
          if (info) ebarimt = info;
        }
      }

      if (entry.eventKind === "payment" && /\bRECV\b/.test(entry.message)) {
        const info = extractPaymentInfo(entry.message);
        // Prefer the final (PAID/status) response over the initial PENDING one
        if (info && (!payment || info.status === "PAID" || !payment.status)) {
          payment = info;
        }
      }

      if (
        !receiptLines &&
        entry.eventKind === "receipt" &&
        entry.continuation.some((l) => /^\[(PLG|NOR|BLD|EBT)\]/i.test(l))
      ) {
        receiptLines = entry.continuation;
      }

      if (entry.isError) {
        hasError = true;
        const info = explainError(entry);
        errors.push({
          entryId: entry.id,
          time: entry.time,
          technical: technicalName(entry),
          explanation: info.explanation,
          location: info.location,
        });
      }

      if (!shouldIncludeInTimeline(entry)) continue;

      // Skip empty popup/tender without useful detail
      if (entry.eventKind === "popup" && !/viewName:/i.test(entry.message)) {
        continue;
      }
      if (
        entry.eventKind === "tender" &&
        !/TenderKind:/i.test(entry.message)
      ) {
        continue;
      }

      const desc = describeEvent(entry);
      const last = events[events.length - 1];
      if (
        last &&
        last.kind === entry.eventKind &&
        last.title === desc.title &&
        last.detail === desc.detail
      ) {
        continue;
      }

      if (entry.eventKind === "receipt" && entry.message.trim() === "OUT") continue;

      events.push({
        kind: entry.eventKind,
        time: entry.time,
        title: desc.title,
        detail: desc.detail,
        entryId: entry.id,
        isError: entry.isError,
      });
    }

    const endEntry = entries[endIdx];
    const durationMs = Math.max(
      0,
      timeToMs(endEntry.time) - timeToMs(startEntry.time),
    );

    const customer = extractCustomerInfo(
      slice.map((e) =>
        [e.method, e.message, ...e.continuation].join("\n"),
      ),
    );

    deals.push({
      id: `deal-${d + 1}-${startEntry.id}`,
      index: d + 1,
      startTime: startEntry.time,
      endTime: endEntry.time,
      date: startEntry.date,
      durationMs,
      hasError,
      salesNo,
      amount,
      paymentMethod: payment ? paymentLabel(payment.method) : paymentMethod,
      events,
      entryIds,
      entryStart: startEntry.id,
      entryEnd: endEntry.id,
      basket,
      payment,
      ebarimt,
      errors,
      receiptLines,
      customer,
    });
  }

  return deals;
}

export function buildParsedLog(
  entries: LogEntry[],
  files: ParsedLog["files"],
): ParsedLog {
  const deals = buildDeals(entries);
  const errorCount = entries.filter((e) => e.isError).length;
  return {
    files,
    entries,
    deals,
    errorCount,
    dealCount: deals.length,
  };
}
