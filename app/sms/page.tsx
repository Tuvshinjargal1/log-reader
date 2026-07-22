"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IpListInput, parseIpLines } from "@/components/load/IpListInput";
import { OrderTable, StorePicker } from "@/components/sms/OrderViews";
import type { Gs25Branch } from "@/lib/load/types";
import {
  buildStoreViews,
  countPeriodDays,
  isoToYmd,
  lastNDaysRange,
  ymdToIso,
} from "@/lib/sms/suggest";
import type { SmsAnalyzeResponse, SmsPosResult } from "@/lib/sms/types";

const IP_STORAGE_KEY = "load.ipList";
const CHUNK_SIZE = 8;
const DEFAULT_COVER_DAYS = 3;
const DEFAULT_PERIOD_DAYS = 7;

export default function SmsPage() {
  const [ipText, setIpText] = useState("");
  const range0 = lastNDaysRange(DEFAULT_PERIOD_DAYS);
  const [endIso, setEndIso] = useState(ymdToIso(range0.to));
  const [coverDays, setCoverDays] = useState(DEFAULT_COVER_DAYS);

  const [branches, setBranches] = useState<Gs25Branch[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [results, setResults] = useState<SmsPosResult[]>([]);
  const [analyzedFrom, setAnalyzedFrom] = useState<string | null>(null);
  const [analyzedTo, setAnalyzedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
        setBranches(data.branches ?? []);
      })
      .catch(() => {
        // нэргүйгээр ч ажиллана
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleIpChange = useCallback((v: string) => {
    setIpText(v);
    localStorage.setItem(IP_STORAGE_KEY, v);
  }, []);

  const periodRange = useMemo(() => {
    const end = new Date(endIso + "T00:00:00");
    if (Number.isNaN(end.getTime())) return lastNDaysRange(DEFAULT_PERIOD_DAYS);
    // сонгосон өдөр = to, from = to − 6 өдөр
    const to = isoToYmd(endIso);
    const start = new Date(end);
    start.setDate(start.getDate() - (DEFAULT_PERIOD_DAYS - 1));
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}`;
    return { from, to };
  }, [endIso]);

  const runAnalysis = useCallback(async () => {
    const ips = parseIpLines(ipText).map((p) => p.ip);
    if (ips.length === 0) {
      setError("Дор хаяж нэг IP хаяг оруулна уу");
      return;
    }
    const { from, to } = periodRange;

    setRunning(true);
    setError(null);
    setResults([]);
    setSelectedKey(null);
    setAnalyzedFrom(null);
    setAnalyzedTo(null);
    setProgress({ done: 0, total: ips.length });

    const collected: SmsPosResult[] = [];
    try {
      for (let i = 0; i < ips.length; i += CHUNK_SIZE) {
        const chunk = ips.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/sms-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ips: chunk, from, to }),
        });
        const data = (await res.json()) as SmsAnalyzeResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        collected.push(...data.results);
        setResults([...collected]);
        setProgress({
          done: Math.min(i + CHUNK_SIZE, ips.length),
          total: ips.length,
        });
      }
      setAnalyzedFrom(from);
      setAnalyzedTo(to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Шинжилгээ хийхэд алдаа гарлаа");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [ipText, periodRange]);

  const periodDays = useMemo(() => {
    if (analyzedFrom && analyzedTo) {
      return countPeriodDays(analyzedFrom, analyzedTo);
    }
    return countPeriodDays(periodRange.from, periodRange.to);
  }, [analyzedFrom, analyzedTo, periodRange]);

  const stores = useMemo(
    () => buildStoreViews(results, branches, periodDays, coverDays),
    [results, branches, periodDays, coverDays],
  );

  const failed = useMemo(() => results.filter((r) => !r.ok), [results]);
  const selected = stores.find((s) => s.key === selectedKey) ?? stores[0] ?? null;

  useEffect(() => {
    if (stores.length > 0 && !selectedKey) {
      setSelectedKey(stores[0].key);
    }
  }, [stores, selectedKey]);

  const totalSuggest = stores.reduce((s, st) => s + st.suggestions.length, 0);

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="mb-1 text-base font-bold text-stone-900">
            SMS auto manager
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Сүүлийн 7 хоногийн борлуулалтаар дэлгүүр бүрт нөхөх барааны санал гаргана.
            Захиалгыг SMS системд гараар оруулахад лавлагаа болгоно.
          </p>

          <div className="grid gap-5 lg:grid-cols-2">
            <IpListInput value={ipText} onChange={handleIpChange} disabled={running} />
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Хугацааны төгсгөл (7 хоног)
                </label>
                <input
                  type="date"
                  value={endIso}
                  onChange={(e) => setEndIso(e.target.value)}
                  disabled={running}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none disabled:bg-stone-50"
                />
                <p className="mt-1.5 text-xs text-stone-500">
                  {ymdToIso(periodRange.from)} → {ymdToIso(periodRange.to)} (
                  {countPeriodDays(periodRange.from, periodRange.to)} хоног)
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Нөөцлөх хоног (cover)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[2, 3, 5, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={running}
                      onClick={() => setCoverDays(n)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-sm font-medium",
                        coverDays === n
                          ? "border-teal-600 bg-teal-50 text-teal-900"
                          : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50",
                      ].join(" ")}
                    >
                      {n} хоног
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-stone-500">
                  Санал = өдрийн дундаж × {coverDays}
                  {` `}− нөөц (байвал)
                </p>
              </div>
            </div>
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
                  style={{
                    width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
                  }}
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

        {stores.length > 0 && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Амжилттай дэлгүүр" value={String(stores.length)} />
              <StatCard
                label="Захиалах бараа (нийт)"
                value={totalSuggest.toLocaleString("mn-MN")}
              />
              <StatCard
                label="Хугацаа"
                value={
                  analyzedFrom && analyzedTo
                    ? `${ymdToIso(analyzedFrom).slice(5)} → ${ymdToIso(analyzedTo).slice(5)}`
                    : "—"
                }
              />
              <StatCard
                label="Холбогдоогүй IP"
                value={String(failed.length)}
                tone={failed.length > 0 ? "warn" : "ok"}
              />
            </section>

            <StorePicker
              stores={stores}
              selectedKey={selected?.key ?? null}
              onSelect={setSelectedKey}
            />

            {selected && <OrderTable store={selected} />}
          </>
        )}

        {failed.length > 0 && results.length > 0 && (
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
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-stone-400 sm:px-6">
        Барааны борлуулалтыг POS -ээс уншина. SMS руу захиалга илгээхгүй — зөвхөн
        санал харуулна.
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
