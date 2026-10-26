"use client";

import { ymdToIso } from "@/lib/sms/suggest";
import { formatAmount } from "@/lib/labels.mn";
import type { TxStats } from "@/lib/pos/txStats";
import { Badge, Button, Card, Icon, SectionHeader, StatTile } from "./ui";

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

interface TxStatsPanelProps {
  stats: TxStats;
  storeName?: string;
  source?: "cache" | "pos";
  busy?: boolean;
  onRefresh?: () => void;
  emptyHint?: string;
}

export function TxStatsPanel({
  stats,
  storeName,
  source,
  busy,
  onRefresh,
  emptyHint,
}: TxStatsPanelProps) {
  const empty = stats.month.txCount === 0;
  const maxDay = Math.max(...stats.daily.map((d) => d.txCount), 1);

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        icon={<Icon.chart className="h-5 w-5" />}
        title={storeName ? `Гүйлгээний ачаалал — ${storeName}` : "Гүйлгээний ачаалал"}
        description="Дөрвөн үзүүлэлт бүгд өнөөдрөөс 1 сар ухарсан цонхонд (now − 1 month): өдрийн дундаж, нийлбэр, цагийн оргил, өдрийн оргил."
        right={
          <div className="flex items-center gap-2">
            {source && (
              <Badge tone={source === "pos" ? "emerald" : "neutral"}>
                {source === "pos" ? "POS шууд" : "кэш"}
              </Badge>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                icon={<Icon.sync />}
                loading={busy}
                onClick={onRefresh}
              >
                POS-оос шинэчлэх
              </Button>
            )}
          </div>
        }
      />

      {empty ? (
        <p className="mt-4 text-sm text-stone-500">
          {emptyHint ??
            "Энэ цонхонд гүйлгээний тоо алга. POS-оос дата татаж эсвэл «POS-оос шинэчлэх» дарна уу."}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Өдрийн гүйлгээний тоо"
              value={Math.round(stats.avgDailyTx).toLocaleString("mn-MN")}
              hint={`${ymdToIso(stats.month.from)} → ${ymdToIso(stats.month.to)} · өдрийн дундаж`}
              icon={<Icon.store className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Сарын нийт гүйлгээний тоо"
              value={stats.month.txCount.toLocaleString("mn-MN")}
              hint={`${ymdToIso(stats.month.from)} → ${ymdToIso(stats.month.to)}`}
              icon={<Icon.list className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Нэг цагийн хамгийн их"
              value={
                stats.peakHour
                  ? stats.peakHour.txCount.toLocaleString("mn-MN")
                  : "—"
              }
              hint={
                stats.peakHour
                  ? `${ymdToIso(stats.peakHour.date)} ${fmtHour(stats.peakHour.hour)}`
                  : undefined
              }
              tone="warn"
              icon={<Icon.clock className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Өдрийн хамгийн их гүйлгээ"
              value={
                stats.peakDay
                  ? stats.peakDay.txCount.toLocaleString("mn-MN")
                  : "—"
              }
              hint={
                stats.peakDay
                  ? `${ymdToIso(stats.peakDay.date)}${stats.peakDay.amount ? ` · ${formatAmount(stats.peakDay.amount)}` : ""}`
                  : undefined
              }
              icon={<Icon.trend className="h-3.5 w-3.5" />}
            />
          </div>

          {stats.daily.length > 1 && (
            <div className="mt-5">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Өдөр тутмын гүйлгээ ({stats.daily.length} өдөр)
              </h4>
              <div className="flex items-end gap-px" style={{ height: 96 }}>
                {stats.daily.map((d) => {
                  const isPeak = stats.peakDay?.date === d.date;
                  const isToday = d.date === stats.today.date;
                  const h = Math.max(4, (d.txCount / maxDay) * 100);
                  return (
                    <div
                      key={d.date}
                      className="group relative flex flex-1 flex-col items-center"
                      title={`${ymdToIso(d.date)}: ${d.txCount.toLocaleString("mn-MN")} гүйлгээ`}
                    >
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${h}%`,
                            background: isPeak
                              ? "#d97706"
                              : isToday
                                ? "#0d9488"
                                : "#a8a29e",
                            minHeight: 3,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                <span>{ymdToIso(stats.daily[0].date)}</span>
                <span className="flex gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-teal-600" /> өнөөдөр
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-amber-600" /> оргил өдөр
                  </span>
                </span>
                <span>{ymdToIso(stats.daily[stats.daily.length - 1].date)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
