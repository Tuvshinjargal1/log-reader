"use client";

/**
 * Ачаалалтын хайрцгууд — геометр нь бодит агуулгатай ЯГ таарсан тул дата
 * ирэхэд layout шилжихгүй.
 *
 * ⚠️ Зөвхөн ЭХНИЙ ачаалалтад. Дахин татах үед skeleton тавихгүй — өмнөх
 * render-ыг `opacity-60`-д барина (skeleton анивчих нь layout jump-тай адил хор).
 */
import { Skeleton } from "./ui";

export function BoardSkeleton() {
  return (
    <div className="space-y-4">
      {/* TodayStrip */}
      <Skeleton className="h-14 w-full" />

      {/* VerdictTally: гарчиг + 36px чипийн эгнээ + тайлбар */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <Skeleton className="h-5 w-64" />
        <div className="mt-4 flex gap-[2px]">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-9 flex-1" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-36" />
          ))}
        </div>
      </div>

      {/* DecisionQuadrant — viewBox 960×500 → харьцаа 1.92 */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-4 aspect-[960/500] w-full" />
      </div>

      {/* CategoryHeatGrid — 20 мөр × ~36px */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 space-y-[3px]">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>

      {/* FleetTrend — viewBox 960×320 */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <Skeleton className="h-5 w-60" />
        <Skeleton className="mt-4 aspect-[960/320] w-full" />
      </div>
    </div>
  );
}
