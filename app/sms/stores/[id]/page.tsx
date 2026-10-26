"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DecisionDiagram } from "@/components/sms/DecisionDiagram";
import { OrderEditor } from "@/components/sms/OrderEditor";
import { StorePerformance, type ApplyTuneArgs } from "@/components/sms/StorePerformance";
import { SmsConsole } from "@/components/sms/SmsConsole";
import { TxStatsPanel } from "@/components/sms/TxStatsPanel";
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
  Segmented,
} from "@/components/sms/ui";
import { buildStoreFlow } from "@/lib/diagram/model";
import type { StoreAnalysis } from "@/lib/replenish/analytics";
import type { OutboxRow } from "@/lib/db/repositories/outbox";
import type { OrderWithLines } from "@/lib/db/repositories/orders";
import type { StoreRow } from "@/lib/db/repositories/stores";
import type { OrderMode } from "@/lib/config/types";
import type { IngestionRunRow } from "@/lib/db/repositories/ops";
import type { TxStats } from "@/lib/pos/txStats";
import { useDemoMode } from "@/lib/board/demoMode";

interface Detail {
  store: StoreRow;
  mode: OrderMode;
  order: OrderWithLines | null;
  ingestion: IngestionRunRow | null;
}

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const storeId = Number(params.id);
  const demoMode = useDemoMode();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<"order" | "performance">("order");
  const [analysis, setAnalysis] = useState<StoreAnalysis | null>(null);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [txStats, setTxStats] = useState<TxStats | null>(null);
  const [txSource, setTxSource] = useState<"cache" | "pos" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${storeId}`);
    const data = await res.json();
    if (res.ok) setDetail(data);
    else setError(data.error ?? "Ачаалахад алдаа");
  }, [storeId]);

  const loadOutbox = useCallback(async () => {
    const res = await fetch(`/api/outbox?storeId=${storeId}`);
    const data = await res.json();
    if (res.ok) setOutbox(data.messages ?? []);
  }, [storeId]);

  const loadTx = useCallback(async () => {
    const res = await fetch(`/api/tx-stats?storeId=${storeId}`);
    const data = await res.json();
    if (res.ok && data.stats) {
      setTxStats(data.stats);
      setTxSource(data.source ?? "cache");
    }
  }, [storeId]);

  useEffect(() => {
    load();
    loadOutbox();
    loadTx();
  }, [load, loadOutbox, loadTx]);

  const order = detail?.order ?? null;
  const flow = useMemo(
    () => (order ? buildStoreFlow(order.lines, detail!.mode) : null),
    [order, detail],
  );

  const editQty = useCallback(
    async (lineId: number, qty: number) => {
      if (!order) return;
      // optimistic
      setDetail((d) =>
        d && d.order
          ? {
              ...d,
              order: {
                ...d.order,
                lines: d.order.lines.map((l) =>
                  l.id === lineId ? { ...l, finalQty: qty, decidedBy: "manual" } : l,
                ),
              },
            }
          : d,
      );
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, finalQty: qty }),
        });
        const data = await res.json();
        if (res.ok && data.order) {
          setDetail((d) => (d ? { ...d, order: data.order } : d));
        }
      } catch {
        // optimistic хэвээр
      }
    },
    [order],
  );

  const replan = useCallback(async () => {
    setBusy("plan");
    setError(null);
    setNotice(null);
    try {
      const asOf = order?.orderDate;
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, asOf }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Алдаа");
      await load();
      setNotice("Дахин тооцоолов.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setBusy(null);
    }
  }, [storeId, order?.orderDate, load]);

  const setMode = useCallback(
    async (mode: OrderMode) => {
      setBusy("mode");
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: "store", storeId, patch: { mode } }),
        });
        setDetail((d) => (d ? { ...d, mode } : d));
        setNotice("Горим өөрчлөгдлөө. Дахин тооцоолж шинэ горимд захиалга гаргана уу.");
      } finally {
        setBusy(null);
      }
    },
    [storeId],
  );

  const submit = useCallback(async () => {
    if (!order) return;
    setBusy("submit");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", by: "operator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Илгээхэд алдаа");
      await load();
      await loadOutbox();
      setNotice(
        `Илгээгдлээ: ${data.result?.message ?? data.result?.externalRef ?? "OK"}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setBusy(null);
    }
  }, [order, load, loadOutbox]);

  const loadAnalysis = useCallback(async () => {
    setBusy("analysis");
    setError(null);
    try {
      const asOf = order?.orderDate;
      const res = await fetch(
        `/api/analytics?storeId=${storeId}${asOf ? `&asOf=${asOf}` : ""}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа");
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Гүйцэтгэл ачаалахад алдаа");
    } finally {
      setBusy(null);
    }
  }, [storeId, order?.orderDate]);

  const openPerformance = useCallback(() => {
    setTab("performance");
    if (!analysis) loadAnalysis();
  }, [analysis, loadAnalysis]);

  const refreshTx = useCallback(async () => {
    setBusy("tx");
    setError(null);
    try {
      const res = await fetch("/api/tx-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, refresh: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа");
      const row = data.results?.[0];
      if (row?.stats) {
        setTxStats(row.stats);
        setTxSource(row.source ?? "pos");
      }
      if (data.errors?.length) {
        setError(data.errors[0].error);
      } else {
        setNotice("Гүйлгээний тоог POS-оос шинэчиллээ.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Гүйлгээ татахад алдаа");
    } finally {
      setBusy(null);
    }
  }, [storeId]);

  const applyTune = useCallback(
    async (args: ApplyTuneArgs) => {
      setBusy("tune");
      setError(null);
      setNotice(null);
      try {
        const res = await fetch("/api/tune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, ...args, by: "operator" }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Алдаа");
        setNotice("Тохиргоо шинэчлэгдлээ. Дахин тооцоолж хэрэгжүүлнэ үү.");
        await loadAnalysis();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Алдаа");
      } finally {
        setBusy(null);
      }
    },
    [storeId, loadAnalysis],
  );

  const clearData = useCallback(async () => {
    if (!window.confirm("Энэ дэлгүүрийн бүх татсан дата (метрик, захиалга, SMS) устгах уу? Тохиргоо үлдэнэ.")) return;
    setBusy("delete");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/stores/${storeId}?data=1`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Алдаа");
      setAnalysis(null);
      setTxStats(null);
      await load();
      await loadOutbox();
      await loadTx();
      setNotice("Дата цэвэрлэгдлээ. Дахин ingest хийж болно.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setBusy(null);
    }
  }, [storeId, load, loadOutbox, loadTx]);

  const removeStore = useCallback(async () => {
    if (!window.confirm("Энэ дэлгүүрийг БҮРЭН устгах уу? Буцаах боломжгүй.")) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Алдаа");
      router.push("/sms");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа");
      setBusy(null);
    }
  }, [storeId, router]);

  if (!detail) {
    return (
      <div className="min-h-full bg-stone-100 p-6 text-sm text-stone-500">
        {error ?? "Ачаалж байна…"}
      </div>
    );
  }

  const submitted = order?.status === "submitted";

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <Link href="/sms" className="text-sm text-teal-700 hover:underline">
          ← Бүх дэлгүүр
        </Link>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">{detail.store.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                <span className="font-mono">{detail.store.bizplCd ?? detail.store.ip}</span>
                {detail.ingestion?.finishedAt && (
                  <span>
                    · Сүүлд татсан:{" "}
                    {new Date(detail.ingestion.finishedAt).toLocaleString("mn-MN")}
                  </span>
                )}
                {detail.ingestion?.datasets && (
                  <span className="flex items-center gap-1">
                    <Badge tone={detail.ingestion.datasets.stock ? "emerald" : "neutral"}>нөөц</Badge>
                    <Badge tone={detail.ingestion.datasets.waste ? "emerald" : "neutral"}>хаягдал</Badge>
                    <Badge tone={detail.ingestion.datasets.delivery ? "emerald" : "neutral"}>нийлүүлэлт</Badge>
                    <Badge tone={detail.ingestion.datasets.tx ? "emerald" : txStats?.month.txCount ? "teal" : "neutral"}>гүйлгээ</Badge>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Segmented<OrderMode>
                size="sm"
                value={detail.mode}
                onChange={(m) => setMode(m)}
                options={[
                  { value: "manual", label: "Гараар" },
                  { value: "auto", label: "Автомат" },
                ]}
              />
              <Button variant="outline" size="sm" loading={busy === "plan"} onClick={replan}>
                Дахин тооцоолох
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Icon.trash />}
                disabled={busy != null}
                onClick={clearData}
              >
                Дата цэвэрлэх
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Icon.trash />}
                disabled={busy != null}
                onClick={removeStore}
              >
                Устгах
              </Button>
            </div>
          </div>

          {notice && (
            <div className="mt-3">
              <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>
            </div>
          )}
          {error && (
            <div className="mt-3">
              <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>
            </div>
          )}
        </Card>

        {txStats && (
          <TxStatsPanel
            stats={txStats}
            source={txSource ?? undefined}
            busy={busy === "tx"}
            onRefresh={demoMode ? undefined : refreshTx}
          />
        )}

        <Segmented<"order" | "performance">
          value={tab}
          onChange={(t) => (t === "performance" ? openPerformance() : setTab("order"))}
          options={[
            { value: "order", label: "Захиалга", icon: <Icon.grid /> },
            { value: "performance", label: "Гүйцэтгэл / Tuning", icon: <Icon.chart /> },
          ]}
        />

        {tab === "performance" ? (
          !analysis ? (
            <Card className="px-4 py-10 text-center text-sm text-stone-500">
              {busy === "analysis" ? "Backtest шинжилж байна…" : "Гүйцэтгэл ачаалж байна…"}
            </Card>
          ) : (
            <StorePerformance analysis={analysis} busy={busy != null} onApplyTune={applyTune} />
          )
        ) : !order || flow == null ? (
          <Card className="px-4 py-10 text-center text-sm text-stone-500">
            Захиалга алга. &quot;Дахин тооцоолох&quot; дарж эсвэл эхлэл хуудсаас дата
            татаж төлөвлөнө үү.
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-800">
                Шийдвэрийн урсгал — {order.orderDate}
              </h3>
              <DecisionDiagram
                flow={flow}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-stone-600">
                Нийт{" "}
                <b className="tabular-nums">{order.totalQty.toLocaleString("mn-MN")}</b>{" "}
                ширхэг ·{" "}
                <b className="tabular-nums">
                  {Math.round(order.totalAmount).toLocaleString("mn-MN")}₮
                </b>{" "}
                · төлөв:{" "}
                <span className="font-semibold">{statusLabel(order.status)}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/orders/${order.id}?export=csv`}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                >
                  <Icon.download /> CSV
                </a>
                <Button
                  variant="primary"
                  loading={busy === "submit"}
                  disabled={busy != null || submitted}
                  icon={submitted ? <Icon.check /> : <Icon.sms />}
                  onClick={submit}
                >
                  {submitted ? "Илгээгдсэн" : "Баталгаажуулж илгээх"}
                </Button>
              </div>
            </div>

            <OrderEditor
              order={order}
              filterCategory={selectedCategory}
              busy={busy != null}
              onEditQty={editQty}
            />

            {outbox.length > 0 && (
              <SmsConsole messages={outbox} title="Энэ дэлгүүрийн илгээсэн захиалга" />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    proposed: "Санал",
    edited: "Засварласан",
    confirmed: "Баталгаажсан",
    submitted: "Илгээгдсэн",
    received: "Хүлээн авсан",
    failed: "Амжилтгүй",
    cancelled: "Цуцалсан",
  };
  return m[s] ?? s;
}
