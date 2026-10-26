"use client";

import { useMemo, useState } from "react";
import type { OrderLine, OrderWithLines } from "@/lib/db/repositories/orders";
import type { DecisionFactors } from "@/lib/engine/types";
import type { ResolvedConfig } from "@/lib/config/types";
import { LAYER_LABEL } from "@/lib/config/effective";
import { formatAmount } from "@/lib/labels.mn";

interface OrderEditorProps {
  order: OrderWithLines;
  filterCategory: string | null;
  busy?: boolean;
  onEditQty: (lineId: number, qty: number) => void;
}

interface Group {
  key: string;
  name: string;
  lines: OrderLine[];
  qty: number;
}

export function OrderEditor({
  order,
  filterCategory,
  busy,
  onEditQty,
}: OrderEditorProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const l of order.lines) {
      if (filterCategory && (l.categoryKey ?? "_none") !== filterCategory) continue;
      const key = l.categoryKey ?? "_none";
      const g = map.get(key);
      if (g) {
        g.lines.push(l);
        g.qty += l.finalQty;
      } else {
        map.set(key, {
          key,
          name: l.categoryNm ?? "Ангилалгүй",
          lines: [l],
          qty: l.finalQty,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [order.lines, filterCategory]);

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
        Захиалах бараа алга.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section
          key={g.key}
          className="overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2">
            <h4 className="text-sm font-semibold text-stone-800">{g.name}</h4>
            <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-900">
              {g.qty.toLocaleString("mn-MN")} ширхэг
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {g.lines.map((l) => {
              const isOpen = expanded === l.id;
              const edited = l.decidedBy === "manual";
              return (
                <div key={l.id}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-stone-900">
                        {l.name}
                      </div>
                      <div className="font-mono text-xs text-stone-400">
                        {l.itemCd}
                        {l.price != null && (
                          <span className="ml-2 text-stone-400">
                            {formatAmount(l.price)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs text-stone-500">
                      <div className="uppercase tracking-wide">Санал</div>
                      <div className="tabular-nums text-stone-700">
                        {l.suggestedQty.toLocaleString("mn-MN")}
                      </div>
                    </div>

                    <div className="text-right">
                      <label className="block text-[10px] uppercase tracking-wide text-stone-400">
                        Захиалах
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={l.finalQty}
                        disabled={busy}
                        onChange={(e) => onEditQty(l.id, Math.max(0, Number(e.target.value)))}
                        className={[
                          "w-20 rounded-lg border px-2 py-1 text-right text-sm tabular-nums focus:outline-none",
                          edited
                            ? "border-amber-400 bg-amber-50 text-amber-900"
                            : "border-stone-300 focus:border-teal-500",
                        ].join(" ")}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : l.id)}
                      className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50"
                    >
                      {isOpen ? "Хаах" : "Яагаад?"}
                    </button>
                  </div>

                  {isOpen && (
                    <FactorDetail
                      factors={l.factorsSnapshot as DecisionFactors | null}
                      config={l.configSnapshot as ResolvedConfig | null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function num(n: number, digits = 1): string {
  return n.toLocaleString("mn-MN", { maximumFractionDigits: digits });
}

function FactorDetail({
  factors,
  config,
}: {
  factors: DecisionFactors | null;
  config: ResolvedConfig | null;
}) {
  if (!factors) {
    return (
      <div className="bg-stone-50 px-4 py-3 text-xs text-stone-500">
        Тооцооны дэлгэрэнгүй алга.
      </div>
    );
  }
  const rows: { label: string; value: string }[] = [
    { label: "Суурь өдрийн эрэлт (μ)", value: num(factors.baseDailyDemand) },
    { label: "Гараг хүчин зүйл (дундаж)", value: "×" + num(factors.dowFactorAvg, 2) },
    { label: "Трэнд", value: "×" + num(factors.trend, 2) },
    { label: "Улирал/баяр", value: "×" + num(factors.seasonFactorAvg, 2) },
    { label: `Прогноз эрэлт (${factors.protectionDays} хоног)`, value: num(factors.forecastDemand) },
    {
      label: `Аюулгүйн нөөц (z=${num(factors.z, 2)}, σ=${num(factors.demandStdDev)})`,
      value: num(factors.safetyStock),
    },
    { label: "Захиалах түвшин S", value: num(factors.orderUpTo) },
    {
      label: `Одоогийн нөөц (байгаа ${num(factors.onHand)} + замд ${num(factors.onOrder)})`,
      value: num(factors.inventoryPosition),
    },
    { label: "Түүхий захиалга (S − IP)", value: num(factors.rawQty) },
    ...(factors.shelfLifeCap != null
      ? [{ label: "Хугацааны хязгаар (shelf-life)", value: num(factors.shelfLifeCap) }]
      : []),
    {
      label: `Дугуйруулалт (×${factors.orderMultiple})`,
      value: num(factors.afterRounding, 0),
    },
    { label: "Эцсийн захиалга", value: num(factors.suggestedQty, 0) },
  ];

  return (
    <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
      <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-stone-500">{r.label}</span>
            <span className="tabular-nums font-medium text-stone-800">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-stone-200 pt-2">
        <span className="text-[10px] uppercase tracking-wide text-stone-400">
          Итгэлцэл {(factors.confidence * 100).toFixed(0)}%
        </span>
        {factors.lowConfidence && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            Итгэлцэл бага
          </span>
        )}
        {config &&
          (["coverDays", "serviceLevel", "orderMultiple", "mode"] as const).map(
            (k) => {
              const layer = config.sources[k];
              if (!layer) return null;
              return (
                <span
                  key={k}
                  className="rounded bg-white px-1.5 py-0.5 text-[10px] text-stone-600 ring-1 ring-stone-200"
                  title={`${k} — ${LAYER_LABEL[layer]} түвшинд тохируулсан`}
                >
                  {k}={String(config.value[k])} · {LAYER_LABEL[layer]}
                </span>
              );
            },
          )}
      </div>
    </div>
  );
}
