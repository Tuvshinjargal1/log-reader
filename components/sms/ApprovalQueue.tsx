"use client";

/**
 * ₮ БОСГОНЫ БАТЛАХ ДАРААЛАЛ — автоматжуулалтын хяналтын механизм.
 *
 * `autoSubmitMaxAmount` нь схемд (schema.ts:24) байсан ч хэрэгждэггүй байсан.
 * Одоо: тогтоосон дүнгээс давсан автомат захиалга шууд илгээгдэхгүй, хүний
 * нүдээр дамжина. Захиралд "автомат гэдэг нь хяналтгүй гэсэн үг биш" гэдгийг
 * харуулах хэсэг.
 *
 * ШИНЭ route ХЭРЭГГҮЙ — board-ын дата дээр л client-side тооцно.
 */
import { useMemo, useState } from "react";
import type { BoardStore } from "@/lib/replenish/board";
import { formatAmount, formatCompactMnt } from "@/lib/labels.mn";
import { HELP } from "@/lib/board/helpText";
import { Alert, Badge, Button, EmptyState, HelpToggle, Icon, SectionHeader } from "./ui";

export function ApprovalQueue({
  stores,
  threshold,
  onSubmitted,
}: {
  stores: BoardStore[];
  threshold: number | null;
  onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pending = useMemo(() => {
    if (threshold == null) return [];
    return stores
      .filter(
        (s) =>
          s.latestOrder != null &&
          s.latestOrder.totalAmount > threshold &&
          s.latestOrder.status !== "submitted" &&
          s.latestOrder.status !== "received",
      )
      .sort((a, b) => (b.latestOrder?.totalAmount ?? 0) - (a.latestOrder?.totalAmount ?? 0));
  }, [stores, threshold]);

  const submit = async (s: BoardStore) => {
    if (!s.latestOrder) return;
    setBusy(s.storeId);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${s.latestOrder.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", by: "operator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotice(`${s.name}: ${data.result?.message ?? "илгээгдлээ"}`);
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Илгээхэд алдаа гарлаа");
    } finally {
      setBusy(null);
    }
  };

  if (threshold == null) {
    return (
      <EmptyState
        icon={<Icon.alert className="h-10 w-10" />}
        title="₮ босго тохируулаагүй"
        description="Автомат илгээх дээд дүнг тохируулбал түүнээс давсан захиалга эндээс батлагдана."
      />
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.check className="h-5 w-5" />}
        title={`Батлах дараалал · ${pending.length}`}
        description={`${formatAmount(threshold)}-аас давсан автомат захиалга хүний баталгаа шаардана.`}
        right={
          <HelpToggle>
            {HELP.approvals.map((t) => (
              <p key={t} className="mb-1 last:mb-0">{t}</p>
            ))}
          </HelpToggle>
        }
      />

      {error && <div className="mt-3"><Alert tone="error" onClose={() => setError(null)}>{error}</Alert></div>}
      {notice && <div className="mt-3"><Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert></div>}

      {pending.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
          Босгоос давсан захиалга алга — бүх автомат захиалга шууд илгээгдсэн.
        </p>
      ) : (
        <ul className="mt-3.5 divide-y divide-stone-100">
          {pending.map((s) => (
            <li key={s.storeId} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-stone-900">{s.name}</span>
                  <Badge tone={s.mode === "auto" ? "teal" : "amber"}>
                    {s.mode === "auto" ? "АВТО" : "ГАР"}
                  </Badge>
                </div>
                <p className="text-xs text-stone-500">
                  {s.latestOrder?.lineCount} бараа ·{" "}
                  {s.latestOrder?.totalQty.toLocaleString("mn-MN")} ширхэг ·{" "}
                  {s.latestOrder?.orderDate}
                </p>
              </div>
              <span className="shrink-0 text-right text-sm font-bold tabular-nums text-stone-900">
                {formatCompactMnt(s.latestOrder?.totalAmount ?? 0)}
                <span className="block text-[10px] font-normal text-amber-700">
                  босгоос {formatCompactMnt((s.latestOrder?.totalAmount ?? 0) - threshold)} их
                </span>
              </span>
              <Button
                variant="primary"
                size="sm"
                icon={<Icon.sms />}
                loading={busy === s.storeId}
                onClick={() => submit(s)}
              >
                Батлах ба илгээх
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
