"use client";

import type { BranchLoad } from "@/lib/load/types";
import { formatAmount } from "@/lib/labels.mn";

interface BranchRankingProps {
  loads: BranchLoad[];
  selectedBizplCd: string | null;
  onSelect: (bizplCd: string) => void;
}

export function scoreColor(score: number): string {
  if (score >= 70) return "bg-red-100 text-red-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export function BranchRanking({
  loads,
  selectedBizplCd,
  onSelect,
}: BranchRankingProps) {
  if (loads.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Салбаруудын ачааллын зэрэглэл
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Салбар</th>
              <th className="px-2 py-2 text-right font-medium">Өдрийн дундаж гүйлгээ</th>
              <th className="px-2 py-2 text-right font-medium">Оргил цаг</th>
              <th className="px-2 py-2 text-right font-medium">Нийт дүн</th>
              <th className="px-4 py-2 text-right font-medium">Оноо</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l, i) => {
              const active = l.bizplCd === selectedBizplCd;
              return (
                <tr
                  key={l.bizplCd}
                  onClick={() => onSelect(l.bizplCd)}
                  className={[
                    "cursor-pointer border-t border-stone-100 transition-colors",
                    active ? "bg-teal-50" : "hover:bg-stone-50",
                  ].join(" ")}
                >
                  <td className="px-4 py-2 tabular-nums text-stone-400">{i + 1}</td>
                  <td className="px-2 py-2">
                    <span className="font-medium text-stone-800">
                      {l.branch?.name ?? "Тодорхойгүй"}
                    </span>{" "}
                    <span className="font-mono text-xs text-stone-400">
                      {l.bizplCd}
                    </span>
                    {!l.branch && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        зурагтай тулгагдаагүй
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {l.avgDailyTx.toFixed(0)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {l.peakHour !== null
                      ? `${String(l.peakHour).padStart(2, "0")}:00 (${l.peakHourAvgTx.toFixed(0)})`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {formatAmount(l.totalAmount)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={[
                        "inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                        scoreColor(l.score),
                      ].join(" ")}
                    >
                      {l.score}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
