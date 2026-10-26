"use client";

import type { TxStats } from "@/lib/pos/txStats";
import { ymdToIso } from "@/lib/sms/suggest";
import { Button, Card, EmptyState, Icon, SectionHeader } from "./ui";

export interface StoreTxRow {
  storeId: number;
  name: string;
  stats: TxStats;
  source?: "cache" | "pos";
}

interface TxFleetPanelProps {
  rows: StoreTxRow[];
  busy?: boolean;
  onRefreshAll?: () => void;
  onOpenStore?: (id: number) => void;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function TxFleetPanel({
  rows,
  busy,
  onRefreshAll,
  onOpenStore,
}: TxFleetPanelProps) {
  const sorted = [...rows].sort(
    (a, b) => b.stats.month.txCount - a.stats.month.txCount,
  );
  const anyData = sorted.some((r) => r.stats.month.txCount > 0);

  if (!anyData) {
    return (
      <EmptyState
        icon={<Icon.chart className="h-10 w-10" />}
        title="Гүйлгээний тоо алга"
        description="POS-оос чекийн тоог татаагүй байна. «POS-оос дата татах» эсвэл эндээс шууд шинэчилнэ үү."
      >
        {onRefreshAll && (
          <Button
            variant="primary"
            icon={<Icon.sync />}
            loading={busy}
            onClick={onRefreshAll}
          >
            POS-оос татах
          </Button>
        )}
      </EmptyState>
    );
  }

  return (
    <Card>
      <div className="border-b border-stone-100 px-4 py-3">
        <SectionHeader
          icon={<Icon.chart className="h-5 w-5" />}
          title="Гүйлгээний ачаалал — бүх дэлгүүр"
          description="Бүх үзүүлэлт өнөөдрөөс 1 сар ухарсан цонхонд (now − 1 month)."
          right={
            onRefreshAll ? (
              <Button
                variant="outline"
                size="sm"
                icon={<Icon.sync />}
                loading={busy}
                onClick={onRefreshAll}
              >
                POS-оос шинэчлэх
              </Button>
            ) : undefined
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Дэлгүүр</th>
              <th className="px-3 py-2 text-right font-medium">Өдрийн гүйлгээ</th>
              <th className="px-3 py-2 text-right font-medium">Сарын нийт</th>
              <th className="px-3 py-2 text-right font-medium">Нэг цагийн хамгийн их</th>
              <th className="px-3 py-2 text-right font-medium">Өдрийн хамгийн их</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sorted.map((r, i) => (
              <tr
                key={r.storeId}
                className={onOpenStore ? "cursor-pointer hover:bg-stone-50/70" : ""}
                onClick={() => onOpenStore?.(r.storeId)}
              >
                <td className="px-3 py-1.5 tabular-nums text-stone-400">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium text-stone-800">{r.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                  {Math.round(r.stats.avgDailyTx).toLocaleString("mn-MN")}
                  <div className="text-[10px] font-normal text-stone-400">
                    өдрийн дундаж
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                  {r.stats.month.txCount.toLocaleString("mn-MN")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                  {r.stats.peakHour
                    ? r.stats.peakHour.txCount.toLocaleString("mn-MN")
                    : "—"}
                  {r.stats.peakHour && (
                    <div className="text-[10px] font-normal text-stone-400">
                      {ymdToIso(r.stats.peakHour.date)} {fmtHour(r.stats.peakHour.hour)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                  {r.stats.peakDay
                    ? r.stats.peakDay.txCount.toLocaleString("mn-MN")
                    : "—"}
                  {r.stats.peakDay && (
                    <div className="text-[10px] font-normal text-stone-400">
                      {ymdToIso(r.stats.peakDay.date)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
