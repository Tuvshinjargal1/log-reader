"use client";

import { useMemo, useState } from "react";
import type { FlowKind, StoreFlow } from "@/lib/diagram/model";
import { layoutFlow } from "@/lib/diagram/layout";

interface DecisionDiagramProps {
  flow: StoreFlow;
  selectedCategory: string | null;
  onSelectCategory: (key: string | null) => void;
}

const KIND_FILL: Record<FlowKind, string> = {
  demand: "#0d9488", // teal-600
  safety: "#f59e0b", // amber-500
  orderup: "#0f766e", // teal-700
  inventory: "#0284c7", // sky-600
  raw: "#78716c", // stone-500
  final: "#059669", // emerald-600
  mode: "#4f46e5", // indigo-600
};

export function DecisionDiagram({
  flow,
  selectedCategory,
  onSelectCategory,
}: DecisionDiagramProps) {
  const layout = useMemo(() => layoutFlow(flow), [flow]);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const active = layout.nodes.find((n) => n.id === activeNode) ?? null;
  const maxCatQty = Math.max(...flow.categories.map((c) => c.qty), 1);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-2">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="h-auto w-full min-w-[760px]"
          role="img"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a8a29e" />
            </marker>
          </defs>

          {/* Ирмэгүүд */}
          {layout.edges.map((e, i) => (
            <g key={i}>
              <path
                d={e.path}
                fill="none"
                stroke={e.sign === "sub" ? "#f43f5e" : "#cbd5e1"}
                strokeWidth={e.width}
                strokeOpacity={0.55}
                markerEnd="url(#arrow)"
              />
            </g>
          ))}

          {/* Зангилаанууд */}
          {layout.nodes.map((n) => {
            const isActive = n.id === activeNode;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onClick={() => setActiveNode(isActive ? null : n.id)}
                className="cursor-pointer"
              >
                <rect
                  width={n.w}
                  height={n.h}
                  rx={10}
                  fill={KIND_FILL[n.kind]}
                  opacity={isActive ? 1 : 0.92}
                  stroke={isActive ? "#0f172a" : "transparent"}
                  strokeWidth={2}
                />
                <text
                  x={n.w / 2}
                  y={24}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="#fff"
                >
                  {n.label}
                </text>
                <text
                  x={n.w / 2}
                  y={48}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={800}
                  fill="#fff"
                >
                  {n.kind === "mode"
                    ? ""
                    : n.value.toLocaleString("mn-MN")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Зангилааны тайлбар */}
      {active && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
          <div className="font-semibold text-stone-800">{active.label}</div>
          <div className="mt-0.5 text-stone-600">{active.detail}</div>
          {active.kind !== "mode" && (
            <div className="mt-1 tabular-nums text-stone-500">
              Утга: <b className="text-stone-800">{active.value.toLocaleString("mn-MN")}</b>
            </div>
          )}
        </div>
      )}

      {/* Ангиллын зурвас — дарж бараа руу орно */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-stone-700">
            Ангиллаар ({flow.categories.length})
          </h4>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="text-xs text-teal-700 hover:underline"
            >
              Шүүлт цуцлах
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {flow.categories.map((c) => {
            const active = c.key === selectedCategory;
            const intensity = 0.15 + (c.qty / maxCatQty) * 0.7;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelectCategory(active ? null : c.key)}
                className={[
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-teal-600 ring-1 ring-teal-500"
                    : "border-stone-200 hover:border-stone-300",
                ].join(" ")}
                style={{ background: `rgba(13,148,136,${intensity.toFixed(2)})` }}
              >
                <div
                  className="text-sm font-semibold"
                  style={{ color: intensity > 0.5 ? "#fff" : "#292524" }}
                >
                  {c.name}
                </div>
                <div
                  className="text-xs tabular-nums"
                  style={{ color: intensity > 0.5 ? "rgba(255,255,255,.85)" : "#78716c" }}
                >
                  {c.qty.toLocaleString("mn-MN")} ширхэг · {c.lineCount} бараа
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
