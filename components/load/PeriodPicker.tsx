"use client";

import {
  currentMonth,
  monthWeeks,
  toIso,
  weekDays,
  type PeriodSelection,
} from "@/lib/load/period";

interface PeriodPickerProps {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
  disabled?: boolean;
}

const DAY_NAMES = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

export function PeriodPicker({ value, onChange, disabled }: PeriodPickerProps) {
  const weeks = monthWeeks(value.month);
  const selectedWeek = value.week !== null ? weeks[value.week] : null;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold uppercase tracking-wide text-stone-500">
        Хугацаа
      </label>
      <p className="text-xs text-stone-400">
        Шинжилгээ үргэлж сонгосон өдрөөс 1 сар ухарсан цонхонд (now − 1 month).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={value.month}
          max={currentMonth()}
          disabled={disabled}
          onChange={(e) => {
            if (!e.target.value) return;
            onChange({ month: e.target.value, week: null, day: null });
          }}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800 focus:border-teal-500 focus:outline-none disabled:bg-stone-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...value, week: null, day: null })}
          className={[
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value.week === null
              ? "bg-stone-900 text-white"
              : "border border-stone-300 bg-white text-stone-600 hover:bg-stone-50",
          ].join(" ")}
        >
          Сүүлийн 1 сар
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {weeks.map((w) => {
          const active = value.week === w.index;
          return (
            <button
              key={w.index}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, week: w.index, day: null })}
              className={[
                "rounded-lg px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                active
                  ? "bg-teal-600 text-white"
                  : "border border-stone-200 bg-white text-stone-600 hover:border-teal-400",
              ].join(" ")}
            >
              {w.index + 1}-р 7 хоног ({w.label})
            </button>
          );
        })}
      </div>

      {selectedWeek && (
        <div className="flex flex-wrap gap-1.5">
          {weekDays(selectedWeek).map((d) => {
            const iso = toIso(d);
            const active = value.day === iso;
            const dow = (d.getDay() + 6) % 7;
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...value, day: active ? null : iso })
                }
                className={[
                  "rounded-lg px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  active
                    ? "bg-teal-600 text-white"
                    : "border border-stone-200 bg-white text-stone-600 hover:border-teal-400",
                ].join(" ")}
              >
                {DAY_NAMES[dow]} {d.getMonth() + 1}/{d.getDate()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
