"use client";

import { useMemo } from "react";
import type { Deal } from "@/lib/types";
import { formatAmount } from "@/lib/labels.mn";

interface OverviewStatsProps {
  deals: Deal[];
  hourFilter: string | null;
  onSelectHour: (hour: string) => void;
  onSelectDeal: (deal: Deal) => void;
}

export function OverviewStats({
  deals,
  hourFilter,
  onSelectHour,
  onSelectDeal,
}: OverviewStatsProps) {
  const hourly = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const hour = d.startTime.slice(0, 2);
      map.set(hour, (map.get(hour) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deals]);

  const payments = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const d of deals) {
      const key = d.paymentMethod ?? "Тодорхойгүй";
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += d.amount ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [deals]);

  const errorDeals = useMemo(
    () => deals.filter((d) => d.errors.length > 0),
    [deals],
  );

  if (deals.length === 0) return null;

  const maxHourly = Math.max(...hourly.map(([, c]) => c), 1);

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {/* Hourly activity — clickable filter */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Цаг тутмын борлуулалт
        </h3>
        <p className="mb-3 text-xs text-stone-400">
          Цаг дээр дарж тухайн цагийн борлуулалтыг шүүнэ
        </p>
        <div className="space-y-1">
          {hourly.map(([hour, count]) => {
            const active = hourFilter === hour;
            return (
              <button
                key={hour}
                type="button"
                onClick={() => onSelectHour(hour)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-sm transition-colors",
                  active
                    ? "bg-teal-50 ring-1 ring-teal-400"
                    : "hover:bg-stone-50",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-12 shrink-0 font-mono text-xs",
                    active ? "font-semibold text-teal-700" : "text-stone-500",
                  ].join(" ")}
                >
                  {hour}:00
                </span>
                <div className="h-4 flex-1 rounded bg-stone-100">
                  <div
                    className={[
                      "h-4 rounded",
                      active ? "bg-teal-600" : "bg-teal-500/70",
                    ].join(" ")}
                    style={{ width: `${(count / maxHourly) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-stone-600">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Төлбөрийн төрөл
        </h3>
        <ul className="space-y-2">
          {payments.map(([method, info]) => (
            <li key={method} className="flex items-baseline justify-between text-sm">
              <span className="text-stone-700">{method}</span>
              <span className="text-stone-500">
                <span className="font-medium text-stone-800">{info.count}</span>
                {info.amount > 0 && (
                  <span className="ml-2 tabular-nums">
                    {formatAmount(info.amount)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Error deals */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Алдаатай борлуулалт
        </h3>
        {errorDeals.length === 0 ? (
          <p className="text-sm text-emerald-700">Алдаатай борлуулалт алга.</p>
        ) : (
          <ul className="space-y-2">
            {errorDeals.map((deal) => (
              <li key={deal.id}>
                <button
                  type="button"
                  onClick={() => onSelectDeal(deal)}
                  className="w-full rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left text-sm hover:border-red-300"
                >
                  <span className="font-mono text-xs text-red-400">
                    {deal.startTime.slice(0, 8)}
                  </span>{" "}
                  <span className="font-medium text-red-800">
                    #{deal.index}
                  </span>{" "}
                  <span className="text-red-700">
                    {deal.errors[0]?.explanation}
                  </span>
                  {deal.errors.length > 1 && (
                    <span className="text-red-400">
                      {" "}
                      (+{deal.errors.length - 1})
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
