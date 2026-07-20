import type { BasketItem, EbarimtInfo, PaymentInfo } from "./types";

interface EbarimtItemJson {
  name?: string;
  barCode?: string;
  qty?: number;
  unitPrice?: number;
  totalAmount?: number;
}

/**
 * Extract basket items from the eBarimt SEND payload
 * (ProcessApprovalReceiptAgent -> POST /api/receipt).
 */
export function extractBasket(message: string): BasketItem[] {
  const json = extractJson(message);
  if (!json || typeof json !== "object") return [];

  const receipts = (json as { receipts?: { items?: EbarimtItemJson[] }[] })
    .receipts;
  if (!Array.isArray(receipts)) return [];

  const items: BasketItem[] = [];
  for (const receipt of receipts) {
    if (!Array.isArray(receipt.items)) continue;
    for (const item of receipt.items) {
      if (!item?.name) continue;
      items.push({
        name: item.name,
        barCode: item.barCode,
        qty: Number(item.qty ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
        totalAmount: Number(item.totalAmount ?? 0),
      });
    }
  }
  return items;
}

/** Extract eBarimt result info from the RECV payload. */
export function extractEbarimtInfo(message: string): EbarimtInfo | null {
  if (!/\bRECV\b/.test(message)) return null;
  const json = extractJson(message) as {
    id?: string;
    lottery?: string;
    status?: string;
  } | null;
  if (!json) return null;
  if (!json.id && !json.lottery && !json.status) return null;
  return {
    lottery: json.lottery,
    ddtd: json.id,
    success: json.status === "SUCCESS",
  };
}

/** Extract payment info from a payment RECV payload. */
export function extractPaymentInfo(message: string): PaymentInfo | null {
  const json = extractJson(message) as Record<string, unknown> | null;
  if (!json) return null;

  // PGWA card terminal response
  if (typeof json.pan === "string" || typeof json.auth_code === "string") {
    return {
      method: typeof json.card_type === "string" ? "Банкны карт" : "Карт",
      amount: typeof json.amount === "number" ? json.amount : undefined,
      status: json.status === 0 ? "PAID" : undefined,
      cardPan: typeof json.pan === "string" ? json.pan : undefined,
    };
  }

  // PGW mobile payment response (data wrapper)
  const data = (json.data ?? json) as Record<string, unknown>;
  if (typeof data.paymentMethod === "string") {
    return {
      method: data.paymentMethod,
      amount:
        typeof data.salesAmount === "number" ? data.salesAmount : undefined,
      status:
        typeof data.requestStatus === "string"
          ? data.requestStatus
          : typeof data.salesStatus === "string"
            ? data.salesStatus
            : undefined,
    };
  }

  return null;
}

/** Find and parse the first JSON object/array embedded in a log message. */
export function extractJson(text: string): unknown {
  const start = text.search(/[{[]/);
  if (start < 0) return null;

  // SEND/RECV messages wrap JSON as: SEND [POST] [url] : [{...}]
  // Try progressively from each JSON-ish start position.
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;
    const candidate = balancedSlice(text, i);
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        // Unwrap [ {...} ] single-element wrappers used by SEND/RECV format
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === "object") {
          return parsed[0];
        }
        if (Array.isArray(parsed) && parsed.length === 0) continue;
        return parsed;
      }
    } catch {
      /* try next start */
    }
  }
  return null;
}

function balancedSlice(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
      if (depth < 0) return null;
    }
  }
  return null;
}
