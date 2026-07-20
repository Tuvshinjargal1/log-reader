"use client";

import type { ParsedLog } from "@/lib/types";
import { formatAmount } from "@/lib/labels.mn";

interface FileSummaryProps {
  data: ParsedLog;
  onClear: () => void;
}

export function FileSummary({ data, onClear }: FileSummaryProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Ачаалсан файл
        </h2>
        <ul className="mt-1 space-y-0.5">
          {data.files.map((f) => (
            <li key={f.fileName} className="truncate text-sm text-stone-800">
              <span className="font-medium">{f.fileName}</span>
              {f.date && (
                <span className="ml-2 text-stone-500">
                  {f.date}
                  {f.hour != null ? ` · ${f.hour}:00` : ""}
                </span>
              )}
              <span className="ml-2 text-stone-400">
                {f.entryCount.toLocaleString("mn-MN")} мөр
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-3 text-center">
        <Stat label="Нийт мөр" value={data.entries.length.toLocaleString("mn-MN")} />
        <Stat label="Борлуулалт" value={String(data.dealCount)} accent="teal" />
        <Stat
          label="Алдаа"
          value={String(data.errorCount)}
          accent={data.errorCount > 0 ? "red" : "stone"}
        />
        {data.deals.some((d) => d.amount) && (
          <Stat
            label="Нийт дүн (олдсон)"
            value={formatAmount(
              data.deals.reduce((s, d) => s + (d.amount ?? 0), 0),
            )}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
      >
        Цэвэрлэх
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "stone",
}: {
  label: string;
  value: string;
  accent?: "teal" | "red" | "stone";
}) {
  const color =
    accent === "teal"
      ? "text-teal-700"
      : accent === "red"
        ? "text-red-600"
        : "text-stone-800";
  return (
    <div className="min-w-[4.5rem] rounded-lg bg-stone-50 px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
