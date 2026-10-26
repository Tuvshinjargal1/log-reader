"use client";

/**
 * Өнөөдрийн шийдвэрийн хураангуй — 20 салангид чип.
 *
 * Харьцаат stacked bar ХЭРЭГЛЭЭГҮЙ шалтгаан: гол зорилго нь "яг хорин дэлгүүр
 * байна, тэдгээрийг ТООЛЖ болно" гэдгийг харуулах. Харьцаа биш, тоо чухал.
 *
 * Энэ бол board-ын ЦОРЫН ГАНЦ шүүлтийн мөр — шүүлтүүр нь өөрийн хамрах бүх
 * зүйлийн ДЭЭР байрлана, график картын дотор хэзээ ч биш.
 */
import type { BoardStore, Verdict } from "@/lib/replenish/board";
import { VERDICT, VERDICT_ORDER, verdictFillStyle } from "@/lib/board/verdict";
import { cn, HelpToggle, SectionHeader, Icon } from "./ui";
import { HELP } from "@/lib/board/helpText";

export function VerdictTally({
  stores,
  counts,
  active,
  onToggle,
  onPick,
}: {
  stores: BoardStore[];
  counts: Record<Verdict, number>;
  active: Verdict | null;
  onToggle: (v: Verdict | null) => void;
  onPick: (storeId: number) => void;
}) {
  const ordered = [...stores].sort(
    (a, b) =>
      VERDICT[a.verdictInfo.verdict].order - VERDICT[b.verdictInfo.verdict].order ||
      b.verdictInfo.impactMnt - a.verdictInfo.impactMnt,
  );

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.target className="h-5 w-5" />}
        title={`Өнөөдрийн шийдвэр · ${stores.length} дэлгүүр`}
        description="Чип бүр нэг дэлгүүр. Доорх тайлбар дээр дарж шүүнэ."
        right={
          <>
            {active && (
              <button
                type="button"
                onClick={() => onToggle(null)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              >
                Шүүлт цуцлах
              </button>
            )}
            <HelpToggle>
              {HELP.tally.map((t) => (
                <p key={t} className="mb-1 last:mb-0">{t}</p>
              ))}
            </HelpToggle>
          </>
        }
      />

      {/* 20 чип — 2px зай нь тусгаарлагч, хүрээ ЗУРАХГҮЙ */}
      <div className="mt-3.5 flex gap-[2px]">
        {ordered.map((s) => {
          const v = s.verdictInfo.verdict;
          const dim = active != null && active !== v;
          const style = verdictFillStyle(v);
          return (
            <button
              key={s.storeId}
              type="button"
              onClick={() => onPick(s.storeId)}
              title={`${s.name} — ${VERDICT[v].label}`}
              aria-label={`${s.name} — ${VERDICT[v].label}`}
              className={cn(
                "flex h-9 flex-1 items-center justify-center rounded-[4px] text-[13px] font-bold transition-opacity",
                dim ? "opacity-20" : "opacity-100 hover:opacity-80",
              )}
              style={style}
            >
              {VERDICT[v].glyph}
            </button>
          );
        })}
      </div>

      {/* Тайлбар = шүүлтүүр. Өнгө дангаараа мэдээлэл дамжуулахгүй — тэмдэг + нэр. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {VERDICT_ORDER.map((v) => {
          const t = VERDICT[v];
          const n = counts[v] ?? 0;
          const on = active === v;
          const style = verdictFillStyle(v);
          return (
            <button
              key={v}
              type="button"
              disabled={n === 0}
              onClick={() => onToggle(on ? null : v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                n === 0 && "cursor-not-allowed opacity-40",
                on
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
              )}
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-[10px] font-bold"
                style={style}
              >
                {t.glyph}
              </span>
              {t.label}
              <span className="tabular-nums font-bold">{n}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
