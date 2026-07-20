import type { LogEntry, LogFiltersState, Priority } from "./types";

export const DEFAULT_FILTERS: LogFiltersState = {
  query: "",
  priorities: [1, 2, 3, 4],
  modules: [],
  hideInOut: true,
  hideHeartbeat: true,
  onlyErrors: false,
  onlyApi: false,
  dealEntryIds: null,
};

export function filterEntries(
  entries: LogEntry[],
  filters: LogFiltersState,
): LogEntry[] {
  const q = filters.query.trim().toLowerCase();
  const moduleSet = filters.modules.length
    ? new Set(filters.modules)
    : null;
  const dealSet = filters.dealEntryIds
    ? new Set(filters.dealEntryIds)
    : null;
  const prioSet = new Set(filters.priorities);

  return entries.filter((e) => {
    if (dealSet && !dealSet.has(e.id)) return false;
    if (!prioSet.has(e.priority as Priority)) return false;
    if (filters.hideInOut && e.isInOut && e.eventKind === "other") return false;
    if (filters.hideHeartbeat && e.isHeartbeat) return false;
    if (filters.onlyErrors && !e.isError) return false;
    if (
      filters.onlyApi &&
      e.eventKind !== "api_send" &&
      e.eventKind !== "api_recv" &&
      e.eventKind !== "payment" &&
      e.eventKind !== "ebarimt" &&
      e.eventKind !== "http_error"
    ) {
      return false;
    }
    if (moduleSet && !moduleSet.has(e.shortClass)) return false;
    if (q) {
      const hay = [
        e.message,
        e.method,
        e.className,
        e.shortClass,
        ...e.continuation,
      ]
        .join("\n")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function uniqueModules(entries: LogEntry[]): string[] {
  const set = new Set(entries.map((e) => e.shortClass));
  return Array.from(set).sort();
}

export function tryPrettyJson(text: string): string | null {
  // Extract JSON array/object from SEND/RECV style messages
  const idx = text.search(/[\[{]/);
  if (idx < 0) return null;
  const candidate = text.slice(idx);
  try {
    const parsed = JSON.parse(candidate);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // try to find balanced JSON
    for (const start of ["[", "{"]) {
      const i = text.indexOf(start);
      if (i < 0) continue;
      const slice = text.slice(i);
      try {
        const parsed = JSON.parse(slice);
        return JSON.stringify(parsed, null, 2);
      } catch {
        /* continue */
      }
    }
    return null;
  }
}
