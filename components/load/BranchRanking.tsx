"use client";

import type { BranchLoad } from "@/lib/load/types";
import { ymdToIso } from "@/lib/sms/suggest";

interface BranchRankingProps {
  loads: BranchLoad[];
  selectedBizplCd: string | null;
  onSelect: (bizplCd: string) => void;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
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
          Салбаруудын гүйлгээний ачаалал
        </h3>
        <p className="mt-0.5 text-xs text-stone-400">
          POS IP-ээс уншсан чекийн тоо (сүүлийн 1 сар). Салбар дээр дарж зураг/цагийн задаргааг харна.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Салбар</th>
              <th className="px-2 py-2 text-right font-medium">Өдрийн гүйлгээ</th>
              <th className="px-2 py-2 text-right font-medium">Сарын нийт</th>
              <th className="px-2 py-2 text-right font-medium">Нэг цагийн хамгийн их</th>
              <th className="px-2 py-2 text-right font-medium">Өдрийн хамгийн их</th>
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
                    <div className="font-mono text-[10px] text-stone-400">
                      {l.ips.join(", ")}
                    </div>
                    {!l.branch && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        зурагтай тулгагдаагүй
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {Math.round(l.avgDailyTx).toLocaleString("mn-MN")}
                    <div className="text-[10px] font-normal text-stone-400">
                      өдрийн дундаж
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {l.totalTx.toLocaleString("mn-MN")}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {l.peakHourMaxTx > 0
                      ? l.peakHourMaxTx.toLocaleString("mn-MN")
                      : "—"}
                    {l.peakHourMaxDate != null && l.peakHourMaxHour != null && (
                      <div className="text-[10px] font-normal text-stone-400">
                        {ymdToIso(l.peakHourMaxDate)} {fmtHour(l.peakHourMaxHour)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {l.peakDayTx > 0 ? l.peakDayTx.toLocaleString("mn-MN") : "—"}
                    {l.peakDayDate && (
                      <div className="text-[10px] font-normal text-stone-400">
                        {ymdToIso(l.peakDayDate)}
                      </div>
                    )}
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
