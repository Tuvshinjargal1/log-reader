"use client";

import { useMemo } from "react";
import type { Deal } from "@/lib/types";
import { DealCard } from "./DealCard";
import { DealDetail } from "./DealDetail";

interface DealTimelineProps {
  deals: Deal[];
  selectedId: string | null;
  hourFilter: string | null;
  onHourFilter: (hour: string | null) => void;
  onSelect: (deal: Deal | null) => void;
  onShowRawLog: (deal: Deal) => void;
}

export function DealTimeline({
  deals,
  selectedId,
  hourFilter,
  onHourFilter,
  onSelect,
  onShowRawLog,
}: DealTimelineProps) {
  const hours = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const h = d.startTime.slice(0, 2);
      map.set(h, (map.get(h) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deals]);

  const filtered = useMemo(() => {
    if (!hourFilter) return deals;
    return deals.filter((d) => d.startTime.slice(0, 2) === hourFilter);
  }, [deals, hourFilter]);

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-sm text-stone-500">
        Энэ файлд «Deal Start» олдсонгүй. «Дэлгэрэнгүй лог» табаас үзнэ үү.
      </div>
    );
  }

  const selectedDeal = filtered.find((d) => d.id === selectedId) ?? null;

  return (
    <section className="space-y-3">
      {/* Hour filter chips */}
      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Цагаар шүүх
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
          <HourChip
            label="Бүгд"
            count={deals.length}
            active={hourFilter === null}
            onClick={() => onHourFilter(null)}
          />
          {hours.map(([hour, count]) => (
            <HourChip
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
          {hourFilter
            ? `${hourFilter}:00 цагийн ${filtered.length} борлуулалт`
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
          Энэ цагт борлуулалт олдсонгүй.
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

function HourChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors",
        active
          ? "bg-teal-600 text-white"
          : "bg-stone-100 text-stone-700 hover:bg-stone-200",
      ].join(" ")}
    >
      <span className="font-medium">{label}</span>
      <span
        className={[
          "rounded-full px-1.5 text-xs tabular-nums",
          active ? "bg-white/20" : "bg-white text-stone-500",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
