"use client";

import type { CustomerTag, Deal } from "@/lib/types";
import { customerTagLabel } from "@/lib/extractCustomer";
import { formatAmount, formatDuration } from "@/lib/labels.mn";

interface DealCardProps {
  deal: Deal;
  selected: boolean;
  onSelect: (deal: Deal) => void;
}

const TAG_STYLE: Record<CustomerTag, string> = {
  lms: "bg-indigo-100 text-indigo-800",
  app: "bg-sky-100 text-sky-800",
  voucher: "bg-amber-100 text-amber-800",
  coupon: "bg-fuchsia-100 text-fuchsia-800",
  points: "bg-emerald-100 text-emerald-800",
  guest: "bg-stone-100 text-stone-500",
};

export function DealCard({ deal, selected, onSelect }: DealCardProps) {
  const itemCount = deal.basket.reduce((s, i) => s + i.qty, 0);
  const displayTags = deal.customer.tags.filter((t) => t !== "guest");

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
        <div className="min-w-0">
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
            {displayTags.map((tag) => (
              <span
                key={tag}
                className={[
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  TAG_STYLE[tag],
                ].join(" ")}
              >
                {customerTagLabel(tag)}
              </span>
            ))}
          </div>
          <div className="mt-1 text-sm text-stone-500">
            {deal.date ? `${deal.date} · ` : ""}
            {deal.startTime.slice(0, 8)} → {deal.endTime.slice(0, 8)}
            <span className="ml-2">({formatDuration(deal.durationMs)})</span>
          </div>
          {(deal.customer.name || deal.customer.phone) && (
            <div className="mt-1 text-sm text-stone-600">
              {deal.customer.name ?? "Хэрэглэгч"}
              {deal.customer.phone && (
                <span className="ml-1 font-mono text-xs text-stone-400">
                  {deal.customer.phone}
                </span>
              )}
            </div>
          )}
          {deal.salesNo && (
            <div className="mt-1 truncate font-mono text-xs text-stone-400">
              {deal.salesNo}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-sm">
          {deal.amount != null && (
            <div className="font-semibold tabular-nums text-stone-800">
              {formatAmount(deal.amount)}
            </div>
          )}
          {deal.paymentMethod && (
            <div className="text-stone-500">{deal.paymentMethod}</div>
          )}
          <div className="mt-1 text-xs text-teal-700">
            {selected ? "Дэлгэрэнгүй ▾" : "Дэлгэрэнгүй ▸"}
          </div>
        </div>
      </div>

      {deal.errors.length > 0 && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {deal.errors[0].explanation}
          {deal.errors.length > 1 && ` (+${deal.errors.length - 1} алдаа)`}
        </div>
      )}
    </button>
  );
}
