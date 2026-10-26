"use client";

/**
 * "ХЭРЭВ…" СИМУЛЯТОР — параметр батлахаас ӨМНӨ үр дүнг харуулна.
 *
 * Гулсуурыг хөдөлгөхөд түүхэн борлуулалт дээр backtest дахин гүйж, нөхөлт /
 * илүүдэл / алдагдсан борлуулалт хэрхэн өөрчлөгдөхийг шууд харуулна. Ингэснээр
 * "яагаад tune хийх ёстой юм бэ?" гэсэн асуулт тоогоор хариулагдана.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCompactMnt, formatPct, formatPctPoints } from "@/lib/labels.mn";
import { HELP } from "@/lib/board/helpText";
import { Alert, Button, HelpToggle, Icon, SectionHeader, Skeleton, cn } from "./ui";

interface Projection {
  serviceLevel: number;
  coverDays: number;
  fillRate: number;
  cycleServiceLevel: number;
  unmetQty: number;
  overstockQty: number;
  lostSalesMnt: number;
  overstockMnt: number;
  orderQty: number;
}

interface Result {
  itemsEvaluated: number;
  current: Projection;
  proposed: Projection;
  delta: {
    fillRate: number;
    overstockQty: number;
    lostSalesMnt: number;
    overstockMnt: number;
    orderQty: number;
  };
}

export function WhatIfPanel({
  storeId,
  categoryKey,
  initialServiceLevel,
  initialCoverDays,
  onApplied,
}: {
  storeId: number;
  categoryKey?: string | null;
  initialServiceLevel?: number;
  initialCoverDays?: number;
  onApplied?: () => void;
}) {
  const [sl, setSl] = useState(initialServiceLevel ?? 0.95);
  const [cd, setCd] = useState(initialCoverDays ?? 3);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    (serviceLevel: number, coverDays: number) => {
      setLoading(true);
      setError(null);
      fetch("/api/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, categoryKey, serviceLevel, coverDays }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          setResult(d);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Тооцоолоход алдаа гарлаа"))
        .finally(() => setLoading(false));
    },
    [storeId, categoryKey],
  );

  // 300ms debounce — гулсуур хөдөлгөх бүрд backtest гүйлгэхгүй
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(sl, cd), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sl, cd, run]);

  const apply = useCallback(async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          scope: categoryKey ? "category" : "store",
          scopeKey: categoryKey ?? null,
          param: "serviceLevel",
          from: result.current.serviceLevel,
          to: sl,
          reason: `Хэрэв-симулятор: нөхөлт ${formatPctPoints(result.delta.fillRate)}`,
          by: "operator",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotice(`Үйлчилгээний түвшин ${sl} болж батлагдлаа.`);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Батлахад алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }, [result, storeId, categoryKey, sl, onApplied]);

  const changed = result != null && Math.abs(sl - result.current.serviceLevel) > 1e-6;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.sliders className="h-5 w-5" />}
        title="Хэрэв тохиргоог өөрчилвөл?"
        description="Батлахаас өмнө түүхэн борлуулалт дээр туршиж үзнэ."
        right={
          <HelpToggle>
            {HELP.whatIf.map((t) => (
              <p key={t} className="mb-1 last:mb-0">{t}</p>
            ))}
          </HelpToggle>
        }
      />

      {error && <div className="mt-3"><Alert tone="error" onClose={() => setError(null)}>{error}</Alert></div>}
      {notice && <div className="mt-3"><Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert></div>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-baseline justify-between text-xs font-medium uppercase tracking-wide text-stone-500">
            Үйлчилгээний түвшин
            <span className="text-base font-bold tabular-nums text-stone-900">{sl.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.8}
            max={0.99}
            step={0.01}
            value={sl}
            onChange={(e) => setSl(Number(e.target.value))}
            className="mt-2 w-full accent-teal-600"
          />
          <span className="text-[11px] text-stone-400">
            Өндөр = нөөц дуусах эрсдэл бага, харин илүүдэл их
          </span>
        </label>

        <label className="block">
          <span className="flex items-baseline justify-between text-xs font-medium uppercase tracking-wide text-stone-500">
            Нөөцлөх хоног
            <span className="text-base font-bold tabular-nums text-stone-900">{cd}</span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={cd}
            onChange={(e) => setCd(Number(e.target.value))}
            className="mt-2 w-full accent-teal-600"
          />
          <span className="text-[11px] text-stone-400">
            Хэдэн хоногийн эрэлтийг нөөцлөх вэ
          </span>
        </label>
      </div>

      {loading && !result && <Skeleton className="mt-4 h-28 w-full" />}

      {result && (
        <div className={cn("mt-4 transition-opacity", loading && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="py-1.5 text-left font-semibold">Үзүүлэлт</th>
                  <th className="py-1.5 text-right font-semibold">Одоо</th>
                  <th className="py-1.5 text-right font-semibold">Хэрэв</th>
                  <th className="py-1.5 text-right font-semibold">Зөрүү</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <Row
                  label="Нөхөлт"
                  cur={formatPct(result.current.fillRate, 1)}
                  next={formatPct(result.proposed.fillRate, 1)}
                  delta={formatPctPoints(result.delta.fillRate)}
                  good={result.delta.fillRate > 0}
                />
                <Row
                  label="Алдагдсан борлуулалт"
                  cur={formatCompactMnt(result.current.lostSalesMnt)}
                  next={formatCompactMnt(result.proposed.lostSalesMnt)}
                  delta={formatCompactMnt(result.delta.lostSalesMnt)}
                  good={result.delta.lostSalesMnt < 0}
                />
                <Row
                  label="Илүүдэл нөөц (₮)"
                  cur={formatCompactMnt(result.current.overstockMnt)}
                  next={formatCompactMnt(result.proposed.overstockMnt)}
                  delta={formatCompactMnt(result.delta.overstockMnt)}
                  good={result.delta.overstockMnt < 0}
                />
                <Row
                  label="Захиалах хэмжээ (ширхэг)"
                  cur={result.current.orderQty.toLocaleString("mn-MN")}
                  next={result.proposed.orderQty.toLocaleString("mn-MN")}
                  delta={
                    (result.delta.orderQty > 0 ? "+" : "") +
                    result.delta.orderQty.toLocaleString("mn-MN")
                  }
                  good={null}
                />
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              icon={<Icon.check />}
              disabled={!changed}
              loading={busy}
              onClick={apply}
            >
              Батлах
            </Button>
            <span className="text-[11px] text-stone-400">
              {result.itemsEvaluated} барааны түүх дээр тооцов
              {!changed && " · тохиргоо өөрчлөгдөөгүй"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  cur,
  next,
  delta,
  good,
}: {
  label: string;
  cur: string;
  next: string;
  delta: string;
  good: boolean | null;
}) {
  return (
    <tr>
      <td className="py-1.5 text-stone-600">{label}</td>
      {/* Хуучин утга нь дарагдсан — өөрчлөлт нь харагдахуйц байна */}
      <td className="py-1.5 text-right tabular-nums text-stone-400 line-through">{cur}</td>
      <td className="py-1.5 text-right font-semibold tabular-nums text-stone-900">{next}</td>
      <td
        className={cn(
          "py-1.5 text-right text-xs font-semibold tabular-nums",
          good === true ? "text-teal-700" : good === false ? "text-rose-600" : "text-stone-500",
        )}
      >
        {delta}
      </td>
    </tr>
  );
}
