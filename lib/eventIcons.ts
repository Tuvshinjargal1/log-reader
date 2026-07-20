import type { EventKind } from "./types";

export function eventIcon(kind: EventKind): string {
  switch (kind) {
    case "deal_start":
      return "▶";
    case "scan":
      return "▥";
    case "display_message":
      return "💬";
    case "popup":
      return "◱";
    case "payment":
      return "₮";
    case "tender":
      return "₮";
    case "ebarimt":
      return "🧾";
    case "receipt":
      return "🖨";
    case "http_error":
    case "exception":
      return "!";
    case "api_send":
      return "↑";
    case "api_recv":
      return "↓";
    default:
      return "·";
  }
}

export function eventIconColor(kind: EventKind): string {
  switch (kind) {
    case "deal_start":
      return "bg-teal-100 text-teal-700";
    case "scan":
      return "bg-sky-100 text-sky-700";
    case "payment":
    case "tender":
      return "bg-emerald-100 text-emerald-700";
    case "ebarimt":
      return "bg-indigo-100 text-indigo-700";
    case "receipt":
      return "bg-stone-200 text-stone-600";
    case "http_error":
    case "exception":
      return "bg-red-100 text-red-700";
    case "display_message":
      return "bg-amber-100 text-amber-700";
    case "popup":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-stone-100 text-stone-500";
  }
}
