"use client";

/**
 * "Яагаад ийм тоо гарсан бэ?" — engine-ийн тооцооллын 6 мөр.
 *
 * `DecisionDiagram`-ыг ЗОРИУД хэрэглээгүй: тэр SVG нь `min-w-[760px]` тул
 * 660px өргөнтэй хавтас дотор хэвтээ гүйлгэх зурвас гаргана. Гэхдээ тоог
 * ижил эх сурвалжаас — одоо байгаа PURE `buildStoreFlow()`-оос авна, тул
 * диаграм ба энэ хоёр хэзээ ч зөрөхгүй.
 */
import { useMemo } from "react";
import type { OrderLine } from "@/lib/db/repositories/orders";
import type { OrderMode } from "@/lib/config/types";
import { buildStoreFlow } from "@/lib/diagram/model";

export function MiniDecisionMath({
  lines,
  mode,
}: {
  lines: OrderLine[];
  mode: OrderMode;
}) {
  const flow = useMemo(() => buildStoreFlow(lines, mode), [lines, mode]);
  const t = flow.totals;

  const rows: { label: string; value: number; kind: "add" | "sub" | "sum" | "final" }[] = [
    { label: "Прогноз эрэлт (хамгаалалтын цонх)", value: t.forecastDemand, kind: "add" },
    { label: "+ Аюулгүйн нөөц", value: t.safetyStock, kind: "add" },
    { label: "= Захиалах түвшин S", value: t.orderUpTo, kind: "sum" },
    { label: "− Одоогийн нөөц (IP)", value: t.inventoryPosition, kind: "sub" },
    { label: "= Түүхий захиалга", value: t.rawQty, kind: "sum" },
    { label: "→ Эцсийн захиалга", value: t.suggested, kind: "final" },
  ];

  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5">
      <h4 className="text-sm font-semibold text-stone-800">Яагаад ийм тоо гарсан бэ?</h4>
      <div className="mt-2.5 space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span
              className={
                r.kind === "final"
                  ? "w-56 shrink-0 text-xs font-semibold text-stone-800"
                  : "w-56 shrink-0 text-xs text-stone-500"
              }
            >
              {r.label}
            </span>
            <span className="h-2 flex-1 rounded-full bg-stone-100">
              <span
                className={
                  r.kind === "sub"
                    ? "block h-2 rounded-full bg-rose-400"
                    : r.kind === "final"
                      ? "block h-2 rounded-full bg-teal-600"
                      : "block h-2 rounded-full bg-teal-300"
                }
                style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }}
              />
            </span>
            <span
              className={
                r.kind === "final"
                  ? "w-16 shrink-0 text-right text-sm font-bold tabular-nums text-stone-900"
                  : "w-16 shrink-0 text-right text-sm tabular-nums text-stone-700"
              }
            >
              {Math.round(r.value).toLocaleString("mn-MN")}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-stone-400">
        {t.lineCount} барааны нийлбэр. Бараа тус бүрийн задаргааг доорх жагсаалтын «Яагаад?»
        товчноос харна.
      </p>
    </div>
  );
}
