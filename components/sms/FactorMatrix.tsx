"use client";

import type { FleetStore } from "@/lib/replenish/fleet";
import {
  divergingColor,
  needsLightText,
  sequentialColor,
  STATUS_COLOR,
} from "@/lib/diagram/colors";

interface FactorMatrixProps {
  stores: FleetStore[];
  onSelect: (id: number) => void;
}

type Col = {
  key: keyof FleetStore["factorBars"];
  label: string;
  kind: "diverging" | "sequential";
  hint: string;
};

const COLS: Col[] = [
  { key: "dow", label: "Гараг", kind: "diverging", hint: "Долоо хоногийн өдрийн нөлөө" },
  { key: "trend", label: "Трэнд", kind: "diverging", hint: "Сүүлийн үеийн өсөлт/бууралт" },
  { key: "season", label: "Улирал", kind: "diverging", hint: "Баяр/цалин/улирлын нөлөө" },
  { key: "safety", label: "Аюулгүй нөөц", kind: "sequential", hint: "Захиалгад эзлэх аюулгүйн нөөцийн хувь" },
  { key: "stockCoverage", label: "Нөөц хангамж", kind: "sequential", hint: "Одоогийн нөөцийн хүрэлцээ" },
  { key: "confidence", label: "Итгэлцэл", kind: "sequential", hint: "Прогнозын найдвартай байдал" },
];

function cellColor(col: Col, v: number): string {
  return col.kind === "diverging" ? divergingColor(v) : sequentialColor(v);
}

export function FactorMatrix({ stores, onSelect }: FactorMatrixProps) {
  if (stores.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-800">
          Шийдвэрт нөлөөлж буй хүчин зүйлсийн матриц
        </h3>
        <p className="text-xs text-stone-500">
          Дэлгүүр бүрийн захиалгыг ямар хүчин зүйл хэрхэн өсгөж/бууруулж байгааг
          нэг харцаар. Мөр дээр дарж дэлгүүр рүү орно.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-stone-50 text-xs text-stone-500">
              <th className="px-3 py-2 text-left font-medium">Дэлгүүр</th>
              <th className="px-2 py-2 text-center font-medium">Горим</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center font-medium" title={c.hint}>
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Захиалга</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="cursor-pointer border-t border-stone-100 hover:bg-stone-50/70"
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[s.status] }}
                    />
                    <span className="truncate font-medium text-stone-800">
                      {s.name}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span
                    className={[
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      s.mode === "auto"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800",
                    ].join(" ")}
                  >
                    {s.mode === "auto" ? "АВТО" : "ГАР"}
                  </span>
                </td>
                {COLS.map((c) => {
                  const v = s.factorBars[c.key];
                  const bg = cellColor(c, v);
                  return (
                    <td key={c.key} className="p-0.5">
                      <div
                        className="flex h-8 items-center justify-center rounded text-[11px] tabular-nums"
                        style={{
                          background: bg,
                          color: needsLightText(v) ? "#fff" : "#44403c",
                        }}
                        title={`${c.label}: ${v.toFixed(2)}`}
                      >
                        {c.kind === "diverging"
                          ? (v > 0 ? "+" : "") + (v * 100).toFixed(0)
                          : (v * 100).toFixed(0)}
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                  {s.order ? s.order.totalQty.toLocaleString("mn-MN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
