"use client";

import { useCallback, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { FileSummary } from "@/components/FileSummary";
import { OverviewStats } from "@/components/OverviewStats";
import { DealTimeline } from "@/components/DealTimeline";
import { DetailLog } from "@/components/DetailLog";
import {
  mergeParsedFiles,
  parseLogText,
  readFileAsText,
  resetEntryIds,
} from "@/lib/parseFile";
import { buildParsedLog } from "@/lib/buildDeals";
import { DEFAULT_FILTERS } from "@/lib/filter";
import type { Deal, LogFiltersState, ParsedLog } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<ParsedLog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFiltersState>(DEFAULT_FILTERS);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      resetEntryIds();
      const results = [];
      for (const file of files) {
        const text = await readFileAsText(file);
        results.push(parseLogText(text, file.name));
      }
      const { entries, files: metas } = mergeParsedFiles(results);
      const parsed = buildParsedLog(entries, metas);
      setData(parsed);
      setFilters({ ...DEFAULT_FILTERS });
      setSelectedDealId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Файл боловсруулахад алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSelectDeal = useCallback((deal: Deal | null) => {
    if (!deal) {
      setSelectedDealId(null);
      setFilters((f) => ({ ...f, dealEntryIds: null }));
      return;
    }
    setSelectedDealId(deal.id);
    setFilters((f) => ({ ...f, dealEntryIds: deal.entryIds }));
  }, []);

  const handleShowRawLog = useCallback((deal: Deal) => {
    setFilters((f) => ({ ...f, dealEntryIds: deal.entryIds }));
    requestAnimationFrame(() => {
      document.getElementById("detail-log")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const handleJumpToDeal = useCallback((deal: Deal) => {
    setSelectedDealId(deal.id);
    setFilters((f) => ({ ...f, dealEntryIds: deal.entryIds }));
    requestAnimationFrame(() => {
      document
        .getElementById("deal-timeline")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const handleClear = useCallback(() => {
    setData(null);
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedDealId(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              SmartPOS Log Reader
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              GS25 POS лог файлыг хялбар унших хэрэгсэл
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {!data && <UploadZone onFiles={handleFiles} busy={busy} />}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <FileSummary data={data} onClear={handleClear} />
            <UploadZone onFiles={handleFiles} busy={busy} />
            <OverviewStats deals={data.deals} onSelectDeal={handleJumpToDeal} />
            <div id="deal-timeline">
              <DealTimeline
                deals={data.deals}
                selectedId={selectedDealId}
                onSelect={handleSelectDeal}
                onShowRawLog={handleShowRawLog}
              />
            </div>
            <div id="detail-log">
              <DetailLog
                entries={data.entries}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-stone-400 sm:px-6">
        Файл browser дээр л боловсруулагдана. Серверт хадгалагдахгүй.
      </footer>
    </div>
  );
}
