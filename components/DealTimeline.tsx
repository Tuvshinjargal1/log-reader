"use client";

import { useMemo } from "react";
import type { CustomerTag, Deal } from "@/lib/types";
import { customerTagLabel } from "@/lib/extractCustomer";
import { DealCard } from "./DealCard";
import { DealDetail } from "./DealDetail";

interface DealTimelineProps {
  deals: Deal[];
  selectedId: string | null;
  dateFilter: string | null;
  hourFilter: string | null;
  customerFilter: CustomerTag | null;
  onDateFilter: (date: string | null) => void;
  onHourFilter: (hour: string | null) => void;
  onCustomerFilter: (tag: CustomerTag | null) => void;
  onSelect: (deal: Deal | null) => void;
  onShowRawLog: (deal: Deal) => void;
}

const FILTER_TAGS: CustomerTag[] = [
  "lms",
  "app",
  "voucher",
  "coupon",
  "points",
  "guest",
];

function shortDate(date: string): string {
  // 2026-07-20 → 07-20
  const parts = date.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : date;
}

export function DealTimeline({
  deals,
  selectedId,
  dateFilter,
  hourFilter,
  customerFilter,
  onDateFilter,
  onHourFilter,
  onCustomerFilter,
  onSelect,
  onShowRawLog,
}: DealTimelineProps) {
  const dates = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      if (!d.date) continue;
      map.set(d.date, (map.get(d.date) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deals]);

  const dealsForHourChips = useMemo(() => {
    if (!dateFilter) return deals;
    return deals.filter((d) => d.date === dateFilter);
  }, [deals, dateFilter]);

  const hours = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dealsForHourChips) {
      const h = d.startTime.slice(0, 2);
      map.set(h, (map.get(h) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dealsForHourChips]);

  const tagCounts = useMemo(() => {
    const map = new Map<CustomerTag, number>();
    for (const tag of FILTER_TAGS) map.set(tag, 0);
    for (const d of deals) {
      for (const tag of d.customer.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return map;
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (dateFilter && d.date !== dateFilter) return false;
      if (hourFilter && d.startTime.slice(0, 2) !== hourFilter) return false;
      if (customerFilter && !d.customer.tags.includes(customerFilter)) {
        return false;
      }
      return true;
    });
  }, [deals, dateFilter, hourFilter, customerFilter]);

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-sm text-stone-500">
        Энэ файлд «Deal Start» олдсонгүй. «Дэлгэрэнгүй лог» табаас үзнэ үү.
      </div>
    );
  }

  const selectedDeal = filtered.find((d) => d.id === selectedId) ?? null;
  const hasActiveFilter =
    dateFilter != null || hourFilter != null || customerFilter != null;

  return (
    <section className="space-y-3">
      {/* Date filter */}
      {dates.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Өдрөөр шүүх
            </span>
            {dateFilter && (
              <button
                type="button"
                onClick={() => {
                  onDateFilter(null);
                  onHourFilter(null);
                }}
                className="text-xs text-teal-700 hover:underline"
              >
                Бүгдийг харах
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="Бүгд"
              count={deals.length}
              active={dateFilter === null}
              onClick={() => {
                onDateFilter(null);
                onHourFilter(null);
              }}
            />
            {dates.map(([date, count]) => (
              <FilterChip
                key={date}
                label={shortDate(date)}
                title={date}
                count={count}
                active={dateFilter === date}
                onClick={() => {
                  if (dateFilter === date) {
                    onDateFilter(null);
                    onHourFilter(null);
                  } else {
                    onDateFilter(date);
                    onHourFilter(null);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Customer type filter */}
      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Хэрэглэгчийн төрөл
          </span>
          {customerFilter && (
            <button
              type="button"
              onClick={() => onCustomerFilter(null)}
              className="text-xs text-teal-700 hover:underline"
            >
              Цуцлах
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Бүгд"
            count={deals.length}
            active={customerFilter === null}
            onClick={() => onCustomerFilter(null)}
          />
          {FILTER_TAGS.map((tag) => {
            const count = tagCounts.get(tag) ?? 0;
            if (count === 0 && tag !== "guest" && tag !== "lms") return null;
            return (
              <FilterChip
                key={tag}
                label={customerTagLabel(tag)}
                count={count}
                active={customerFilter === tag}
                accent={tag}
                onClick={() =>
                  onCustomerFilter(customerFilter === tag ? null : tag)
                }
              />
            );
          })}
        </div>
      </div>

      {/* Hour filter chips — scoped to selected day when dateFilter set */}
      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Цагаар шүүх
            {dateFilter && (
              <span className="ml-1 font-normal normal-case text-stone-400">
                ({shortDate(dateFilter)})
              </span>
            )}
          </span>
          {hourFilter && (
            <button
              type="button"
              onClick={() => onHourFilter(null)}
              className="text-xs text-teal-700 hover:underline"
            >
              Бүгдийг харах
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Бүгд"
            count={dealsForHourChips.length}
            active={hourFilter === null}
            onClick={() => onHourFilter(null)}
          />
          {hours.map(([hour, count]) => (
            <FilterChip
              key={hour}
              label={`${hour}:00`}
              count={count}
              active={hourFilter === hour}
              onClick={() =>
                onHourFilter(hourFilter === hour ? null : hour)
              }
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {hasActiveFilter
            ? `${filtered.length} борлуулалт олдлоо`
            : "Карт дээр дарж сагс, төлбөр, баримтыг үзнэ."}
        </p>
        {selectedId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-sm text-teal-700 hover:underline"
          >
            Хаах
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-sm text-stone-500">
          Шүүлтүүрт тохирох борлуулалт олдсонгүй.
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {filtered.map((deal) => (
            <div key={deal.id} className="space-y-3">
              <DealCard
                deal={deal}
                selected={deal.id === selectedId}
                onSelect={(d) => onSelect(d.id === selectedId ? null : d)}
              />
              {deal.id === selectedId && selectedDeal && (
                <DealDetail deal={selectedDeal} onShowRawLog={onShowRawLog} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  accent,
  title,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accent?: CustomerTag;
  title?: string;
}) {
  const accentClass =
    !active && accent
      ? {
          lms: "bg-indigo-50 text-indigo-800",
          app: "bg-sky-50 text-sky-800",
          voucher: "bg-amber-50 text-amber-800",
          coupon: "bg-fuchsia-50 text-fuchsia-800",
          points: "bg-emerald-50 text-emerald-800",
          guest: "bg-stone-100 text-stone-700",
        }[accent]
      : null;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors",
        active
          ? "bg-teal-600 text-white"
          : accentClass ?? "bg-stone-100 text-stone-700 hover:bg-stone-200",
        !active && accentClass ? "hover:opacity-80" : "",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>
      <span
        className={[
          "rounded-full px-1.5 text-xs tabular-nums",
          active ? "bg-white/20" : "bg-white/80 text-stone-500",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
