"use client";

import { useMemo, useState } from "react";
import type { LogEntry, LogFiltersState } from "@/lib/types";
import { filterEntries, tryPrettyJson, uniqueModules } from "@/lib/filter";
import {
  eventLabel,
  moduleLabel,
  priorityLabel,
} from "@/lib/labels.mn";
import { LogFilters } from "./LogFilters";
import { ReceiptView } from "./ReceiptView";

const PAGE_SIZE = 100;

interface DetailLogProps {
  entries: LogEntry[];
  filters: LogFiltersState;
  onFiltersChange: (f: LogFiltersState) => void;
}

export function DetailLog({ entries, filters, onFiltersChange }: DetailLogProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const modules = useMemo(() => uniqueModules(entries), [entries]);
  const filtered = useMemo(
    () => filterEntries(entries, filters),
    [entries, filters],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  function changeFilters(next: LogFiltersState) {
    setPage(0);
    onFiltersChange(next);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-stone-800">Дэлгэрэнгүй лог</h2>
      <LogFilters
        filters={filters}
        modules={modules}
        onChange={changeFilters}
        resultCount={filtered.length}
        totalCount={entries.length}
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {pageItems.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">
            Шүүлтүүрт тохирох мөр олдсонгүй.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {pageItems.map((entry) => (
              <LogRow
                key={entry.id}
                entry={entry}
                open={expanded === entry.id}
                onToggle={() =>
                  setExpanded((id) => (id === entry.id ? null : entry.id))
                }
              />
            ))}
          </ul>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-stone-300 px-3 py-1.5 disabled:opacity-40"
          >
            Өмнөх
          </button>
          <span className="text-stone-500">
            Хуудас {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-lg border border-stone-300 px-3 py-1.5 disabled:opacity-40"
          >
            Дараах
          </button>
        </div>
      )}
    </section>
  );
}

function LogRow({
  entry,
  open,
  onToggle,
}: {
  entry: LogEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const fullText = [entry.message, ...entry.continuation].join("\n");
  const pretty = open ? tryPrettyJson(fullText) : null;
  const hasReceiptDump =
    open && entry.continuation.some((l) => /^\[(PLG|NOR|BLD|EBT)\]/i.test(l));

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full gap-3 px-3 py-2.5 text-left hover:bg-stone-50",
          entry.isError ? "bg-red-50/60" : "",
        ].join(" ")}
      >
        <span className="w-20 shrink-0 font-mono text-xs text-stone-400">
          {entry.time}
        </span>
        <span
          className={[
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold",
            priorityColor(entry.priority),
          ].join(" ")}
          title={priorityLabel(entry.priority)}
        >
          {entry.priority}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-stone-700">
              {moduleLabel(entry.shortClass)}
            </span>
            {entry.eventKind !== "other" && (
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                {eventLabel(entry.eventKind)}
              </span>
            )}
          </div>
          <p
            className={[
              "truncate text-sm",
              entry.isError ? "text-red-700" : "text-stone-600",
            ].join(" ")}
          >
            {entry.message || "(үргэлжлэл)"}
          </p>
        </div>
        <span className="shrink-0 text-xs text-stone-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-stone-100 bg-stone-50 px-4 py-3 text-sm">
          <div className="grid gap-1 font-mono text-xs text-stone-500 sm:grid-cols-2">
            <div>
              <span className="text-stone-400">Class: </span>
              {entry.className}
            </div>
            <div>
              <span className="text-stone-400">Method: </span>
              {entry.method}
            </div>
            <div>
              <span className="text-stone-400">Файл: </span>
              {entry.fileName} :{entry.lineNumber}
            </div>
          </div>
          {hasReceiptDump ? (
            <ReceiptView lines={entry.continuation} />
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-stone-900 p-3 text-xs text-stone-100">
              {pretty ?? fullText}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

function priorityColor(p: number): string {
  switch (p) {
    case 1:
      return "bg-sky-100 text-sky-800";
    case 2:
      return "bg-amber-100 text-amber-800";
    case 3:
      return "bg-violet-100 text-violet-800";
    case 4:
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-stone-200 text-stone-600";
  }
}
