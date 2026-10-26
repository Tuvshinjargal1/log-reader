"use client";

/**
 * ӨДРИЙН АЖЛЫН ДАРААЛАЛ — "20 дэлгүүрээс өнөөдөр зөвхөн N-д оролцоно".
 *
 * Захиралд хамгийн ойлгомжтой ROI: 2 цагийн ажил 10 минут болно. Мөр бүр
 * тухайн дэлгүүрт хэрэгтэй ЯГ нэг үйлдлийг агуулна.
 */
import { useMemo, useState } from "react";
import type { BoardAction, BoardStore } from "@/lib/replenish/board";
import { VERDICT, verdictFillStyle } from "@/lib/board/verdict";
import { formatCompactMnt } from "@/lib/labels.mn";
import { estimateMinutes } from "@/lib/board/insights";
import { HELP } from "@/lib/board/helpText";
import { Alert, Button, EmptyState, HelpToggle, Icon, SectionHeader } from "./ui";

const ACTION_LABEL: Record<BoardAction["kind"], string> = {
  tune: "Тохируулах",
  switch_mode: "Автомат болгох",
  ingest: "Холболт шалгах",
  review: "Харах",
};

export function WorkQueue({
  stores,
  onOpen,
  onAction,
}: {
  stores: BoardStore[];
  onOpen: (storeId: number) => void;
  onAction: (store: BoardStore, action: BoardAction) => Promise<void>;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      stores
        .filter((s) => s.verdictInfo.verdict !== "AUTO_OK")
        .sort(
          (a, b) =>
            VERDICT[a.verdictInfo.verdict].order - VERDICT[b.verdictInfo.verdict].order ||
            b.verdictInfo.impactMnt - a.verdictInfo.impactMnt,
        ),
    [stores],
  );

  const totalImpact = queue.reduce((a, s) => a + s.verdictInfo.impactMnt, 0);

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={<Icon.check className="h-10 w-10" />}
        title="Өнөөдөр гараар оролцох шаардлагагүй"
        description={`${stores.length} дэлгүүр бүгд автомат хэвээр сайн ажиллаж байна.`}
      />
    );
  }

  const run = async (s: BoardStore) => {
    const action = s.verdictInfo.action;
    if (!action) {
      onOpen(s.storeId);
      return;
    }
    setBusy(s.storeId);
    setError(null);
    try {
      await onAction(s, action);
      setDone((prev) => new Set(prev).add(s.storeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Үйлдэл гүйцэтгэхэд алдаа гарлаа");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.clock className="h-5 w-5" />}
        title={`Өнөөдөр ${stores.length} дэлгүүрээс ${queue.length}-д оролцоно`}
        description={`Ойролцоогоор ${estimateMinutes(queue.length)} минут · эрсдэлд байгаа ${formatCompactMnt(totalImpact)}`}
        right={
          <HelpToggle>
            {HELP.workQueue.map((t) => (
              <p key={t} className="mb-1 last:mb-0">{t}</p>
            ))}
          </HelpToggle>
        }
      />

      {error && <div className="mt-3"><Alert tone="error" onClose={() => setError(null)}>{error}</Alert></div>}

      <ol className="mt-3.5 divide-y divide-stone-100">
        {queue.map((s, i) => {
          const v = s.verdictInfo.verdict;
          const t = VERDICT[v];
          const action = s.verdictInfo.action;
          const isDone = done.has(s.storeId);
          return (
            <li key={s.storeId} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-stone-300">
                {i + 1}
              </span>
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                style={verdictFillStyle(v)}
                title={t.label}
              >
                {t.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpen(s.storeId)}
                  className="block max-w-full truncate text-left text-sm font-semibold text-stone-900 hover:text-teal-700"
                >
                  {s.name}
                </button>
                <p className="truncate text-xs text-stone-500">{s.verdictInfo.headline}</p>
              </div>
              <span className="shrink-0 text-right text-xs tabular-nums text-stone-500">
                {formatCompactMnt(s.verdictInfo.impactMnt)}
                <span className="block text-[10px] text-stone-400">эрсдэл</span>
              </span>
              {isDone ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700">
                  <Icon.check className="h-3.5 w-3.5" /> Хийгдсэн
                </span>
              ) : (
                <Button
                  variant={v === "TUNE" ? "primary" : "outline"}
                  size="sm"
                  loading={busy === s.storeId}
                  onClick={() => run(s)}
                >
                  {action ? ACTION_LABEL[action.kind] : "Харах"}
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] text-stone-400">
        Үлдсэн {stores.length - queue.length} дэлгүүр автомат хэвээр — оролцох шаардлагагүй.
      </p>
    </section>
  );
}
