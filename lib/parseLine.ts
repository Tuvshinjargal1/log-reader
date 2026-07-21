import type { Priority } from "./types";

const LINE_RE =
  /^(\d)\s+(\d{2}:\d{2}:\d{2}\.\d{3}):\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s*(.*)$/;

const FILE_RE = /^smartpos\.(\d{4})(\d{2})(\d{2})__(\d{2})\.log$/i;
const PLAIN_SMARTPOS_RE = /^smartpos(_[a-z0-9]+)?\.log$/i;

export interface ParsedLine {
  priority: Priority;
  time: string;
  className: string;
  method: string;
  message: string;
}

export function parseFileName(fileName: string): {
  date: string | null;
  hour: string | null;
} {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const m = base.match(FILE_RE);
  if (m) {
    return {
      date: `${m[1]}-${m[2]}-${m[3]}`,
      hour: m[4],
    };
  }
  // smartpos.log / smartpos_starter.log — date inferred from content later
  if (PLAIN_SMARTPOS_RE.test(base) || base.toLowerCase().endsWith(".log")) {
    return { date: null, hour: null };
  }
  return { date: null, hour: null };
}

/** Infer YYYY-MM-DD from log body when filename has no date. */
export function inferDateFromContent(text: string): string | null {
  const sample = text.slice(0, 80_000);

  // sysdate : [20260618141130]
  const sysdate = sample.match(/sysdate\s*:\s*\[(\d{4})(\d{2})(\d{2})\d{6}\]/i);
  if (sysdate) return `${sysdate[1]}-${sysdate[2]}-${sysdate[3]}`;

  // 2026-06-18 14:11:38 or "date":"2026-06-18T...
  const iso = sample.match(
    /(?:^|[^\d])(\d{4})-(\d{2})-(\d{2})(?:[T\s]\d{2}:\d{2})/,
  );
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "salesDate":"2026-07-20...
  const salesDate = sample.match(
    /"(?:salesDate|date)"\s*:\s*"(\d{4})-(\d{2})-(\d{2})/,
  );
  if (salesDate) return `${salesDate[1]}-${salesDate[2]}-${salesDate[3]}`;

  // exception: 07/19/2026
  const us = sample.match(/(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}:\d{2}/);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;

  // receipt: [NOR][301]2026/07/20
  const receipt = sample.match(/\[NOR\]\[301\](\d{4})\/(\d{2})\/(\d{2})/);
  if (receipt) return `${receipt[1]}-${receipt[2]}-${receipt[3]}`;

  return null;
}

/** First log-line HH from content. */
export function inferHourFromContent(text: string): string | null {
  const m = text.match(/^\d\s+(\d{2}):\d{2}:\d{2}\.\d{3}:/m);
  return m ? m[1] : null;
}

export function parseLine(line: string): ParsedLine | null {
  const m = line.match(LINE_RE);
  if (!m) return null;
  return {
    priority: Number(m[1]) as Priority,
    time: m[2],
    className: m[3].trim(),
    method: m[4].trim(),
    message: m[5] ?? "",
  };
}

export function shortClassName(className: string): string {
  const parts = className.split(".");
  return parts[parts.length - 1] || className;
}

export function isInOutMessage(message: string): boolean {
  const t = message.trim();
  return t === "IN" || t === "OUT" || t.startsWith("IN -") || t.startsWith("OUT -");
}

export function isHeartbeat(
  method: string,
  message: string,
  className: string,
): boolean {
  if (
    method === "posMainBgWrkTimer_Tick" ||
    method === "posMainBgWrkRegularScheduleTimer_Tick"
  ) {
    return true;
  }
  if (message.includes("logHistoryPerMinute")) return true;
  if (message.includes("##ManagedThreadId")) return true;
  if (className.includes("Start_Monitor") && message.includes("/rest/info")) {
    return true;
  }
  return false;
}

export function isContinuationLine(line: string): boolean {
  if (!line.trim()) return true;
  if (parseLine(line)) return false;
  if (/^HandlingInstanceID:/i.test(line)) return true;
  if (/^An exception of type/i.test(line)) return true;
  if (/^-{5,}/.test(line)) return true;
  if (/^Type\s*:/.test(line)) return true;
  if (/^Message\s*:/.test(line)) return true;
  if (/^Source\s*:/.test(line)) return true;
  if (/^Help link\s*:/.test(line)) return true;
  if (/^Exception data\s*:/i.test(line)) return true;
  if (/^Stack Trace\s*:/i.test(line)) return true;
  if (/^MachineName\s*:/i.test(line)) return true;
  if (/^AppDomainName\s*:/i.test(line)) return true;
  if (/^ProcessId\s*:/i.test(line)) return true;
  if (/^ProcessName\s*:/i.test(line)) return true;
  if (/^ThreadName\s*:/i.test(line)) return true;
  if (/^Win32 ThreadId\s*:/i.test(line)) return true;
  if (/^\s+at\s+/.test(line)) return true;
  if (/^\[(PLG|NOR|BLD|EBT|CUT|LOG|IMG|QR)\]/i.test(line)) return true;
  if (/^\t/.test(line)) return true;
  if (/^Сугалааны/.test(line)) return true;
  if (/^]/.test(line)) return true;
  return true;
}

export function timeToMs(time: string): number {
  const [h, m, rest] = time.split(":");
  const [s, ms] = rest.split(".");
  return (
    Number(h) * 3600000 +
    Number(m) * 60000 +
    Number(s) * 1000 +
    Number(ms || 0)
  );
}

export function sortKey(date: string | null, time: string, lineNumber: number): string {
  const d = date ?? "0000-00-00";
  return `${d}T${time}:${String(lineNumber).padStart(8, "0")}`;
}
