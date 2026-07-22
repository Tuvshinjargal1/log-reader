"use client";

import { useCallback, useMemo, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { FileSummary } from "@/components/FileSummary";
import { AppTabs, type AppTab } from "@/components/AppTabs";
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
import type { CustomerTag, Deal, LogFiltersState, ParsedLog } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<ParsedLog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFiltersState>(DEFAULT_FILTERS);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [tab, setTab] = useState<AppTab>("deals");
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [hourFilter, setHourFilter] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<CustomerTag | null>(null);

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
      setDateFilter(null);
      setHourFilter(null);
      setCustomerFilter(null);
      setTab("deals");
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
    setSelectedDealId(deal.id);
    setFilters((f) => ({ ...f, dealEntryIds: deal.entryIds }));
    setTab("raw");
  }, []);

  const handleJumpToDeal = useCallback((deal: Deal) => {
    setSelectedDealId(deal.id);
    if (deal.date) setDateFilter(deal.date);
    setHourFilter(deal.startTime.slice(0, 2));
    setFilters((f) => ({ ...f, dealEntryIds: deal.entryIds }));
    setTab("deals");
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setDateFilter(date);
    setHourFilter(null);
    setSelectedDealId(null);
    setFilters((f) => ({ ...f, dealEntryIds: null }));
    setTab("deals");
  }, []);

  const handleSelectHour = useCallback((hour: string) => {
    setHourFilter(hour);
    setSelectedDealId(null);
    setFilters((f) => ({ ...f, dealEntryIds: null }));
    setTab("deals");
  }, []);

  const handleClearDealLogFilter = useCallback(() => {
    setSelectedDealId(null);
    setFilters((f) => ({ ...f, dealEntryIds: null }));
  }, []);

  const handleClear = useCallback(() => {
    setData(null);
    setFilters({ ...DEFAULT_FILTERS });
    setSelectedDealId(null);
    setDateFilter(null);
    setHourFilter(null);
    setCustomerFilter(null);
    setError(null);
    setTab("deals");
  }, []);

  const activeDeal = useMemo(() => {
    if (!data || !filters.dealEntryIds) return null;
    return data.deals.find((d) => d.id === selectedDealId) ?? null;
  }, [data, filters.dealEntryIds, selectedDealId]);

  return (
    <div className="min-h-full bg-stone-100 text-stone-900">
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {!data && <UploadZone onFiles={handleFiles} busy={busy} />}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <FileSummary
              data={data}
              onClear={handleClear}
              onReplace={handleFiles}
              busy={busy}
            />

            <AppTabs
              active={tab}
              onChange={setTab}
              dealCount={
                data.deals.filter((d) => {
                  if (dateFilter && d.date !== dateFilter) return false;
                  if (
                    hourFilter &&
                    d.startTime.slice(0, 2) !== hourFilter
                  ) {
                    return false;
                  }
                  if (
                    customerFilter &&
                    !d.customer.tags.includes(customerFilter)
                  ) {
                    return false;
                  }
                  return true;
                }).length
              }
              errorCount={data.errorCount}
            />

            {tab === "overview" && (
              <OverviewStats
                deals={data.deals}
                dateFilter={dateFilter}
                hourFilter={hourFilter}
                onSelectDate={handleSelectDate}
                onSelectHour={handleSelectHour}
                onSelectDeal={handleJumpToDeal}
              />
            )}

            {tab === "deals" && (
              <DealTimeline
                deals={data.deals}
                selectedId={selectedDealId}
                dateFilter={dateFilter}
                hourFilter={hourFilter}
                customerFilter={customerFilter}
                onDateFilter={setDateFilter}
                onHourFilter={setHourFilter}
                onCustomerFilter={setCustomerFilter}
                onSelect={handleSelectDeal}
                onShowRawLog={handleShowRawLog}
              />
            )}

            {tab === "raw" && (
              <DetailLog
                entries={data.entries}
                filters={filters}
                onFiltersChange={setFilters}
                activeDeal={activeDeal}
                onClearDealFilter={handleClearDealLogFilter}
              />
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-stone-400 sm:px-6">
        Файл browser дээр л боловсруулагдана. Серверт хадгалагдахгүй.
      </footer>
    </div>
  );
}
