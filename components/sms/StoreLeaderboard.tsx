"use client";

/**
 * Дэлгүүрийн эрэмбэ — гурван үүргийг НЭГ дор гүйцэтгэнэ:
 *   1. Шийдвэрийн зургийн ХҮСНЭГТ хувилбар (өнгөнөөс хамааралгүй, WCAG-цэвэр)
 *   2. Амберын 2.15:1 контрастын нөхөх суваг
 *   3. Захирлын "зүгээр жагсаалтаар нь харуулаач" гэдэг хүсэлт
 */
import { useMemo, useState } from "react";
import type { BoardStore, Verdict } from "@/lib/replenish/board";
import { VERDICT, verdictFillStyle } from "@/lib/board/verdict";
import { formatCompactMnt, formatPct } from "@/lib/labels.mn";
import { cn, Segmented } from "./ui";

type SortKey = "score" | "impact" | "override" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  score: "Оноо",
  impact: "Эрсдэл ₮",
  override: "Гараар %",
  name: "Нэр",
};

function gradeOf(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: "Сайн", tone: "bg-teal-100 text-teal-800" };
  if (score >= 60) return { label: "Дунд", tone: "bg-amber-100 text-amber-900" };
  return { label: "Сул", tone: "bg-rose-100 text-rose-700" };
}

export function StoreLeaderboard({
  stores,
  filter,
  onSelect,
  compact,
}: {
  stores: BoardStore[];
  filter: Verdict | null;
  onSelect: (storeId: number) => void;
  compact?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("score");

  const rows = useMemo(() => {
    const list = filter ? stores.filter((s) => s.verdictInfo.verdict === filter) : [...stores];
    list.sort((a, b) => {
      switch (sort) {
        case "impact":
          return b.verdictInfo.impactMnt - a.verdictInfo.impactMnt;
        case "override":
          return b.metrics.overrideRate - a.metrics.overrideRate;
        case "name":
          return a.name.localeCompare(b.name, "mn");
        default:
          return b.verdictInfo.score - a.verdictInfo.score;
      }
    });
    return list;
  }, [stores, filter, sort]);

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Эрэмбэлэх
          </span>
          <Segmented<SortKey>
            size="sm"
            value={sort}
            onChange={setSort}
            options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
              value: k,
              label: SORT_LABEL[k],
            }))}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-2 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Дэлгүүр</th>
              <th className="px-2 py-2 text-left font-semibold">Шийдвэр</th>
              <th className="px-2 py-2 text-center font-semibold">Горим</th>
              <th className="px-2 py-2 text-right font-semibold">Оноо</th>
              <th className="px-2 py-2 text-right font-semibold">Нөхөлт</th>
              <th className="px-2 py-2 text-right font-semibold">Гараар</th>
              <th className="px-2 py-2 text-right font-semibold">Зөв гарсан</th>
              <th className="px-3 py-2 text-right font-semibold">Эрсдэл ₮</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((s, i) => {
              const v = s.verdictInfo.verdict;
              const t = VERDICT[v];
              const g = gradeOf(s.verdictInfo.score);
              const measurable = s.metrics.overrideSamples >= 4;
              return (
                <tr
                  key={s.storeId}
                  onClick={() => onSelect(s.storeId)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(s.storeId);
                  }}
                  className="cursor-pointer hover:bg-stone-50/70 focus:bg-stone-50 focus:outline-none"
                >
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-stone-400">{i + 1}</td>
                  <td className="max-w-[15rem] truncate px-3 py-2 font-medium text-stone-800">
                    {s.name}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={verdictFillStyle(v)}
                    >
                      {t.glyph} {t.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {/* Горимыг МОНОХРОМ үсгэн чипээр — verdict-ийн 4 өнгөтэй
                        өрсөлдөхгүй. Нэг өнгөт суваг = нэг утга. */}
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-[11px] font-bold text-stone-700"
                      title={s.mode === "auto" ? "Автомат" : "Гараар"}
                    >
                      {s.mode === "auto" ? "А" : "Г"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold tabular-nums", g.tone)}>
                      {s.verdictInfo.score}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {formatPct(s.metrics.fillRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {formatPct(s.metrics.overrideRate)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-700">
                    {measurable ? formatPct(s.metrics.overrideAccuracy) : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                    {formatCompactMnt(s.verdictInfo.impactMnt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-stone-400">
                  Энэ шүүлтэд тохирох дэлгүүр алга.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
