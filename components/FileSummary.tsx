"use client";

import { useRef } from "react";
import type { ParsedLog } from "@/lib/types";
import { formatAmount } from "@/lib/labels.mn";

interface FileSummaryProps {
  data: ParsedLog;
  onClear: () => void;
  onReplace: (files: File[]) => void;
  busy?: boolean;
}

export function FileSummary({ data, onClear, onReplace, busy }: FileSummaryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const primary = data.files[0];
  const extra = data.files.length - 1;
  const totalAmount = data.deals.reduce((s, d) => s + (d.amount ?? 0), 0);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-stone-800">
          {primary?.fileName ?? "файл"}
          {extra > 0 && (
            <span className="ml-1 font-normal text-stone-400">+{extra}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
          {primary?.date && (
            <span>
              {primary.date}
              {primary.hour != null ? ` · ${primary.hour}:00` : ""}
            </span>
          )}
          <span>
            <strong className="font-semibold text-teal-700">{data.dealCount}</strong>{" "}
            борлуулалт
          </span>
          <span>
            <strong
              className={
                data.errorCount > 0
                  ? "font-semibold text-red-600"
                  : "font-semibold text-stone-700"
              }
            >
              {data.errorCount}
            </strong>{" "}
            алдаа
          </span>
          {totalAmount > 0 && (
            <span className="tabular-nums">{formatAmount(totalAmount)}</span>
          )}
          <span className="text-stone-400">
            {data.entries.length.toLocaleString("mn-MN")} мөр
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".log,.txt,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onReplace(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Файл солих
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        >
          Цэвэрлэх
        </button>
      </div>
    </div>
  );
}
