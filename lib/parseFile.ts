import type { LogEntry, ParsedFileMeta, Priority } from "./types";
import {
  inferDateFromContent,
  inferHourFromContent,
  isContinuationLine,
  isHeartbeat,
  isInOutMessage,
  parseFileName,
  parseLine,
  shortClassName,
  sortKey,
} from "./parseLine";
import { detectEventKind, isErrorEntry } from "./detectEvents";

let nextId = 1;

export function resetEntryIds(): void {
  nextId = 1;
}

export function parseLogText(
  text: string,
  fileName: string,
  startLineNumber = 1,
): { entries: LogEntry[]; meta: ParsedFileMeta } {
  let { date, hour } = parseFileName(fileName);
  if (!date) date = inferDateFromContent(text);
  if (!hour) hour = inferHourFromContent(text);

  const lines = text.split(/\r?\n/);
  const entries: LogEntry[] = [];
  let current: LogEntry | null = null;
  let lineNumber = startLineNumber - 1;

  for (const raw of lines) {
    lineNumber += 1;
    const line = raw;

    if (!line.trim() && !current) continue;

    const parsed = parseLine(line);
    if (parsed) {
      if (current) entries.push(finalizeEntry(current));

      const shortClass = shortClassName(parsed.className);
      const isInOut = isInOutMessage(parsed.message);
      const heartbeat = isHeartbeat(
        parsed.method,
        parsed.message,
        parsed.className,
      );

      current = {
        id: nextId++,
        lineNumber,
        priority: parsed.priority as Priority,
        time: parsed.time,
        date,
        className: parsed.className,
        shortClass,
        method: parsed.method,
        message: parsed.message,
        continuation: [],
        fileName,
        isInOut,
        isHeartbeat: heartbeat,
        isError: false,
        eventKind: "other",
        sortKey: sortKey(date, parsed.time, lineNumber),
      };
      continue;
    }

    if (current && (isContinuationLine(line) || !parseLine(line))) {
      // Exception blocks often start without a log header mid-file
      if (/^HandlingInstanceID:/i.test(line) && current.continuation.length === 0) {
        // attach as continuation of previous, or create synthetic if message empty
        current.continuation.push(line);
        continue;
      }
      current.continuation.push(line);
      continue;
    }

    // Orphan exception / receipt block without preceding header
    if (/^HandlingInstanceID:/i.test(line)) {
      if (current) entries.push(finalizeEntry(current));
      current = {
        id: nextId++,
        lineNumber,
        priority: 2,
        time: "00:00:00.000",
        date,
        className: "Exception",
        shortClass: "Exception",
        method: "HandleException",
        message: line,
        continuation: [],
        fileName,
        isInOut: false,
        isHeartbeat: false,
        isError: true,
        eventKind: "exception",
        sortKey: sortKey(date, "00:00:00.000", lineNumber),
      };
      continue;
    }
  }

  if (current) entries.push(finalizeEntry(current));

  const meta: ParsedFileMeta = {
    fileName,
    date,
    hour,
    lineCount: lines.length,
    entryCount: entries.length,
  };

  return { entries, meta };
}

function finalizeEntry(entry: LogEntry): LogEntry {
  const eventKind = detectEventKind(entry);
  const isError = isErrorEntry({ ...entry, eventKind });
  // Re-detect receipt from continuation tags after PrintReceipt
  let kind = eventKind;
  if (
    kind === "other" &&
    entry.continuation.some((l) => /^\[(PLG|NOR|BLD|EBT)\]/i.test(l))
  ) {
    kind = "receipt";
  }
  // Exception date line may update time for orphan blocks
  if (kind === "exception" || entry.eventKind === "exception") {
    const dateLine = entry.continuation.find((l) =>
      /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/.test(l),
    );
    if (dateLine && entry.time === "00:00:00.000") {
      const tm = dateLine.match(/\d{2}:\d{2}:\d{2}/);
      if (tm) {
        entry.time = tm[0] + ".000";
        entry.sortKey = sortKey(entry.date, entry.time, entry.lineNumber);
      }
    }
  }
  return {
    ...entry,
    eventKind: kind,
    isError,
  };
}

export function mergeParsedFiles(
  results: { entries: LogEntry[]; meta: ParsedFileMeta }[],
): { entries: LogEntry[]; files: ParsedFileMeta[] } {
  const files = results.map((r) => r.meta);
  const entries = results
    .flatMap((r) => r.entries)
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  return { entries, files };
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Файл уншиж чадсангүй"));
    reader.readAsText(file, "UTF-8");
  });
}
