"use client";

import { useState } from "react";
import type { ItemAnalysis, StoreAnalysis } from "@/lib/replenish/analytics";
import type { TuneRecommendation } from "@/lib/engine";
import { RECOMMENDATION_LABEL } from "@/lib/engine";
import { SeasonalityChart } from "./SeasonalityChart";
import { formatAmount } from "@/lib/labels.mn";

export interface ApplyTuneArgs {
  scope: "item";
  scopeKey: string;
  param: TuneRecommendation["param"];
  from: number;
  to: number;
  reason: string;
}

interface StorePerformanceProps {
  analysis: StoreAnalysis;
  busy?: boolean;
  onApplyTune: (args: ApplyTuneArgs) => void;
}

const GRADE_COLOR: Record<string, string> = {
  good: "#059669",
  watch: "#d97706",
  poor: "#dc2626",
};

function pct(v: number): string {
  return (v * 100).toFixed(0) + "%";
}

export function StorePerformance({ analysis, busy, onApplyTune }: StorePerformanceProps) {
  const k = analysis.kpi;
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? analysis.items : analysis.items.slice(0, 20);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Нөхөлт (engine)" value={pct(k.engineFillRate)} sub={`энгийн: ${pct(k.baselineFillRate)}`} />
        <Kpi
          label="Алдагдал хэмнэсэн"
          value={formatAmount(Math.round(k.lostSalesAvoided))}
          tone="ok"
        />
        <Kpi
          label="Илүүдэл бууруулсан"
          value={formatAmount(Math.round(k.overstockReduced))}
          tone="ok"
        />
        <Kpi label="Хаягдал %" value={k.wastePct != null ? pct(k.wastePct) : "—"} />
      </section>

      <SeasonalityChart dow={analysis.seasonality.dow} />

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h4 className="text-sm font-semibold text-stone-800">
            Барааны гүйцэтгэл ({analysis.items.length})
          </h4>
          <span className="text-xs text-stone-400">Муу эрүүл мэнд эхэнд</span>
        </div>
        <div className="divide-y divide-stone-100">
          {items.map((it) => (
            <ItemRow key={it.itemCd} item={it} busy={busy} onApplyTune={onApplyTune} />
          ))}
        </div>
        {analysis.items.length > 20 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full border-t border-stone-100 py-2 text-sm text-teal-700 hover:bg-stone-50"
          >
            {showAll ? "Хураах" : `Бүгдийг харах (${analysis.items.length})`}
          </button>
        )}
      </section>
    </div>
  );
}

function ItemRow({
  item,
  busy,
  onApplyTune,
}: {
  item: ItemAnalysis;
  busy?: boolean;
  onApplyTune: (args: ApplyTuneArgs) => void;
}) {
  const bt = item.backtest;
  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: GRADE_COLOR[item.health.grade] }}
          title={`Эрүүл мэнд: ${item.health.score}/100`}
        >
          {item.health.score}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-stone-900">{item.name}</div>
          <div className="text-xs text-stone-500">
            {item.categoryNm} · {RECOMMENDATION_LABEL[item.health.recommendation]}
          </div>
        </div>
        <div className="text-right text-xs text-stone-500">
          <div>
            Нөхөлт{" "}
            <b className="tabular-nums text-stone-700">{pct(bt.engine.fillRate)}</b>
            <span className="text-stone-400"> / {pct(bt.baseline.fillRate)}</span>
          </div>
          <div className="tabular-nums text-emerald-700">
            +{Math.round(bt.lostSalesAvoided + bt.overstockReduced).toLocaleString("mn-MN")}₮
          </div>
        </div>
      </div>

      {item.tuning.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.tuning.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs"
            >
              <span className="text-amber-800">
                {t.param === "serviceLevel" ? "Үйлчилгээ" : "Cover"}{" "}
                {t.from} → <b>{t.to}</b>
                <span className="ml-1 text-amber-600">({t.reason})</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onApplyTune({
                    scope: "item",
                    scopeKey: item.itemCd,
                    param: t.param,
                    from: t.from,
                    to: t.to,
                    reason: t.reason,
                  })
                }
                className="rounded bg-amber-600 px-2 py-0.5 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Батлах
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok";
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div
        className={[
          "mt-1 text-lg font-bold tabular-nums",
          tone === "ok" ? "text-emerald-600" : "text-stone-900",
        ].join(" ")}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
    </div>
  );
}
