"use client";

import type { OutboxRow } from "@/lib/db/repositories/outbox";

const STATUS_STYLE: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-800",
  sent: "bg-sky-100 text-sky-800",
  queued: "bg-stone-100 text-stone-600",
  failed: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  delivered: "Хүргэгдсэн",
  sent: "Илгээсэн",
  queued: "Дараалалд",
  failed: "Амжилтгүй",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("mn-MN");
}

export function SmsConsole({
  messages,
  title = "SMS / API захиалгын консол",
}: {
  messages: OutboxRow[];
  title?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
          <p className="text-xs text-stone-500">
            Захиалгын төв рүү илгээгдсэн мессежүүд (симуляц) · дугаар 1348
          </p>
        </div>
        <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-semibold tabular-nums text-stone-600">
          {messages.length} мессеж
        </span>
      </div>

      {messages.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-stone-500">
          Одоогоор илгээсэн захиалга алга. Захиалга баталгаажуулж илгээхэд энд харагдана.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {messages.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-stone-400">→ {m.toNumber}</span>
                <span className={`rounded px-1.5 py-0.5 font-semibold ${STATUS_STYLE[m.status] ?? ""}`}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-500">
                  {m.segments} segment
                </span>
                {m.gatewayRef && (
                  <span className="font-mono text-stone-400">{m.gatewayRef}</span>
                )}
                <span className="ml-auto text-stone-400">{fmtTime(m.createdAt)}</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-stone-900 px-3 py-2 font-mono text-xs leading-relaxed text-stone-100">
                {m.body}
              </pre>
              {m.error && <div className="mt-1 text-xs text-red-600">{m.error}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
