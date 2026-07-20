"use client";

import { useMemo } from "react";
import type { Deal } from "@/lib/types";
import { formatAmount } from "@/lib/labels.mn";

interface OverviewStatsProps {
  deals: Deal[];
  onSelectDeal: (deal: Deal) => void;
}

export function OverviewStats({ deals, onSelectDeal }: OverviewStatsProps) {
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
      {/* Hourly activity */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Цаг тутмын борлуулалт
        </h3>
        <div className="space-y-1.5">
          {hourly.map(([hour, count]) => (
            <div key={hour} className="flex items-center gap-2 text-sm">
              <span className="w-12 shrink-0 font-mono text-xs text-stone-500">
                {hour}:00
              </span>
              <div className="h-4 flex-1 rounded bg-stone-100">
                <div
                  className="h-4 rounded bg-teal-500/70"
                  style={{ width: `${(count / maxHourly) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums text-stone-600">
                {count}
              </span>
            </div>
          ))}
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
