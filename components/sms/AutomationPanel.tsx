"use client";

import { useState } from "react";
import type { Schedule } from "@/lib/db/repositories/schedule";

interface AutomationPanelProps {
  schedule: Schedule;
  busy?: boolean;
  onSave: (patch: Partial<Schedule>) => void;
  onRunCycle: () => void;
  lastCycle: { planned: number; submitted: number; ranAt: string } | null;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("mn-MN");
}

export function AutomationPanel({
  schedule,
  busy,
  onSave,
  onRunCycle,
  lastCycle,
}: AutomationPanelProps) {
  const [time, setTime] = useState(schedule.timeOfDay);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">Автоматжуулалт</h3>
          <p className="text-sm text-stone-500">
            Бүх дэлгүүрт төлөвлөж, автомат горимтойг нь SMS/API-аар илгээх мөчлөг.
          </p>
        </div>
        <button
          type="button"
          onClick={onRunCycle}
          disabled={busy}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {busy ? "Ажиллаж байна…" : "Бүтэн мөчлөг одоо ажиллуулах"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-stone-200 p-3">
          <label className="flex items-center justify-between text-sm">
            <span className="font-medium text-stone-700">Хуваарь идэвхжүүлэх</span>
            <input
              type="checkbox"
              checked={schedule.enabled}
              disabled={busy}
              onChange={(e) => onSave({ enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="font-medium text-stone-700">Өдөр бүр цаг</span>
            <input
              type="time"
              value={time}
              disabled={busy}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => time !== schedule.timeOfDay && onSave({ timeOfDay: time })}
              className="rounded-lg border border-stone-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span className="font-medium text-stone-700">Автомат горимд шууд илгээх</span>
            <input
              type="checkbox"
              checked={schedule.autoSubmit}
              disabled={busy}
              onChange={(e) => onSave({ autoSubmit: e.target.checked })}
              className="h-4 w-4"
            />
          </label>
          <p className="text-xs text-stone-400">
            Прод дээр Windows Task Scheduler / cron нь өдөр бүр{" "}
            <span className="font-mono">/api/cycle</span>-ийг дуудна.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-stone-200 p-3 text-sm">
          <Row label="Сүүлд ажилласан" value={fmt(schedule.lastRunAt)} />
          <Row
            label="Дараа ажиллах"
            value={schedule.enabled ? fmt(schedule.nextRunAt) : "идэвхгүй"}
          />
          {lastCycle && (
            <div className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-teal-800">
              Сүүлийн мөчлөг: {lastCycle.planned} дэлгүүрт төлөвлөж,{" "}
              <b>{lastCycle.submitted}</b> автоматаар илгээв ({fmt(lastCycle.ranAt)})
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-800">{value}</span>
    </div>
  );
}
