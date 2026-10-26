"use client";

import type { FleetAnalytics } from "@/lib/replenish/analytics";
import { formatAmount } from "@/lib/labels.mn";

interface KpiPanelProps {
  data: FleetAnalytics;
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

export function KpiPanel({ data }: KpiPanelProps) {
  const f = data.fleet;
  const fillDelta = f.engineFillRate - f.baselineFillRate;

  return (
    <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-base font-bold text-stone-900">
          Гүйцэтгэлийн тайлан (backtest нотолгоо)
        </h3>
        <p className="text-sm text-stone-500">
          Түүхэн борлуулалт дээр систем (R,S engine) vs энгийн cover томьёог
          харьцуулав. {f.storeCount} дэлгүүр, {f.itemsAnalyzed} бараа шинжлэв.
        </p>
      </div>

      {/* AUTO-vs-baseline нотолгоо */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ProofCard
          label="Нөхөлт (fill rate)"
          engine={pct(f.engineFillRate)}
          baseline={pct(f.baselineFillRate)}
          delta={(fillDelta >= 0 ? "+" : "") + (fillDelta * 100).toFixed(1) + "н.э"}
          positive={fillDelta >= 0}
        />
        <StatCard
          label="Алдагдсан борлуулалт хэмнэсэн"
          value={formatAmount(Math.round(f.lostSalesAvoided))}
          tone={f.lostSalesAvoided >= 0 ? "ok" : "warn"}
        />
        <StatCard
          label="Илүүдэл нөөц бууруулсан"
          value={formatAmount(Math.round(f.overstockReduced))}
          tone={f.overstockReduced >= 0 ? "ok" : "warn"}
        />
        <StatCard
          label="Хаягдал %"
          value={f.wastePct != null ? pct(f.wastePct) : "—"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Нийт борлуулалт (GMV)" value={formatAmount(Math.round(f.gmv))} />
        <div className="rounded-xl border border-stone-200 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Барааны эрүүл мэнд
          </div>
          <div className="mt-2 flex items-center gap-2">
            <HealthPill label="Сайн" count={f.health.good} color="#059669" />
            <HealthPill label="Ажиглах" count={f.health.watch} color="#d97706" />
            <HealthPill label="Муу" count={f.health.poor} color="#dc2626" />
          </div>
        </div>
        <StatCard
          label="Систем давуу тал"
          value={fillDelta >= 0 ? "Тийм ✓" : "Шалгах"}
          tone={fillDelta >= 0 ? "ok" : "warn"}
        />
      </div>

      {/* Дэлгүүрээр */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Дэлгүүр</th>
              <th className="px-3 py-2 text-right font-medium">Бараа</th>
              <th className="px-3 py-2 text-right font-medium">Fill (engine/base)</th>
              <th className="px-3 py-2 text-right font-medium">Хэмнэсэн ₮</th>
              <th className="px-3 py-2 text-right font-medium">Хаягдал%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {data.stores.map((s) => (
              <tr key={s.storeId} className="hover:bg-stone-50/70">
                <td className="px-3 py-1.5 font-medium text-stone-800">{s.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-600">
                  {s.kpi.itemsAnalyzed}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-600">
                  {pct(s.kpi.engineFillRate)} /{" "}
                  <span className="text-stone-400">{pct(s.kpi.baselineFillRate)}</span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700">
                  {Math.round(s.kpi.lostSalesAvoided + s.kpi.overstockReduced).toLocaleString("mn-MN")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-600">
                  {s.kpi.wastePct != null ? pct(s.kpi.wastePct) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProofCard({
  label,
  engine,
  baseline,
  delta,
  positive,
}: {
  label: string;
  engine: string;
  baseline: string;
  delta: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tabular-nums text-teal-700">{engine}</span>
        <span className="text-xs text-stone-400 line-through">{baseline}</span>
      </div>
      <div
        className={[
          "mt-0.5 text-xs font-semibold",
          positive ? "text-emerald-600" : "text-amber-600",
        ].join(" ")}
      >
        {delta}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-lg font-bold tabular-nums",
          tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-stone-900",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function HealthPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <b className="tabular-nums">{count}</b>
      <span className="text-xs text-stone-400">{label}</span>
    </span>
  );
}
