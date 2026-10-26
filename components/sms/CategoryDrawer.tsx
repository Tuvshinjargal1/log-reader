"use client";

/**
 * АНГИЛАЛ РУУ ОРОХ ХАВТАС — зурагнаас нүд дарахад нээгдэнэ.
 *
 * Хуудас солихын оронд хавтас гаргах шалтгаан: бүх санаа нь "нэг зураг 20
 * дэлгүүрийг удирдана". Хуудас солих нь тэр зургийг устгана; хавтас нь арын
 * дэвсгэрт харагдуулсаар байх ба хаахад хэрэглэгч ЯГ байсан газраа буцна —
 * board дахин ачаалагдахгүй, skeleton анивчихгүй, scroll хаяхгүй.
 *
 * ШИНЭ endpoint ХЭРЭГГҮЙ: `GET /api/stores/{id}` нь захиалгыг мөрүүдтэй нь
 * буцаадаг, `OrderEditor` нь `filterCategory`-г аль хэдийн дэмждэг,
 * `PATCH /api/orders/{id}` нь дэлгүүрийн хуудсын ижил дуудлага.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderWithLines } from "@/lib/db/repositories/orders";
import type { StoreRow } from "@/lib/db/repositories/stores";
import type { OrderMode } from "@/lib/config/types";
import type { BoardCategory, BoardStore } from "@/lib/replenish/board";
import { VERDICT, verdictFillStyle } from "@/lib/board/verdict";
import { formatCompactMnt, formatPct } from "@/lib/labels.mn";
import { MiniDecisionMath } from "./MiniDecisionMath";
import { OrderEditor } from "./OrderEditor";
import { WhatIfPanel } from "./WhatIfPanel";
import { Alert, Badge, Button, Drawer, Icon, Skeleton } from "./ui";

interface Detail {
  store: StoreRow;
  mode: OrderMode;
  order: OrderWithLines | null;
}

export function CategoryDrawer({
  store,
  categoryKey,
  onClose,
  onDirty,
  onOpenStore,
}: {
  store: BoardStore | null;
  categoryKey: string | null;
  onClose: () => void;
  /** Захиалга өөрчлөгдсөн — board-ыг дуугүй шинэчлэх */
  onDirty: () => void;
  onOpenStore: (storeId: number) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);

  // storeId-гаар кэшлэнэ — дахин нээхэд шууд гарна
  const cache = useRef(new Map<number, Detail>());

  const open = store != null && categoryKey != null;
  const storeId = store?.storeId ?? null;

  useEffect(() => {
    if (!open || storeId == null) return;
    setError(null);
    setNotice(null);
    setShowWhatIf(false);

    const cached = cache.current.get(storeId);
    if (cached) {
      setDetail(cached);
      return;
    }
    setLoading(true);
    setDetail(null);
    fetch(`/api/stores/${storeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const next: Detail = { store: d.store, mode: d.mode, order: d.order };
        cache.current.set(storeId, next);
        setDetail(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ачаалахад алдаа гарлаа"))
      .finally(() => setLoading(false));
  }, [open, storeId]);

  const editQty = useCallback(
    async (lineId: number, qty: number) => {
      if (!detail?.order || storeId == null) return;
      const orderId = detail.order.id;
      // Оптимист — дэлгүүрийн хуудсын editQty-тэй ижил
      setDetail((prev) =>
        prev?.order
          ? {
              ...prev,
              order: {
                ...prev.order,
                lines: prev.order.lines.map((l) =>
                  l.id === lineId ? { ...l, finalQty: qty, decidedBy: "manual" as OrderMode } : l,
                ),
              },
            }
          : prev,
      );
      setBusy("edit");
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, finalQty: qty }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (data.order) {
          const next: Detail = { ...detail, order: data.order };
          cache.current.set(storeId, next);
          setDetail(next);
        }
        onDirty();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Хадгалахад алдаа гарлаа");
        cache.current.delete(storeId);
      } finally {
        setBusy(null);
      }
    },
    [detail, storeId, onDirty],
  );

  const submit = useCallback(async () => {
    if (!detail?.order || storeId == null) return;
    setBusy("submit");
    setError(null);
    try {
      const res = await fetch(`/api/orders/${detail.order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotice(data.result?.message ?? "Захиалга илгээгдлээ");
      cache.current.delete(storeId);
      onDirty();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Илгээхэд алдаа гарлаа");
    } finally {
      setBusy(null);
    }
  }, [detail, storeId, onDirty]);

  if (!open || !store || !categoryKey) return null;

  const cat: BoardCategory | undefined = store.categories.find((c) => c.key === categoryKey);
  const v = cat?.verdictInfo.verdict ?? store.verdictInfo.verdict;
  const token = VERDICT[v];
  const catLines = detail?.order?.lines.filter((l) => (l.categoryKey ?? "_none") === categoryKey) ?? [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${store.name.replace(/^GS25\s*/, "")} · ${cat?.name ?? "Ангилал"}`}
      badge={
        <>
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={verdictFillStyle(v)}
          >
            {token.glyph} {token.label}
          </span>
          <Badge tone={store.mode === "auto" ? "teal" : "amber"}>
            {store.mode === "auto" ? "АВТОМАТ" : "ГАРААР"}
          </Badge>
        </>
      }
      subtitle={cat?.verdictInfo.headline}
      footer={
        <>
          <Button
            variant="primary"
            size="sm"
            icon={<Icon.sms />}
            loading={busy === "submit"}
            disabled={!detail?.order || detail.order.status === "submitted"}
            onClick={submit}
          >
            {detail?.order?.status === "submitted" ? "Илгээгдсэн" : "Баталгаажуулж илгээх"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Icon.sliders />}
            onClick={() => setShowWhatIf((s) => !s)}
          >
            Хэрэв…
          </Button>
          <button
            type="button"
            onClick={() => onOpenStore(store.storeId)}
            className="ml-auto text-xs font-semibold text-teal-700 hover:text-teal-900"
          >
            Дэлгүүрийн бүрэн хуудас →
          </button>
        </>
      }
    >
      {error && <div className="mb-3"><Alert tone="error" onClose={() => setError(null)}>{error}</Alert></div>}
      {notice && <div className="mb-3"><Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert></div>}

      {/* Ангиллын KPI */}
      {cat && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi
            label="Гараар"
            value={formatPct(cat.metrics.overrideRate)}
            hint={`${Math.round(cat.metrics.overrideRate * cat.metrics.orderLines)} / ${cat.metrics.orderLines} мөр`}
          />
          <Kpi
            label="Зөв гарсан"
            value={cat.metrics.overrideSamples >= 4 ? formatPct(cat.metrics.overrideAccuracy) : "—"}
            hint={
              cat.metrics.overrideSamples >= 4
                ? cat.metrics.overrideAccuracy < 0.5
                  ? "50%-аас доогуур"
                  : "50%-аас дээгүүр"
                : "дата хүрэлцэхгүй"
            }
          />
          <Kpi label="Нөхөлт" value={formatPct(cat.metrics.fillRate)} />
          <Kpi
            label="Захиалга"
            value={formatCompactMnt(cat.metrics.gmv)}
            hint={`${cat.metrics.items} бараа`}
          />
        </div>
      )}

      {cat && cat.verdictInfo.reasons.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-600">
          {cat.verdictInfo.reasons.map((r) => (
            <li key={r} className="flex gap-1.5">
              <span className="text-stone-400">•</span>
              {r}
            </li>
          ))}
        </ul>
      )}

      {showWhatIf && (
        <div className="mb-4">
          <WhatIfPanel
            storeId={store.storeId}
            categoryKey={categoryKey}
            onApplied={() => {
              cache.current.delete(store.storeId);
              onDirty();
            }}
          />
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {!loading && detail?.order && catLines.length > 0 && (
        <div className="space-y-4">
          <MiniDecisionMath lines={catLines} mode={detail.mode} />
          <div>
            <h4 className="mb-2 text-sm font-semibold text-stone-800">
              Бараанууд ({catLines.length})
            </h4>
            {/* OrderEditor-ыг ЯГ байгаагаараа дахин ашиглана */}
            <OrderEditor
              order={detail.order}
              filterCategory={categoryKey}
              busy={busy != null}
              onEditQty={editQty}
            />
          </div>
        </div>
      )}

      {!loading && detail && catLines.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
          Энэ бүлэгт өнөөдөр захиалах бараа алга.
        </p>
      )}
    </Drawer>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-stone-900">{value}</div>
      {hint && <div className="text-[10px] text-stone-400">{hint}</div>}
    </div>
  );
}
