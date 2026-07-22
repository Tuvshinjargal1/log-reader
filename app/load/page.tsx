"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IpListInput, parseIpLines } from "@/components/load/IpListInput";
import { PeriodPicker } from "@/components/load/PeriodPicker";
import { BranchRanking } from "@/components/load/BranchRanking";
import { HourlyChart } from "@/components/load/HourlyChart";
import { buildBranchLoads } from "@/lib/load/aggregate";
import { suggestLocations } from "@/lib/load/suggest";
import {
  currentMonth,
  selectionLabel,
  selectionRange,
  type PeriodSelection,
} from "@/lib/load/period";
import type {
  AnalyzeResponse,
  Gs25Branch,
  PosAnalyzeResult,
} from "@/lib/load/types";
import { formatAmount } from "@/lib/labels.mn";

const LoadMap = dynamic(() => import("@/components/load/LoadMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-xl border border-stone-200 bg-white text-sm text-stone-400">
      Газрын зураг ачаалж байна...
    </div>
  ),
});

const IP_STORAGE_KEY = "load.ipList";
const CHUNK_SIZE = 8;

export default function LoadPage() {
  const [ipText, setIpText] = useState("");
  const [period, setPeriod] = useState<PeriodSelection>({
    month: currentMonth(),
    week: null,
    day: null,
  });

  const [branches, setBranches] = useState<Gs25Branch[] | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [results, setResults] = useState<PosAnalyzeResult[]>([]);
  const [analyzedLabel, setAnalyzedLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBizplCd, setSelectedBizplCd] = useState<string | null>(null);
  const [showFailed, setShowFailed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(IP_STORAGE_KEY);
    if (saved) setIpText(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gs25-branches")
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setBranches(data.branches);
      })
      .catch((e) => {
        if (!cancelled)
          setBranchesError(
            e instanceof Error ? e.message : "gs25.mn салбаруудыг татаж чадсангүй",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleIpChange = useCallback((v: string) => {
    setIpText(v);
    localStorage.setItem(IP_STORAGE_KEY, v);
  }, []);

  const runAnalysis = useCallback(async () => {
    const ips = parseIpLines(ipText).map((p) => p.ip);
    if (ips.length === 0) {
      setError("Дор хаяж нэг IP хаяг оруулна уу");
      return;
    }
    const { from, to } = selectionRange(period);

    setRunning(true);
    setError(null);
    setResults([]);
    setSelectedBizplCd(null);
    setAnalyzedLabel(null);
    setProgress({ done: 0, total: ips.length });

    const collected: PosAnalyzeResult[] = [];
    try {
      for (let i = 0; i < ips.length; i += CHUNK_SIZE) {
        const chunk = ips.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ips: chunk, from, to }),
        });
        const data = (await res.json()) as AnalyzeResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        collected.push(...data.results);
        setResults([...collected]);
        setProgress({ done: Math.min(i + CHUNK_SIZE, ips.length), total: ips.length });
      }
      setAnalyzedLabel(selectionLabel(period));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Шинжилгээ хийхэд алдаа гарлаа");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [ipText, period]);

  const loads = useMemo(
    () => buildBranchLoads(results, branches ?? []),
    [results, branches],
  );
  const suggestions = useMemo(
    () => suggestLocations(loads, branches ?? []),
    [loads, branches],
  );
  const failed = useMemo(
    () => results.filter((r) => r.status === "failed"),
    [results],
  );
  const selectedLoad = loads.find((l) => l.bizplCd === selectedBizplCd) ?? null;

  const totalTx = loads.reduce((s, l) => s + l.totalTx, 0);
  const totalAmount = loads.reduce((s, l) => s + l.totalAmount, 0);
  const matchedCount = loads.filter((l) => l.branch).length;

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="mb-4 text-base font-bold text-stone-900">
            Салбарын ачааллын шинжилгээ
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <IpListInput value={ipText} onChange={handleIpChange} disabled={running} />
            <PeriodPicker value={period} onChange={setPeriod} disabled={running} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={running}
              className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
            >
              {running ? "Шинжилж байна..." : "Шинжлэх"}
            </button>
            <span className="text-xs text-stone-500">
              Сонгосон хугацаа: {selectionLabel(period)}
            </span>
            {branchesError && (
              <span className="text-xs text-amber-600">
                gs25.mn: {branchesError} (зэрэглэл ажиллана, зураг тулгагдахгүй)
              </span>
            )}
          </div>

          {progress && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-stone-500">
                <span>
                  {progress.done} / {progress.total} IP шалгагдлаа
                </span>
                <span>{Math.round((progress.done / progress.total) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100">
                <div
                  className="h-2 rounded-full bg-teal-500 transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        {loads.length > 0 && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Шинжлэгдсэн салбар" value={String(loads.length)} />
              <StatCard
                label="Зураг дээр (танигдсан)"
                value={String(matchedCount)}
                tone={matchedCount > 0 ? "ok" : "warn"}
              />
              <StatCard label="Нийт гүйлгээ" value={totalTx.toLocaleString("mn-MN")} />
              <StatCard label="Нийт борлуулалт" value={formatAmount(totalAmount)} />
              <StatCard
                label="Холбогдоогүй IP"
                value={String(failed.length)}
                tone={failed.length > 0 ? "warn" : "ok"}
              />
            </section>

            {analyzedLabel && (
              <p className="text-xs text-stone-500">
                Үр дүн: <b>{analyzedLabel}</b> — том өнгөт дугуй (оноотой) нь танигдсан
                салбар. Цэнхэр ★ нь шинэ салбар нээх санал. Саарал цэг = шинжлэгдээгүй.
              </p>
            )}

            <LoadMap
              branches={branches ?? []}
              loads={loads}
              suggestions={suggestions}
              selectedBizplCd={selectedBizplCd}
              onSelect={setSelectedBizplCd}
            />

            {suggestions.length > 0 && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
                  Шинэ салбар нээх байршлын санал
                </h3>
                <ol className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-sm">
                      <span className="font-semibold text-blue-700">#{i + 1}</span>
                      <span className="text-stone-700">{s.reason}</span>
                      <span className="font-mono text-xs text-stone-400">
                        ({s.lat.toFixed(5)}, {s.lng.toFixed(5)})
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <BranchRanking
                  loads={loads}
                  selectedBizplCd={selectedBizplCd}
                  onSelect={setSelectedBizplCd}
                />
              </div>
              <div className="lg:col-span-2">
                {selectedLoad ? (
                  <HourlyChart load={selectedLoad} />
                ) : (
                  <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/50 p-4 text-center text-sm text-stone-400">
                    Цагийн задаргааг харахын тулд хүснэгт эсвэл зургаас салбар сонгоно уу
                  </div>
                )}
              </div>
            </div>

            {failed.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <button
                  type="button"
                  onClick={() => setShowFailed((v) => !v)}
                  className="text-sm font-semibold text-amber-800"
                >
                  Холбогдож чадаагүй {failed.length} IP {showFailed ? "▲" : "▼"}
                </button>
                {showFailed && (
                  <ul className="mt-2 space-y-1">
                    {failed.map((f) => (
                      <li key={f.ip} className="text-xs text-amber-800">
                        <span className="font-mono">{f.ip}</span>
                        {f.error && <span className="text-amber-600"> — {f.error}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-stone-400 sm:px-6">
        Борлуулалтын өгөгдлийг POS-уудын өгөгдлийн сангаас шууд уншина.
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div
        className={[
          "mt-1 text-xl font-bold tabular-nums",
          tone === "warn"
            ? "text-amber-600"
            : tone === "ok"
              ? "text-emerald-600"
              : "text-stone-900",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
