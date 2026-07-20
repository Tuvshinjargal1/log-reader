"use client";

import { Fragment } from "react";
import type { Deal } from "@/lib/types";
import { DealCard } from "./DealCard";
import { DealDetail } from "./DealDetail";

interface DealTimelineProps {
  deals: Deal[];
  selectedId: string | null;
  onSelect: (deal: Deal | null) => void;
  onShowRawLog: (deal: Deal) => void;
}

export function DealTimeline({
  deals,
  selectedId,
  onSelect,
  onShowRawLog,
}: DealTimelineProps) {
  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-sm text-stone-500">
        Энэ файлд «Deal Start» олдсонгүй. Доорх дэлгэрэнгүй лог хэсгээс үзнэ үү.
      </div>
    );
  }

  const selectedDeal = deals.find((d) => d.id === selectedId) ?? null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">
          Борлуулалтын түүх
          <span className="ml-2 text-sm font-normal text-stone-500">
            ({deals.length})
          </span>
        </h2>
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
      <p className="mb-4 text-sm text-stone-500">
        Карт дээр дарж борлуулалтын дэлгэрэнгүйг (сагс, төлбөр, баримт) үзнэ.
      </p>
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {deals.map((deal) => (
          <Fragment key={deal.id}>
            <DealCard
              deal={deal}
              selected={deal.id === selectedId}
              onSelect={(d) => onSelect(d.id === selectedId ? null : d)}
            />
            {deal.id === selectedId && selectedDeal && (
              <div className="lg:col-span-2">
                <DealDetail deal={selectedDeal} onShowRawLog={onShowRawLog} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
