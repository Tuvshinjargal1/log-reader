"use client";

/**
 * ИЛҮҮДЭЛ / ХАЯГДЛЫН ЗАРДАЛ — "автомат хэт их захиалсан"-ыг тоогоор хэмжинэ.
 *
 * Хаягдал нь симуляц дээр FIFO багцын хугацаа дуусахаас БОДИТООР үүсдэг тул
 * эдгээр тоо зохиомол биш.
 */
import { useMemo } from "react";
import type { BoardStore } from "@/lib/replenish/board";
import { formatCompactMnt } from "@/lib/labels.mn";
import { HELP } from "@/lib/board/helpText";
import { HelpToggle, Icon, SectionHeader, StatTile } from "./ui";

interface CatRow {
  key: string;
  name: string;
  wasteMnt: number;
  overstockMnt: number;
  lostMnt: number;
  worstStore: string;
  worstMnt: number;
}

export function WastePanel({
  stores,
  onOpen,
}: {
  stores: BoardStore[];
  onOpen: (storeId: number, categoryKey: string) => void;
}) {
  const { rows, totals } = useMemo(() => {
    const map = new Map<string, CatRow & { byStore: Map<number, { name: string; mnt: number }> }>();
    let waste = 0;
    let overstock = 0;
    let lost = 0;

    for (const s of stores) {
      for (const c of s.categories) {
        const m = c.metrics;
        waste += m.wasteMnt;
        overstock += m.overstockMnt;
        lost += m.lostMnt;

        let row = map.get(c.key);
        if (!row) {
          row = {
            key: c.key, name: c.name,
            wasteMnt: 0, overstockMnt: 0, lostMnt: 0,
            worstStore: "", worstMnt: 0,
            byStore: new Map(),
          };
          map.set(c.key, row);
        }
        row.wasteMnt += m.wasteMnt;
        row.overstockMnt += m.overstockMnt;
        row.lostMnt += m.lostMnt;
        const cost = m.wasteMnt + 0.15 * m.overstockMnt;
        row.byStore.set(s.storeId, { name: s.name, mnt: cost });
      }
    }

    const list = [...map.values()]
      .map((r) => {
        let worstStore = "";
        let worstMnt = 0;
        let worstId = 0;
        for (const [id, v] of r.byStore) {
          if (v.mnt > worstMnt) {
            worstMnt = v.mnt;
            worstStore = v.name;
            worstId = id;
          }
        }
        return { ...r, worstStore, worstMnt, worstId };
      })
      .sort(
        (a, b) =>
          b.wasteMnt + 0.15 * b.overstockMnt - (a.wasteMnt + 0.15 * a.overstockMnt),
      );

    return { rows: list, totals: { waste, overstock, lost } };
  }, [stores]);

  const maxCost = Math.max(1, ...rows.map((r) => r.wasteMnt + 0.15 * r.overstockMnt));

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.trash className="h-5 w-5" />}
        title="Илүүдэл ба хаягдлын зардал"
        description="Хэт их захиалсны үнэ — бүлгээр эрэмбэлэв."
        right={
          <HelpToggle>
            {HELP.waste.map((t) => (
              <p key={t} className="mb-1 last:mb-0">{t}</p>
            ))}
          </HelpToggle>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Хугацаа дууссан хаягдал"
          value={formatCompactMnt(totals.waste)}
          hint="90 хоногийн нийлбэр"
          tone={totals.waste > 0 ? "warn" : "ok"}
        />
        <StatTile
          label="Гацсан илүүдэл нөөц"
          value={formatCompactMnt(totals.overstock)}
          hint="хамгаалалтын цонхноос дээших"
        />
        <StatTile
          label="Алдагдсан борлуулалт"
          value={formatCompactMnt(totals.lost)}
          hint="нөөц дуусснаас"
          tone={totals.lost > 0 ? "danger" : "ok"}
        />
      </div>

      <div className="mt-5 space-y-2">
        {rows.slice(0, 10).map((r) => {
          const cost = r.wasteMnt + 0.15 * r.overstockMnt;
          return (
            <div key={r.key} className="flex flex-wrap items-center gap-3">
              <span className="w-44 shrink-0 truncate text-sm text-stone-700" title={r.name}>
                {r.name}
              </span>
              <span className="h-2.5 min-w-[80px] flex-1 rounded-full bg-stone-100">
                {/* Хаягдал (амбер) ба гацсан хөрөнгө (тод бус) хоёрыг 2px
                    гадаргуун зайгаар тусгаарлана — хүрээ ЗУРАХГҮЙ */}
                <span className="flex h-2.5 gap-[2px]">
                  <span
                    className="block h-2.5 rounded-l-full bg-amber-500"
                    style={{ width: `${(r.wasteMnt / maxCost) * 100}%` }}
                  />
                  <span
                    className="block h-2.5 rounded-r-full bg-stone-300"
                    style={{ width: `${((0.15 * r.overstockMnt) / maxCost) * 100}%` }}
                  />
                </span>
              </span>
              <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-stone-800">
                {formatCompactMnt(cost)}
              </span>
              {r.worstStore && (
                <button
                  type="button"
                  onClick={() => onOpen(r.worstId, r.key)}
                  className="w-40 shrink-0 truncate text-left text-[11px] text-teal-700 hover:text-teal-900"
                  title={`${r.worstStore} — ${formatCompactMnt(r.worstMnt)}`}
                >
                  {r.worstStore.replace(/^GS25\s*/, "")} →
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> хугацаа дууссан хаягдал
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-stone-300" /> гацсан хөрөнгийн зардал (15%/жил)
        </span>
      </div>
    </section>
  );
}
