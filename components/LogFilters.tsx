"use client";

import type { LogFiltersState, Priority } from "@/lib/types";
import { moduleLabel, priorityLabel } from "@/lib/labels.mn";

interface LogFiltersProps {
  filters: LogFiltersState;
  modules: string[];
  onChange: (next: LogFiltersState) => void;
  resultCount: number;
  totalCount: number;
}

const ALL_PRIORITIES: Priority[] = [1, 2, 3, 4];

export function LogFilters({
  filters,
  modules,
  onChange,
  resultCount,
  totalCount,
}: LogFiltersProps) {
  function togglePriority(p: Priority) {
    const has = filters.priorities.includes(p);
    onChange({
      ...filters,
      priorities: has
        ? filters.priorities.filter((x) => x !== p)
        : [...filters.priorities, p].sort(),
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="mb-1 block text-stone-500">Хайлт</span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="мессеж, barcode, salesNo…"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">Модуль</span>
          <select
            value={filters.modules[0] ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                modules: e.target.value ? [e.target.value] : [],
              })
            }
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="">Бүгд</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {moduleLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">
            {resultCount.toLocaleString("mn-MN")}
          </span>
          {" / "}
          {totalCount.toLocaleString("mn-MN")} мөр
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_PRIORITIES.map((p) => {
          const on = filters.priorities.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => togglePriority(p)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium",
                on
                  ? priorityChipOn(p)
                  : "bg-stone-100 text-stone-400 line-through",
              ].join(" ")}
            >
              {p} · {priorityLabel(p)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Toggle
          checked={filters.hideInOut}
          onChange={(v) => onChange({ ...filters, hideInOut: v })}
          label="IN/OUT нуух"
        />
        <Toggle
          checked={filters.hideHeartbeat}
          onChange={(v) => onChange({ ...filters, hideHeartbeat: v })}
          label="Timer/heartbeat нуух"
        />
        <Toggle
          checked={filters.onlyErrors}
          onChange={(v) => onChange({ ...filters, onlyErrors: v })}
          label="Зөвхөн алдаа"
        />
        <Toggle
          checked={filters.onlyApi}
          onChange={(v) => onChange({ ...filters, onlyApi: v })}
          label="Зөвхөн SEND/RECV"
        />
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-stone-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-stone-300 text-teal-600 focus:ring-teal-500"
      />
      {label}
    </label>
  );
}

function priorityChipOn(p: Priority): string {
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
      return "bg-stone-200 text-stone-700";
  }
}
