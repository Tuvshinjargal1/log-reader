"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { IpListInput, parseIpLines } from "@/components/load/IpListInput";
import { FactorMatrix } from "@/components/sms/FactorMatrix";
import { KpiPanel } from "@/components/sms/KpiPanel";
import { SmsConsole } from "@/components/sms/SmsConsole";
import { AutomationPanel } from "@/components/sms/AutomationPanel";
import { DecisionBoard } from "@/components/sms/DecisionBoard";
import { BoardSkeleton } from "@/components/sms/BoardSkeleton";
import { OperatorBar } from "@/components/sms/OperatorBar";
import { AuditTrail } from "@/components/sms/AuditTrail";
import { TxFleetPanel, type StoreTxRow } from "@/components/sms/TxFleetPanel";
import { TxStatsPanel } from "@/components/sms/TxStatsPanel";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Segmented,
  SectionHeader,
  StatTile,
} from "@/components/sms/ui";
import type { Gs25Branch } from "@/lib/load/types";
import type { FleetStore } from "@/lib/replenish/fleet";
import type { FleetAnalytics } from "@/lib/replenish/analytics";
import type { DecisionBoard as Board } from "@/lib/replenish/board";
import type { AlertRow } from "@/lib/db/repositories/ops";
import type { OutboxRow } from "@/lib/db/repositories/outbox";
import type { Schedule } from "@/lib/db/repositories/schedule";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/diagram/colors";
import { lastNDaysRange, ymdToIso } from "@/lib/sms/suggest";
import { daysBetween } from "@/lib/engine/util";
import { useDemoMode } from "@/lib/board/demoMode";
import type { TxStats } from "@/lib/pos/txStats";

const FleetMap = dynamic(() => import("@/components/sms/FleetMap"), { ssr: false });

const IP_STORAGE_KEY = "load.ipList";
const DEFAULT_BACKFILL = 35;

// ⚠️ `overview` табын VALUE-г солихгүй: runCycle() нь setTab("sms") хийдэг ба
// `overview` нь matrix/map/list гэсэн 3 дэд харагдацыг gate-лэдэг. Зөвхөн
// шошгыг "Тойм" → "Дэлгүүрүүд" болгосон.
type Tab = "board" | "overview" | "performance" | "tx" | "sms" | "automation" | "audit";
type View = "matrix" | "map" | "list";

export default function SmsPage() {
  const router = useRouter();
  const demoMode = useDemoMode();
  const [ipText, setIpText] = useState("");
  const [backfillDays, setBackfillDays] = useState(DEFAULT_BACKFILL);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [tab, setTab] = useState<Tab>("board");
  const [view, setView] = useState<View>("matrix");
  const [setupOpen, setSetupOpen] = useState(false);

  const [board, setBoard] = useState<Board | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardRefreshing, setBoardRefreshing] = useState(false);
  const [operatorId, setOperatorId] = useState<number | null>(null);

  const [branches, setBranches] = useState<Gs25Branch[]>([]);
  const [stores, setStores] = useState<FleetStore[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [analytics, setAnalytics] = useState<FleetAnalytics | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [txRows, setTxRows] = useState<StoreTxRow[] | null>(null);
  const [lastCycle, setLastCycle] = useState<{ planned: number; submitted: number; ranAt: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(IP_STORAGE_KEY);
    if (saved) setIpText(saved);
  }, []);

  useEffect(() => {
    // Демо горимд гадаад host руу дуудлага хийхгүй: mount бүрт цохидог, дэлгүүрийн
    // lat/lng аль хэдийн бөглөгдсөн бол хэрэггүй, танилцуулгын wifi дээр хүлээлт
    // үүсгэх эрсдэлтэй.
    if (demoMode) return;
    fetch("/api/gs25-branches")
      .then((r) => r.json())
      .then((d) => setBranches(d.branches ?? []))
      .catch(() => {});
  }, [demoMode]);

  const range = useMemo(() => lastNDaysRange(backfillDays), [backfillDays]);

  const refreshBoard = useCallback(
    async (opts: { refresh?: boolean } = {}) => {
      setBoardRefreshing(true);
      try {
        const qs = new URLSearchParams();
        if (operatorId != null) qs.set("operatorId", String(operatorId));
        if (opts.refresh) qs.set("refresh", "1");
        const res = await fetch(`/api/board?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setBoard(data.board);
        setBoardError(null);
      } catch (e) {
        setBoardError(e instanceof Error ? e.message : "Шийдвэрийн зураглал ачаалахад алдаа");
      } finally {
        setBoardRefreshing(false);
      }
    },
    [operatorId],
  );

  const refreshFleet = useCallback(async () => {
    const res = await fetch("/api/stores");
    const data = await res.json();
    if (res.ok) {
      setStores(data.stores ?? []);
      setAlerts(data.alerts ?? []);
    }
    setLoaded(true);
  }, []);

  const refreshOutbox = useCallback(async () => {
    const res = await fetch("/api/outbox");
    const data = await res.json();
    if (res.ok) setOutbox(data.messages ?? []);
  }, []);

  useEffect(() => {
    refreshFleet();
    refreshOutbox();
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => setSchedule(d.schedule ?? null))
      .catch(() => {});
  }, [refreshFleet, refreshOutbox]);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  const saveSchedule = useCallback(async (patch: Partial<Schedule>) => {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok) setSchedule(data.schedule);
  }, []);

  const handleIpChange = useCallback((v: string) => {
    setIpText(v);
    localStorage.setItem(IP_STORAGE_KEY, v);
  }, []);

  const runIngest = useCallback(async () => {
    const ips = parseIpLines(ipText).map((p) => p.ip);
    if (ips.length === 0) {
      setError("Дор хаяж нэг IP оруулна уу");
      return;
    }
    setBusy("ingest");
    setError(null);
    setNotice(null);
    setProgress({ done: 0, total: ips.length });

    const CHUNK = 4;
    let ok = 0;
    let failed = 0;
    const failedIps: string[] = [];
    try {
      for (let i = 0; i < ips.length; i += CHUNK) {
        const chunk = ips.slice(i, i + CHUNK);
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ips: chunk, from: range.from, to: range.to }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        for (const r of data.results as { ip: string; ok: boolean }[]) {
          if (r.ok) ok++;
          else {
            failed++;
            failedIps.push(r.ip);
          }
        }
        setProgress({ done: Math.min(i + CHUNK, ips.length), total: ips.length });
        await refreshFleet();
      }
      setNotice(
        `Дата татав: ${ok} дэлгүүр амжилттай${failed ? `, ${failed} холбогдсонгүй (${failedIps.slice(0, 6).join(", ")}${failedIps.length > 6 ? "…" : ""})` : ""}. Дараа нь "Захиалга төлөвлөх" дарна уу.`,
      );
      if (ok > 0) {
        setSetupOpen(false);
        setTxRows(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Дата татахад алдаа гарлаа");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }, [ipText, range, refreshFleet]);

  const runPlan = useCallback(async () => {
    setBusy("plan");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOf: range.to, autoSubmit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const withOrders = data.results.filter(
        (r: { orderId: number | null }) => r.orderId != null,
      ).length;
      const submitted = data.results.filter((r: { submitted?: boolean }) => r.submitted).length;
      setNotice(
        `Төлөвлөгөө гарлаа: ${withOrders} дэлгүүрт захиалга${submitted ? `, ${submitted} автоматаар илгээгдсэн` : ""}.`,
      );
      await Promise.all([refreshFleet(), refreshOutbox(), refreshBoard({ refresh: true })]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Төлөвлөхөд алдаа гарлаа");
    } finally {
      setBusy(null);
    }
  }, [range.to, autoSubmit, refreshFleet, refreshOutbox, refreshBoard]);

  const runAnalytics = useCallback(async () => {
    setBusy("analytics");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/analytics?asOf=${range.to}&lookback=${backfillDays}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Гүйцэтгэл шинжлэхэд алдаа");
    } finally {
      setBusy(null);
    }
  }, [range.to, backfillDays]);

  const loadTxFleet = useCallback(async (refresh = false) => {
    setBusy("tx");
    setError(null);
    try {
      if (refresh) {
        const ids = stores.map((s) => s.id);
        const CHUNK = 6;
        const collected: StoreTxRow[] = [];
        for (let i = 0; i < ids.length; i += CHUNK) {
          const res = await fetch("/api/tx-stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storeIds: ids.slice(i, i + CHUNK), refresh: true }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Алдаа");
          for (const r of data.results ?? []) {
            collected.push({
              storeId: r.storeId,
              name: r.name,
              stats: r.stats,
              source: r.source,
            });
          }
          if (data.errors?.length) {
            setError(
              (data.errors as { error: string }[])
                .slice(0, 3)
                .map((e) => e.error)
                .join("; "),
            );
          }
        }
        setTxRows(collected);
      } else {
        const res = await fetch("/api/tx-stats");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Алдаа");
        setTxRows(
          (data.stores ?? []).map(
            (s: { storeId: number; name: string; stats: StoreTxRow["stats"]; source?: "cache" | "pos" }) => ({
              storeId: s.storeId,
              name: s.name,
              stats: s.stats,
              source: s.source,
            }),
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Гүйлгээний тоо ачаалахад алдаа");
    } finally {
      setBusy(null);
    }
  }, [stores]);

  useEffect(() => {
    if (tab !== "tx") return;
    if (txRows != null) return;
    if (stores.length === 0) return;
    void loadTxFleet(false);
  }, [tab, txRows, stores.length, loadTxFleet]);

  const runCycle = useCallback(async () => {
    setBusy("cycle");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOf: range.to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLastCycle({ planned: data.planned, submitted: data.submitted, ranAt: data.ranAt });
      setNotice(
        `Мөчлөг ажиллав: ${data.planned} дэлгүүрт төлөвлөж, ${data.submitted} автоматаар SMS-ээр илгээв.`,
      );
      await Promise.all([refreshFleet(), refreshOutbox(), refreshBoard({ refresh: true })]);
      const sres = await fetch("/api/schedule");
      const sdata = await sres.json();
      if (sres.ok) setSchedule(sdata.schedule);
      if (data.submitted > 0) setTab("sms");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Мөчлөг ажиллуулахад алдаа");
    } finally {
      setBusy(null);
    }
  }, [range.to, refreshFleet, refreshOutbox, refreshBoard]);

  const stats = useMemo(() => {
    const auto = stores.filter((s) => s.mode === "auto").length;
    const totalQty = stores.reduce((a, s) => a + (s.order?.totalQty ?? 0), 0);
    const totalAmount = stores.reduce((a, s) => a + (s.order?.totalAmount ?? 0), 0);
    const critical = stores.reduce((a, s) => a + s.alerts.critical, 0);
    return { auto, manual: stores.length - auto, totalQty, totalAmount, critical };
  }, [stores]);

  const lastSync = useMemo(() => {
    const times = stores.map((s) => s.lastSyncAt).filter(Boolean) as string[];
    if (times.length === 0) return null;
    return times.sort().at(-1) ?? null;
  }, [stores]);

  const txFleetSummary = useMemo((): TxStats | null => {
    if (!txRows || txRows.length === 0) return null;
    const byDay = new Map<string, { txCount: number; amount: number }>();
    let asOf = "";
    let todayDate = "";
    let todayTx = 0;
    let todayAmt = 0;
    let monthFrom = "";
    let monthTo = "";
    let monthTx = 0;
    let monthAmt = 0;
    let peakHour: TxStats["peakHour"] = null;
    for (const r of txRows) {
      const s = r.stats;
      if (s.asOf > asOf) asOf = s.asOf;
      todayTx += s.today.txCount;
      todayAmt += s.today.amount;
      if (!todayDate || s.today.date > todayDate) todayDate = s.today.date;
      monthTx += s.month.txCount;
      monthAmt += s.month.amount;
      if (!monthFrom || s.month.from < monthFrom) monthFrom = s.month.from;
      if (!monthTo || s.month.to > monthTo) monthTo = s.month.to;
      if (s.peakHour && (!peakHour || s.peakHour.txCount > peakHour.txCount)) {
        peakHour = s.peakHour;
      }
      for (const d of s.daily) {
        const cur = byDay.get(d.date) ?? { txCount: 0, amount: 0 };
        cur.txCount += d.txCount;
        cur.amount += d.amount;
        byDay.set(d.date, cur);
      }
    }
    const daily = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v }));
    let peakDay: TxStats["peakDay"] = null;
    for (const d of daily) {
      if (!peakDay || d.txCount > peakDay.txCount) peakDay = d;
    }
    const dayCount =
      monthFrom && monthTo ? Math.max(1, daysBetween(monthFrom, monthTo) + 1) : 1;
    return {
      asOf,
      avgDailyTx: monthTx / dayCount,
      dayCount,
      today: { date: todayDate || asOf, txCount: todayTx, amount: todayAmt },
      month: { from: monthFrom, to: monthTo, txCount: monthTx, amount: monthAmt },
      peakHour,
      peakDay,
      daily,
    };
  }, [txRows]);

  const go = useCallback((id: number) => router.push(`/sms/stores/${id}`), [router]);

  const hasStores = stores.length > 0;

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {/* --- Толгой --- */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-stone-900">
              Нөхөн дүүргэлтийн төв
            </h2>
            <p className="text-sm text-stone-500">
              Дэлгүүрүүдийн бараа захиалгыг нэг дороос удирдаж, автомат/гараар горимоор ажиллуулна.
            </p>
          </div>
          {hasStores && (
            <div className="flex items-center gap-3 print:hidden">
              {lastSync && !demoMode && (
                <span className="text-xs text-stone-400">
                  Сүүлд синк: {new Date(lastSync).toLocaleString("mn-MN")}
                </span>
              )}
              <Button variant="outline" icon={<Icon.print />} onClick={() => window.print()}>
                Хэвлэх
              </Button>
              {/* Демо горимд POS/IP-ийн зам бүхэлдээ нуугдана — захирал
                  192.168.* хаяг хэзээ ч харах ёсгүй. */}
              {!demoMode && (
                <Button
                  variant="outline"
                  icon={<Icon.gear />}
                  onClick={() => setSetupOpen((v) => !v)}
                >
                  Тохиргоо & Синк
                </Button>
              )}
            </div>
          )}
        </div>

        {/* --- Оператор: нэг хүн N дэлгүүр --- */}
        {hasStores && (
          <OperatorBar
            storeCount={board?.totals.stores ?? stores.length}
            autoCount={board?.totals.autoStores ?? stats.auto}
            manualCount={board?.totals.manualStores ?? stats.manual}
            lastSyncAt={lastSync}
            selectedId={operatorId}
            onSelect={setOperatorId}
            demoMode={demoMode}
          />
        )}

        {/* --- Мэдэгдэл --- */}
        {notice && <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>}
        {error && <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>}

        {/* --- Setup / Sync (демо горимд автоматаар нээгдэхгүй) --- */}
        {(setupOpen || (!hasStores && !demoMode)) && (
          <Card className="p-4 sm:p-5">
            <SectionHeader
              icon={<Icon.sync className="h-5 w-5" />}
              title={hasStores ? "Дата синк" : "Эхлэх — дэлгүүрээ холбоно уу"}
              description="POS-ийн IP хаягуудыг оруулж, борлуулалтын түүхийг татна."
              right={
                hasStores ? (
                  <Button variant="ghost" size="sm" onClick={() => setSetupOpen(false)}>
                    Хаах
                  </Button>
                ) : undefined
              }
            />
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <IpListInput value={ipText} onChange={handleIpChange} disabled={busy != null} />
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-stone-500">
                    Түүх татах хугацаа
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[14, 28, 35, 56].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={busy != null}
                        onClick={() => setBackfillDays(n)}
                        className={[
                          "rounded-lg border px-3 py-1.5 text-sm font-medium",
                          backfillDays === n
                            ? "border-teal-600 bg-teal-50 text-teal-900"
                            : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50",
                        ].join(" ")}
                      >
                        {n} хоног
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-stone-500">
                    {ymdToIso(range.from)} → {ymdToIso(range.to)}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                    disabled={busy != null}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  Автомат горимтой дэлгүүрийн захиалгыг шууд илгээх
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="dark"
                icon={<Icon.sync />}
                loading={busy === "ingest"}
                onClick={runIngest}
              >
                POS-оос дата татах
              </Button>
              {hasStores && (
                <Button
                  variant="primary"
                  loading={busy === "plan"}
                  onClick={runPlan}
                >
                  Захиалга төлөвлөх
                </Button>
              )}
            </div>

            {progress && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-stone-500">
                  <span>{progress.done} / {progress.total} IP татагдлаа</span>
                  <span>{Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-stone-100">
                  <div
                    className="h-2 rounded-full bg-teal-500 transition-all"
                    style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* --- Хоосон төлөв --- */}
        {loaded && !hasStores && !setupOpen && (
          <EmptyState
            icon={<Icon.store className="h-10 w-10" />}
            title="Одоогоор дэлгүүр алга"
            description={
              demoMode
                ? "Демо дата үүсээгүй байна. Терминал дээр «npm run seed:demo:reset» ажиллуулаад серверийг дахин эхлүүлнэ үү."
                : "Дээрх талбарт POS-ийн IP хаягуудаа оруулаад «POS-оос дата татах» дарж эхэлнэ үү."
            }
          />
        )}

        {/* --- Ажлын талбар --- */}
        {hasStores && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Дэлгүүр" value={String(stores.length)} icon={<Icon.store className="h-3.5 w-3.5" />} />
              <StatTile
                label="Автомат горим"
                value={`${stats.auto} / ${stores.length}`}
                hint={`${stats.manual} дэлгүүр гараар`}
              />
              <StatTile label="Захиалах бараа" value={stats.totalQty.toLocaleString("mn-MN")} />
              <StatTile label="Захиалгын дүн" value={Math.round(stats.totalAmount).toLocaleString("mn-MN") + "₮"} />
              {board ? (
                <StatTile
                  label="Гараар өөрчлөлт"
                  value={`${Math.round(board.totals.metrics.overrideRate * 100)}%`}
                  hint={`үүний ${Math.round(board.totals.metrics.overrideAccuracy * 100)}% зөв гарсан`}
                  tone={board.totals.metrics.overrideAccuracy >= 0.6 ? "ok" : undefined}
                />
              ) : (
                <StatTile
                  label="Ноцтой дохио"
                  value={String(stats.critical)}
                  tone={stats.critical > 0 ? "danger" : "ok"}
                  icon={<Icon.alert className="h-3.5 w-3.5" />}
                />
              )}
            </div>

            <div className="print:hidden">
              <Segmented<Tab>
                value={tab}
                onChange={setTab}
                options={[
                  {
                    value: "board",
                    label: "Шийдвэр",
                    icon: <Icon.target />,
                    badge: board
                      ? board.totals.byVerdict.TUNE +
                        board.totals.byVerdict.WATCH +
                        board.totals.byVerdict.DATA
                      : undefined,
                  },
                  { value: "overview", label: "Дэлгүүрүүд", icon: <Icon.grid />, badge: alerts.length },
                  { value: "performance", label: "Гүйцэтгэл", icon: <Icon.chart /> },
                  { value: "tx", label: "Гүйлгээ", icon: <Icon.clock /> },
                  { value: "sms", label: "SMS захиалга", icon: <Icon.sms />, badge: outbox.length },
                  { value: "automation", label: "Автоматжуулалт", icon: <Icon.gear /> },
                  { value: "audit", label: "Түүх", icon: <Icon.history /> },
                ]}
              />
            </div>

            {tab === "board" && (
              <>
                {boardError && (
                  <Alert tone="error">
                    {boardError}
                    <button
                      type="button"
                      onClick={() => refreshBoard({ refresh: true })}
                      className="ml-2 font-semibold underline"
                    >
                      Дахин ачаалах
                    </button>
                  </Alert>
                )}
                {!board && !boardError && <BoardSkeleton />}
                {board && (
                  <DecisionBoard
                    board={board}
                    refreshing={boardRefreshing}
                    onRefresh={() => refreshBoard({ refresh: true })}
                    onOpenStore={go}
                  />
                )}
              </>
            )}

            {tab === "audit" && <AuditTrail />}

            {tab === "overview" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Segmented<View>
                    size="sm"
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "matrix", label: "Матриц", icon: <Icon.grid /> },
                      { value: "map", label: "Газрын зураг", icon: <Icon.map /> },
                      { value: "list", label: "Жагсаалт", icon: <Icon.list /> },
                    ]}
                  />
                  <Button variant="primary" size="sm" loading={busy === "plan"} onClick={runPlan}>
                    Захиалга дахин төлөвлөх
                  </Button>
                </div>

                {view === "matrix" && <FactorMatrix stores={stores} onSelect={go} />}
                {view === "map" && (
                  <FleetMap stores={stores} branches={branches} selectedId={null} onSelect={go} />
                )}
                {view === "list" && <FleetList stores={stores} onSelect={go} />}

                {alerts.length > 0 && <ExceptionsQueue alerts={alerts} stores={stores} onSelect={go} />}
              </div>
            )}

            {tab === "performance" && (
              <div className="space-y-4">
                {!analytics ? (
                  <EmptyState
                    icon={<Icon.chart className="h-10 w-10" />}
                    title="Гүйцэтгэлийн шинжилгээ"
                    description="Түүхэн борлуулалт дээр систем vs энгийн аргыг харьцуулж (backtest), хэмнэлт, нөхөлт, эрүүл мэндийг харуулна."
                  >
                    <Button variant="primary" icon={<Icon.chart />} loading={busy === "analytics"} onClick={runAnalytics}>
                      Гүйцэтгэл шинжлэх
                    </Button>
                  </EmptyState>
                ) : (
                  <>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" loading={busy === "analytics"} onClick={runAnalytics}>
                        Дахин шинжлэх
                      </Button>
                    </div>
                    <KpiPanel data={analytics} />
                  </>
                )}
              </div>
            )}

            {tab === "tx" && (
              <div className="space-y-4">
                {txRows == null ? (
                  <Card className="px-4 py-10 text-center text-sm text-stone-500">
                    {busy === "tx" ? "Гүйлгээний тоо ачаалж байна…" : "Ачаалж байна…"}
                  </Card>
                ) : (
                  <>
                    {txFleetSummary && (
                      <TxStatsPanel
                        stats={txFleetSummary}
                        storeName="бүх дэлгүүр"
                        busy={busy === "tx"}
                        onRefresh={demoMode ? undefined : () => loadTxFleet(true)}
                      />
                    )}
                    <TxFleetPanel
                      rows={txRows}
                      busy={busy === "tx"}
                      onRefreshAll={demoMode ? undefined : () => loadTxFleet(true)}
                      onOpenStore={go}
                    />
                  </>
                )}
              </div>
            )}

            {tab === "sms" && (
              <SmsConsole messages={outbox} />
            )}

            {tab === "automation" && schedule && (
              <AutomationPanel
                schedule={schedule}
                busy={busy != null}
                onSave={saveSchedule}
                onRunCycle={runCycle}
                lastCycle={lastCycle}
              />
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-stone-400 sm:px-6 print:hidden">
        Захиалга SMS/API симуляцаар илгээгдэнэ. Бодит GS25 холболт дараагийн үед.
        {/* Демо горимд ч оператор тохиргоо руу хүрэх зам ҮРГЭЛЖ байх ёстой —
            зориуд дуугүй харагдацтай. */}
        {demoMode && !setupOpen && (
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="ml-2 text-stone-300 transition-colors hover:text-stone-500"
          >
            Тохиргоо
          </button>
        )}
      </footer>
    </div>
  );
}

function FleetList({
  stores,
  onSelect,
}: {
  stores: FleetStore[];
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {stores.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-stone-300 hover:bg-stone-50"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s.status] }} />
              <span className="truncate text-sm font-semibold text-stone-900">{s.name}</span>
              <span className="ml-auto">
                <Badge tone={s.mode === "auto" ? "emerald" : "amber"}>
                  {s.mode === "auto" ? "АВТО" : "ГАР"}
                </Badge>
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-stone-500">
              <span>{STATUS_LABEL[s.status]}</span>
              {s.order && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{s.order.totalQty} ширхэг</span>
                  <span>·</span>
                  <span className="tabular-nums">{s.order.lineCount} бараа</span>
                </>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExceptionsQueue({
  alerts,
  stores,
  onSelect,
}: {
  alerts: AlertRow[];
  stores: FleetStore[];
  onSelect: (id: number) => void;
}) {
  const nameOf = (id: number | null) =>
    stores.find((s) => s.id === id)?.name ?? (id != null ? `#${id}` : "—");
  return (
    <Card className="p-4">
      <SectionHeader
        icon={<Icon.alert className="h-5 w-5" />}
        title={`Анхаарах жагсаалт (${alerts.length})`}
        description="Онцгой байдал — эхлээд эдгээрийг шийднэ."
      />
      <ul className="mt-3 space-y-1.5">
        {alerts.slice(0, 40).map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => a.storeId != null && onSelect(a.storeId)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-stone-50"
            >
              <Badge tone={a.severity === "critical" ? "red" : a.severity === "warn" ? "amber" : "neutral"}>
                {a.severity === "critical" ? "НОЦТОЙ" : a.severity === "warn" ? "АНХААР" : "МЭДЭЭ"}
              </Badge>
              <span className="font-medium text-stone-700">{nameOf(a.storeId)}</span>
              <span className="truncate text-stone-500">— {a.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
