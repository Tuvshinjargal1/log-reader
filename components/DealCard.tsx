"use client";

import type { Deal } from "@/lib/types";
import { eventIcon, eventIconColor } from "@/lib/eventIcons";
import { formatAmount, formatDuration } from "@/lib/labels.mn";

interface DealCardProps {
  deal: Deal;
  selected: boolean;
  onSelect: (deal: Deal) => void;
}

const KOREAN_RE = /[\uAC00-\uD7AF]/;

export function DealCard({ deal, selected, onSelect }: DealCardProps) {
  const itemCount = deal.basket.reduce((s, i) => s + i.qty, 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(deal)}
      className={[
        "w-full rounded-xl border px-4 py-3 text-left transition-shadow",
        selected
          ? "border-teal-500 bg-teal-50 shadow-md ring-1 ring-teal-500"
          : deal.hasError
            ? "border-red-200 bg-white hover:border-red-300 hover:shadow-sm"
            : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-stone-800">
              #{deal.index} Борлуулалт
            </span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-medium",
                deal.hasError
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {deal.hasError ? "Алдаатай" : "Амжилттай"}
            </span>
            {itemCount > 0 && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {itemCount} бараа
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-stone-500">
            {deal.date ? `${deal.date} · ` : ""}
            {deal.startTime.slice(0, 8)} → {deal.endTime.slice(0, 8)}
            <span className="ml-2">({formatDuration(deal.durationMs)})</span>
          </div>
        </div>
        <div className="text-right text-sm">
          {deal.amount != null && (
            <div className="font-semibold tabular-nums text-stone-800">
              {formatAmount(deal.amount)}
            </div>
          )}
          {deal.paymentMethod && (
            <div className="text-stone-500">{deal.paymentMethod}</div>
          )}
        </div>
      </div>

      {deal.errors.length > 0 && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {deal.errors[0].explanation}
          {deal.errors.length > 1 && ` (+${deal.errors.length - 1} алдаа)`}
        </div>
      )}

      {deal.salesNo && (
        <div className="mt-2 truncate font-mono text-xs text-stone-400">
          {deal.salesNo}
        </div>
      )}

      <ol className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
        {deal.events.slice(0, 8).map((ev, i) => {
          const isInternal = KOREAN_RE.test(ev.detail ?? "");
          return (
            <li key={`${ev.entryId}-${i}`} className="flex items-baseline gap-2 text-sm">
              <span className="w-16 shrink-0 font-mono text-xs text-stone-400">
                {ev.time.slice(0, 8)}
              </span>
              <span
                className={[
                  "inline-flex h-4 w-4 shrink-0 translate-y-0.5 items-center justify-center rounded-full text-[9px]",
                  ev.isError ? "bg-red-100 text-red-700" : eventIconColor(ev.kind),
                ].join(" ")}
              >
                {eventIcon(ev.kind)}
              </span>
              <span
                className={
                  ev.isError
                    ? "font-medium text-red-700"
                    : isInternal
                      ? "text-stone-400"
                      : "text-stone-700"
                }
              >
                {ev.title}
                {ev.detail && (
                  <span className={isInternal ? "ml-1 text-stone-300" : "ml-1 text-stone-500"}>
                    — {isInternal ? "(системийн дотоод мессеж)" : ev.detail}
                  </span>
                )}
              </span>
            </li>
          );
        })}
        {deal.events.length > 8 && (
          <li className="text-xs text-stone-400">
            +{deal.events.length - 8} алхам — дарж дэлгэрэнгүй үзнэ үү
          </li>
        )}
      </ol>
    </button>
  );
}
