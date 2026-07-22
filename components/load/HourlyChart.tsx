"use client";

import type { BranchLoad } from "@/lib/load/types";

interface HourlyChartProps {
  load: BranchLoad;
}

export function HourlyChart({ load }: HourlyChartProps) {
  const max = Math.max(...load.hourlyAvgTx, 1);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Цагийн задаргаа — {load.branch?.name ?? load.bizplCd}
      </h3>
      <p className="mb-3 text-xs text-stone-400">
        Өдрийн дундаж гүйлгээний тоо, цаг тутмаар ({load.dayCount} өдрийн дундаж)
      </p>
      <div className="space-y-0.5">
        {load.hourlyAvgTx.map((tx, hour) => {
          const isPeak = hour === load.peakHour;
          return (
            <div key={hour} className="flex items-center gap-2 text-sm">
              <span
                className={[
                  "w-12 shrink-0 font-mono text-xs",
                  isPeak ? "font-semibold text-red-600" : "text-stone-500",
                ].join(" ")}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
              <div className="h-3.5 flex-1 rounded bg-stone-100">
                <div
                  className={[
                    "h-3.5 rounded",
                    isPeak ? "bg-red-500" : "bg-teal-500/70",
                  ].join(" ")}
                  style={{ width: `${(tx / max) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-stone-600">
                {tx.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
