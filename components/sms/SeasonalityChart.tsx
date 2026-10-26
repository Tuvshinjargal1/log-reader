"use client";

import type { SeasonBucket } from "@/lib/engine";
import { sequentialColor } from "@/lib/diagram/colors";

const DOW_LABELS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

export function SeasonalityChart({ dow }: { dow: SeasonBucket[] }) {
  const sorted = [...dow].sort((a, b) => a.bucket - b.bucket);
  const max = Math.max(...sorted.map((b) => b.multiplier), 1.2);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h4 className="mb-1 text-sm font-semibold text-stone-800">
        Гарагийн эрэлтийн хэв маяг
      </h4>
      <p className="mb-3 text-xs text-stone-500">
        Долоо хоногийн өдөр тус бүрийн дундаж эрэлт (1.0 = дундаж). Прогноз энэ
        хэв маягаар өдөр бүрийг тохируулна.
      </p>
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {sorted.map((b) => {
          const h = Math.max(4, (b.multiplier / max) * 100);
          const above = b.multiplier >= 1;
          return (
            <div key={b.bucket} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-stone-500">
                {b.multiplier.toFixed(2)}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${h}%`,
                    background: above ? sequentialColor(b.multiplier - 1) : "#e7e5e4",
                    minHeight: 4,
                  }}
                  title={`${DOW_LABELS[b.bucket]}: ×${b.multiplier.toFixed(2)} (${b.sampleCount} өдөр)`}
                />
              </div>
              <span className="text-xs font-medium text-stone-600">
                {DOW_LABELS[b.bucket]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
