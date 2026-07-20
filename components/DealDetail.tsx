"use client";

import { useState } from "react";
import type { Deal } from "@/lib/types";
import { eventIcon, eventIconColor } from "@/lib/eventIcons";
import { formatAmount } from "@/lib/labels.mn";
import { ReceiptView } from "./ReceiptView";

interface DealDetailProps {
  deal: Deal;
  onShowRawLog: (deal: Deal) => void;
}

const STATUS_MN: Record<string, string> = {
  PAID: "Төлсөн",
  PENDING: "Хүлээгдэж буй",
  SUCCESS: "Амжилттай",
  FAILED: "Амжилтгүй",
  ERROR: "Алдаа",
};

export function DealDetail({ deal, onShowRawLog }: DealDetailProps) {
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <div className="space-y-5 rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
      {/* Errors first — most important for a support person */}
      {deal.errors.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-800">
            Энэ борлуулалтад {deal.errors.length} алдаа бүртгэгдсэн
          </h3>
          <ul className="mt-2 space-y-2">
            {deal.errors.map((err) => (
              <li key={err.entryId} className="text-sm">
                <span className="font-mono text-xs text-red-400">
                  {err.time.slice(0, 8)}
                </span>{" "}
                <span className="text-red-800">{err.explanation}</span>
                {err.location && (
                  <span className="text-red-600"> ({err.location})</span>
                )}
                <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-500">
                  {err.technical}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Basket */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Сагсны бараа
          </h3>
          {deal.basket.length === 0 ? (
            <p className="text-sm text-stone-400">
              Барааны мэдээлэл олдсонгүй (eBarimt илгээгдээгүй байж болно).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                  <th className="py-1.5 font-medium">Бараа</th>
                  <th className="py-1.5 text-right font-medium">Тоо</th>
                  <th className="py-1.5 text-right font-medium">Нэгж үнэ</th>
                  <th className="py-1.5 text-right font-medium">Дүн</th>
                </tr>
              </thead>
              <tbody>
                {deal.basket.map((item, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-1.5 pr-2 text-stone-800">{item.name}</td>
                    <td className="py-1.5 text-right tabular-nums text-stone-600">
                      {item.qty}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-stone-600">
                      {item.unitPrice.toLocaleString("mn-MN")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-stone-800">
                      {item.totalAmount.toLocaleString("mn-MN")}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 font-semibold text-stone-800">Нийт</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-stone-800">
                    {deal.basket.reduce((s, i) => s + i.qty, 0)}
                  </td>
                  <td />
                  <td className="py-1.5 text-right font-semibold tabular-nums text-stone-800">
                    {deal.basket
                      .reduce((s, i) => s + i.totalAmount, 0)
                      .toLocaleString("mn-MN")}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {/* Payment + eBarimt */}
        <section className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Төлбөр
            </h3>
            {deal.payment || deal.paymentMethod ? (
              <dl className="space-y-1 text-sm">
                <Row label="Төрөл" value={deal.paymentMethod ?? deal.payment?.method} />
                {(deal.payment?.amount ?? deal.amount) != null && (
                  <Row
                    label="Дүн"
                    value={formatAmount(deal.payment?.amount ?? deal.amount ?? 0)}
                  />
                )}
                {deal.payment?.status && (
                  <Row
                    label="Төлөв"
                    value={STATUS_MN[deal.payment.status] ?? deal.payment.status}
                    valueClass={
                      deal.payment.status === "PAID" ||
                      deal.payment.status === "SUCCESS"
                        ? "text-emerald-700 font-medium"
                        : undefined
                    }
                  />
                )}
                {deal.payment?.cardPan && (
                  <Row label="Карт" value={deal.payment.cardPan} mono />
                )}
              </dl>
            ) : (
              <p className="text-sm text-stone-400">Төлбөрийн мэдээлэл олдсонгүй.</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              eBarimt
            </h3>
            {deal.ebarimt ? (
              <dl className="space-y-1 text-sm">
                <Row
                  label="Төлөв"
                  value={deal.ebarimt.success ? "Амжилттай үүссэн" : "Үүсээгүй"}
                  valueClass={
                    deal.ebarimt.success
                      ? "text-emerald-700 font-medium"
                      : "text-red-600 font-medium"
                  }
                />
                {deal.ebarimt.lottery && (
                  <Row label="Сугалаа" value={deal.ebarimt.lottery} mono />
                )}
                {deal.ebarimt.ddtd && (
                  <Row label="ДДТД" value={deal.ebarimt.ddtd} mono small />
                )}
              </dl>
            ) : (
              <p className="text-sm text-stone-400">eBarimt мэдээлэл олдсонгүй.</p>
            )}
          </div>
        </section>
      </div>

      {/* Step timeline */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Алхмууд
        </h3>
        <ol className="relative ml-3 space-y-2 border-l border-stone-200 pl-5">
          {deal.events.map((ev, i) => (
            <li key={`${ev.entryId}-${i}`} className="relative text-sm">
              <span
                className={[
                  "absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                  ev.isError ? "bg-red-100" : eventIconColor(ev.kind),
                ].join(" ")}
              >
                {eventIcon(ev.kind)}
              </span>
              <span className="font-mono text-xs text-stone-400">
                {ev.time.slice(0, 8)}
              </span>{" "}
              <span
                className={ev.isError ? "font-medium text-red-700" : "text-stone-700"}
              >
                {ev.title}
              </span>
              {ev.detail && <span className="text-stone-500"> — {ev.detail}</span>}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-stone-100 pt-4">
        {deal.receiptLines && (
          <button
            type="button"
            onClick={() => setShowReceipt((v) => !v)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
          >
            {showReceipt ? "Баримт нуух" : "Баримт харах"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onShowRawLog(deal)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
        >
          Түүхий лог харах
        </button>
      </div>

      {showReceipt && deal.receiptLines && <ReceiptView lines={deal.receiptLines} />}
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
  mono,
  small,
}: {
  label: string;
  value?: string;
  valueClass?: string;
  mono?: boolean;
  small?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-stone-400">{label}</dt>
      <dd
        className={[
          valueClass ?? "text-stone-800",
          mono ? "font-mono" : "",
          small ? "break-all text-xs leading-5" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
