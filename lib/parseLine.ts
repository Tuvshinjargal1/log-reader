import type { Priority } from "./types";

const LINE_RE =
  /^(\d)\s+(\d{2}:\d{2}:\d{2}\.\d{3}):\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s*(.*)$/;

const FILE_RE = /^smartpos\.(\d{4})(\d{2})(\d{2})__(\d{2})\.log$/i;

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
  if (!m) return { date: null, hour: null };
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    hour: m[4],
  };
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
