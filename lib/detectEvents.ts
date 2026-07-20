import type { EventKind, LogEntry } from "./types";
import { shortClassName } from "./parseLine";
import { paymentLabel, viewLabel } from "./labels.mn";

export function detectEventKind(entry: {
  method: string;
  message: string;
  className: string;
  continuation: string[];
}): EventKind {
  const msg = entry.message;
  const full = [msg, ...entry.continuation].join("\n");
  const method = entry.method;
  const cls = entry.className;

  if (msg.includes("Deal Start")) return "deal_start";
  if (/HandlingInstanceID:/i.test(full) || /exception of type/i.test(full)) {
    return "exception";
  }
  if (/HTTP communication error/i.test(msg)) return "http_error";

  if (method === "PrintReceipt" || method === "PrintReceiptWithWin") {
    return "receipt";
  }
  if (/^\[(PLG|NOR|BLD|EBT)\]/i.test(full) && cls.includes("PosPrinter")) {
    return "receipt";
  }

  if (/\bSEND\s+\[/.test(msg)) {
    if (/\/api\/receipt/i.test(msg) || method.includes("ReceiptAgent")) {
      return "ebarimt";
    }
    if (/payment|create-payment|PGW|PGWA/i.test(msg + method)) {
      return "payment";
    }
    return "api_send";
  }
  if (/\bRECV\s+\[/.test(msg)) {
    if (/\/api\/receipt/i.test(msg) || method.includes("ReceiptAgent") || /"lottery"|vatDdtdNo|"status":"SUCCESS"/i.test(msg)) {
      if (method.includes("ReceiptAgent") || /lottery|vatDdtd/i.test(msg)) {
        return "ebarimt";
      }
    }
    if (/paymentMethod|auth_code|requestStatus|salesStatus/i.test(msg)) {
      return "payment";
    }
    return "api_recv";
  }

  if (
    /ID:SCANNING/i.test(msg) ||
    /"ActionId"\s*:\s*"SCANNING"/i.test(msg) ||
    (/SCANNING/i.test(msg) && /DATA:|InputData/i.test(msg))
  ) {
    return "scan";
  }

  if (
    (method === "OpenPopup" || method === "ChangeViewTo") &&
    (/viewName:/i.test(msg) || /"ActionId"/i.test(msg))
  ) {
    return "popup";
  }

  if (
    method === "DisplayMessage" &&
    msg.trim() !== "IN" &&
    msg.trim() !== "OUT" &&
    !msg.startsWith("IN ") &&
    !msg.startsWith("OUT ") &&
    !msg.startsWith("IN-") &&
    !msg.startsWith("OUT-")
  ) {
    return "display_message";
  }

  if (/TenderKind:|TenderAmt:/i.test(msg)) {
    return "tender";
  }

  return "other";
}

export function isErrorEntry(entry: {
  eventKind: EventKind;
  message: string;
  continuation: string[];
}): boolean {
  if (entry.eventKind === "exception" || entry.eventKind === "http_error") {
    return true;
  }
  const full = [entry.message, ...entry.continuation].join("\n");
  if (/HandlingInstanceID/i.test(full)) return true;
  if (/HTTP communication error/i.test(full)) return true;
  if (
    /\bRECV\b/i.test(entry.message) &&
    /"status"\s*:\s*"(ERROR|FAIL|FAILED)"/i.test(full)
  ) {
    return true;
  }
  return false;
}

export function describeEvent(entry: LogEntry): { title: string; detail?: string } {
  const msg = entry.message;
  const kind = entry.eventKind;

  switch (kind) {
    case "deal_start":
      return { title: "Борлуулалт эхэлсэн" };
    case "scan": {
      const data =
        msg.match(/DATA:([^,\s]+)/)?.[1] ||
        msg.match(/"InputData"\s*:\s*"([^"]+)"/)?.[1];
      return {
        title: "Бараа скан хийсэн",
        detail: data ? `Код: ${data}` : undefined,
      };
    }
    case "display_message":
      return { title: "Дэлгэцийн мессеж", detail: msg.trim() };
    case "popup": {
      const view = msg.match(/viewName:([^,\s]+)/)?.[1];
      return {
        title: "Цонх нээгдсэн",
        detail: view ? viewLabel(view) : undefined,
      };
    }
    case "tender": {
      const kindMatch = msg.match(/TenderKind:([^,\s]+)/);
      const amt = msg.match(/TenderAmt:([\d.]+)/);
      const parts: string[] = [];
      if (kindMatch) parts.push(paymentLabel(kindMatch[1]));
      if (amt) parts.push(`${Number(amt[1]).toLocaleString("mn-MN")} ₮`);
      return {
        title: "Төлбөрийн төрөл сонгосон",
        detail: parts.length ? parts.join(" · ") : undefined,
      };
    }
    case "payment": {
      const method =
        msg.match(/"paymentMethod"\s*:\s*"([^"]+)"/)?.[1] ||
        msg.match(/paymentMethod[=:](\w+)/i)?.[1];
      const amount =
        msg.match(/"amount"\s*:\s*([\d.]+)/)?.[1] ||
        msg.match(/"salesAmount"\s*:\s*([\d.]+)/)?.[1];
      const isSend = /\bSEND\b/.test(msg);
      const isRecv = /\bRECV\b/.test(msg);
      const status =
        msg.match(/"requestStatus"\s*:\s*"([^"]+)"/)?.[1] ||
        msg.match(/"salesStatus"\s*:\s*"([^"]+)"/)?.[1];
      const parts: string[] = [];
      if (method) parts.push(paymentLabel(method));
      if (amount) parts.push(`${Number(amount).toLocaleString("mn-MN")} ₮`);
      if (status) {
        const statusMn: Record<string, string> = {
          PAID: "Төлсөн",
          PENDING: "Хүлээгдэж буй",
          SUCCESS: "Амжилттай",
          FAILED: "Амжилтгүй",
          ERROR: "Алдаа",
        };
        parts.push(statusMn[status] ?? status);
      }
      return {
        title: isSend
          ? "Төлбөрийн хүсэлт илгээсэн"
          : isRecv
            ? "Төлбөрийн хариу авсан"
            : "Төлбөр",
        detail: parts.length ? parts.join(" · ") : undefined,
      };
    }
    case "ebarimt": {
      const isSend = /\bSEND\b/.test(msg);
      const lottery = msg.match(/"lottery"\s*:\s*"([^"]+)"/)?.[1];
      const salesNo = msg.match(/"salesNo"\s*:\s*"([^"]+)"/)?.[1];
      const status = msg.match(/"status"\s*:\s*"([^"]+)"/)?.[1];
      const parts: string[] = [];
      if (salesNo) parts.push(`Гүйлгээ: ${salesNo}`);
      if (lottery) parts.push(`Сугалаа: ${lottery}`);
      if (status) parts.push(status);
      return {
        title: isSend ? "eBarimt илгээсэн" : "eBarimt хариу",
        detail: parts.length ? parts.join(" · ") : undefined,
      };
    }
    case "api_send": {
      const url = msg.match(/\[(https?:\/\/[^\]]+)\]/)?.[1];
      return { title: "API илгээсэн", detail: url };
    }
    case "api_recv":
      return { title: "API хариу авсан" };
    case "http_error":
      return { title: "HTTP холболтын алдаа", detail: msg.slice(0, 200) };
    case "exception": {
      const type =
        msg.match(/exception of type '([^']+)'/i)?.[1] ||
        entry.continuation.join("\n").match(/Type\s*:\s*([^,\n]+)/)?.[1];
      return {
        title: "Системийн алдаа",
        detail: type ? shortClassName(type.trim()) : undefined,
      };
    }
    case "receipt":
      return { title: "Баримт хэвлэсэн" };
    default:
      return { title: entry.message.slice(0, 80) || entry.method };
  }
}

export function extractSalesNo(text: string): string | undefined {
  return (
    text.match(/"salesNo"\s*:\s*"([^"]+)"/)?.[1] ||
    text.match(/"sales_no"\s*:\s*"([^"]+)"/)?.[1] ||
    text.match(/"posTranId"\s*:\s*"([^"]+)"/)?.[1]
  );
}

export function extractAmount(text: string): number | undefined {
  const m =
    text.match(/"totalAmount"\s*:\s*([\d.]+)/) ||
    text.match(/"salesAmount"\s*:\s*([\d.]+)/) ||
    text.match(/"amount"\s*:\s*([\d.]+)/);
  return m ? Number(m[1]) : undefined;
}

export function extractPaymentMethod(text: string): string | undefined {
  const m =
    text.match(/"paymentMethod"\s*:\s*"([^"]+)"/) ||
    text.match(/TenderKind:([^,\s]+)/);
  return m?.[1];
}
