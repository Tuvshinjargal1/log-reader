"use client";

import { Fragment, useMemo, useState } from "react";
import type { Deal, EventKind, LogEntry, LogFiltersState } from "@/lib/types";
import { filterEntries, tryPrettyJson, uniqueModules } from "@/lib/filter";
import {
  eventLabel,
  formatAmount,
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
  activeDeal?: Deal | null;
  onClearDealFilter?: () => void;
}

export function DetailLog({
  entries,
  filters,
  onFiltersChange,
  activeDeal,
  onClearDealFilter,
}: DetailLogProps) {
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
      {activeDeal && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <div className="min-w-0 text-sm">
            <span className="font-semibold text-teal-900">
              #{activeDeal.index} борлуулалтын лог
            </span>
            {activeDeal.salesNo && (
              <span className="ml-2 font-mono text-xs text-teal-700">
                {activeDeal.salesNo}
              </span>
            )}
            <span className="ml-2 text-teal-800">
              {activeDeal.date ? `${activeDeal.date} · ` : ""}
              {activeDeal.startTime.slice(0, 8)}
              {activeDeal.amount != null && (
                <> · {formatAmount(activeDeal.amount)}</>
              )}
            </span>
            <span className="ml-2 text-teal-600">
              {filtered.length.toLocaleString("mn-MN")} мөр
            </span>
          </div>
          {onClearDealFilter && (
            <button
              type="button"
              onClick={onClearDealFilter}
              className="shrink-0 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-100"
            >
              Шүүлт цуцлах
            </button>
          )}
        </div>
      )}

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
              <Fragment key={entry.id}>
                {entry.eventKind === "deal_start" && (
                  <li className="bg-teal-600 px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white">
                    ——— Борлуулалт эхэлсэн ———
                  </li>
                )}
                <LogRow
                  entry={entry}
                  open={expanded === entry.id}
                  highlight={!!activeDeal}
                  onToggle={() =>
                    setExpanded((id) => (id === entry.id ? null : entry.id))
                  }
                />
              </Fragment>
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
  highlight,
  onToggle,
}: {
  entry: LogEntry;
  open: boolean;
  highlight: boolean;
  onToggle: () => void;
}) {
  const fullText = [entry.message, ...entry.continuation].join("\n");
  const pretty = open ? tryPrettyJson(fullText) : null;
  const hasReceiptDump =
    open && entry.continuation.some((l) => /^\[(PLG|NOR|BLD|EBT)\]/i.test(l));
  const kindStyle = eventKindStyle(entry.eventKind, entry.isError);
  const isDealStart = entry.eventKind === "deal_start";

  return (
    <li className={kindStyle.row}>
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full gap-3 border-l-4 px-3 py-2.5 text-left hover:brightness-[0.98]",
          kindStyle.border,
          isDealStart ? "py-3" : "",
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
            <span
              className={[
                "text-sm font-medium",
                isDealStart ? "text-teal-900" : "text-stone-700",
              ].join(" ")}
            >
              {moduleLabel(entry.shortClass)}
            </span>
            {entry.eventKind !== "other" && (
              <span
                className={[
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  kindStyle.badge,
                ].join(" ")}
              >
                {eventLabel(entry.eventKind)}
              </span>
            )}
          </div>
          <p
            className={[
              "truncate text-sm",
              entry.isError
                ? "text-red-700"
                : isDealStart
                  ? "font-medium text-teal-800"
                  : "text-stone-600",
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
            {highlight && (
              <div>
                <span className="text-stone-400">Төрөл: </span>
                {eventLabel(entry.eventKind)}
              </div>
            )}
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

function eventKindStyle(
  kind: EventKind,
  isError: boolean,
): { border: string; row: string; badge: string } {
  if (isError || kind === "exception" || kind === "http_error") {
    return {
      border: "border-red-500",
      row: "bg-red-50/70",
      badge: "bg-red-100 text-red-800",
    };
  }
  switch (kind) {
    case "deal_start":
      return {
        border: "border-teal-500",
        row: "bg-teal-50/80",
        badge: "bg-teal-200 text-teal-900",
      };
    case "scan":
      return {
        border: "border-sky-400",
        row: "bg-sky-50/50",
        badge: "bg-sky-100 text-sky-800",
      };
    case "payment":
    case "tender":
      return {
        border: "border-emerald-500",
        row: "bg-emerald-50/50",
        badge: "bg-emerald-100 text-emerald-800",
      };
    case "ebarimt":
      return {
        border: "border-indigo-500",
        row: "bg-indigo-50/50",
        badge: "bg-indigo-100 text-indigo-800",
      };
    case "receipt":
      return {
        border: "border-stone-400",
        row: "bg-stone-50",
        badge: "bg-stone-200 text-stone-700",
      };
    case "popup":
    case "display_message":
      return {
        border: "border-amber-400",
        row: "",
        badge: "bg-amber-100 text-amber-800",
      };
    case "api_send":
    case "api_recv":
      return {
        border: "border-violet-400",
        row: "",
        badge: "bg-violet-100 text-violet-800",
      };
    default:
      return {
        border: "border-transparent",
        row: "",
        badge: "bg-stone-100 text-stone-500",
      };
  }
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
