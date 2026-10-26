"use client";

/**
 * ШИЙДВЭРИЙН ЗУРАГЛАЛ — board табын агуулагч.
 *
 * Дөрвөн цохилтын өгүүлэмж, нэг карт нэг цохилт:
 *   ЮУ        TodayStrip + VerdictTally   → 20 дэлгүүр → 5 шийдвэр, 3 секундэд
 *   ЯАГААД    DecisionQuadrant            → хүний оролцоо өгөөжөө өгч байна уу?
 *   ХААНА     CategoryHeatGrid            → аль дэлгүүр × аль бүлэг (дарж засна)
 *   ХЭЗЭЭ     FleetTrend                  → цаг үеэ дагаж чадаж байна уу?
 *   ДАРАА ЮУ  WorkQueue                   → өнөөдөр яг юу хийх
 *
 * Бүх карт НЭГ шүүлтийн мөрөөс (VerdictTally) scope болно. Карт тус бүрийн
 * дотор шүүлтүүр хэзээ ч тавихгүй.
 */
import { useCallback, useMemo, useState } from "react";
import type { BoardAction, BoardStore, DecisionBoard as Board, Verdict } from "@/lib/replenish/board";
import { autoVsManualSentence, todaySentence } from "@/lib/board/insights";
import { formatCompactMnt, formatPct } from "@/lib/labels.mn";
import { ApprovalQueue } from "./ApprovalQueue";
import { CategoryDrawer } from "./CategoryDrawer";
import { CategoryHeatGrid } from "./CategoryHeatGrid";
import { DecisionQuadrant } from "./DecisionQuadrant";
import { FleetTrend } from "./FleetTrend";
import { VerdictTally } from "./VerdictTally";
import { WastePanel } from "./WastePanel";
import { WorkQueue } from "./WorkQueue";
import { Alert, cn, Icon, StatTile } from "./ui";

export function DecisionBoard({
  board,
  refreshing,
  onRefresh,
  onOpenStore,
}: {
  board: Board;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenStore: (storeId: number) => void;
}) {
  const [filter, setFilter] = useState<Verdict | null>(null);
  const [drawer, setDrawer] = useState<{ storeId: number; categoryKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storeById = useMemo(
    () => new Map(board.stores.map((s) => [s.storeId, s] as const)),
    [board.stores],
  );

  const openCategory = useCallback((storeId: number, categoryKey: string) => {
    setDrawer({ storeId, categoryKey });
  }, []);

  /** Дэлгүүрийг дарахад хамгийн яаралтай ангиллыг нээнэ. */
  const openStoreCategory = useCallback(
    (storeId: number) => {
      const s = storeById.get(storeId);
      const first = s?.categories[0];
      if (first) setDrawer({ storeId, categoryKey: first.key });
      else onOpenStore(storeId);
    },
    [storeById, onOpenStore],
  );

  /** WorkQueue-ийн үйлдлүүд — board-ын `action` нь аль хэдийн POST-shaped. */
  const runAction = useCallback(
    async (store: BoardStore, action: BoardAction) => {
      if (action.kind === "tune" && action.param && action.to != null) {
        const res = await fetch("/api/tune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: store.storeId,
            scope: action.scope ?? "store",
            scopeKey: action.scopeKey ?? null,
            param: action.param,
            from: action.from,
            to: action.to,
            reason: store.verdictInfo.headline,
            by: "operator",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        onRefresh();
        return;
      }
      if (action.kind === "switch_mode" && action.mode) {
        const res = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "store",
            storeId: store.storeId,
            patch: { mode: action.mode },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        onRefresh();
        return;
      }
      // ingest / review → дэлгэрэнгүй рүү
      openStoreCategory(store.storeId);
    },
    [onRefresh, openStoreCategory],
  );

  const t = board.totals;
  const visible = filter ? board.stores.filter((s) => s.verdictInfo.verdict === filter) : board.stores;

  return (
    <div className={cn("space-y-4 transition-opacity", refreshing && "opacity-60")}>
      {error && <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>}

      {board.staleSeed && (
        <Alert tone="error">
          Хамгийн сүүлийн борлуулалтын дата <b>{board.asOf}</b> — өнөөдрөөс хоцорсон байна.
          Ийм үед бүх дэлгүүрийн POS синк хуучирч, самбар дээр бүгд{" "}
          <b>«Дата дутуу»</b> болж харагдана. Демо датаг дахин үүсгэнэ үү (
          <code className="font-mono text-xs">npm run seed:demo:reset</code>).
        </Alert>
      )}

      {/* ── ЮУ ── Захирал өөрийн зөвлөлдөө давтан хэлэх өгүүлбэр */}
      <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-relaxed text-teal-900 print:border-stone-300 print:bg-white">
        {todaySentence(board)}
      </div>

      {/* Автомат vs гараар — захирлын гол асуултын нэг мөрийн хариу */}
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-stone-400">
            <Icon.chart className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Автомат сайн уу, гараар сайн уу?</h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {autoVsManualSentence(board)}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Автомат мөр"
            value={t.autoVsManual.autoLines.toLocaleString("mn-MN")}
            hint={`алдааны дундаж ${t.autoVsManual.autoMae.toFixed(1)} ширхэг`}
          />
          <StatTile
            label="Гараар зассан мөр"
            value={t.autoVsManual.manualLines.toLocaleString("mn-MN")}
            hint={`алдааны дундаж ${t.autoVsManual.manualMae.toFixed(1)} ширхэг`}
          />
          <StatTile
            label="Гараар зассны оноо"
            value={formatPct(t.autoVsManual.manualWinRate)}
            hint="борлуулалтаар зөв гарсан"
            tone={t.autoVsManual.manualWinRate >= 0.6 ? "ok" : t.autoVsManual.manualWinRate < 0.45 ? "warn" : undefined}
          />
          <StatTile
            label="Гараар нэмсэн үнэ цэнэ"
            value={formatCompactMnt(t.autoVsManual.manualValueMnt)}
            hint="90 хоногийн нийлбэр"
          />
        </div>
      </div>

      <VerdictTally
        stores={board.stores}
        counts={t.byVerdict}
        active={filter}
        onToggle={setFilter}
        onPick={openStoreCategory}
      />

      {/* ── ЯАГААД ── */}
      <DecisionQuadrant stores={board.stores} filter={filter} onSelect={openStoreCategory} />

      {/* ── ХААНА ── */}
      <CategoryHeatGrid stores={board.stores} filter={filter} onOpen={openCategory} />

      {/* ── ХЭЗЭЭ ── */}
      <FleetTrend trend={board.trend} />

      {/* ── ДАРАА ЮУ ── */}
      <WorkQueue stores={visible} onOpen={openStoreCategory} onAction={runAction} />

      <ApprovalQueue
        stores={board.stores}
        threshold={t.approvalThreshold}
        onSubmitted={onRefresh}
      />

      <WastePanel stores={board.stores} onOpen={openCategory} />

      <CategoryDrawer
        store={drawer ? (storeById.get(drawer.storeId) ?? null) : null}
        categoryKey={drawer?.categoryKey ?? null}
        onClose={() => setDrawer(null)}
        onDirty={onRefresh}
        onOpenStore={onOpenStore}
      />
    </div>
  );
}
