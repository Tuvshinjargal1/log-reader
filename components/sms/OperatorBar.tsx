"use client";

/**
 * Операторын мөр — "нэг хүн 20 дэлгүүр хариуцна" гэдгийг харуулна.
 *
 * `Card` БИШ: энэ нь өгөгдөл биш, "хэн болох"-ын chrome. `/api/operators`
 * унавал нэргүй хувилбар руу буурна — board-ыг ХЭЗЭЭ Ч блоклохгүй.
 */
import { useEffect, useMemo, useState } from "react";
import { cn, Icon } from "./ui";

export interface OperatorInfo {
  id: number;
  name: string;
  email: string | null;
  role: string;
  storeCount: number;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Админ",
  operator: "Оператор",
  viewer: "Харагч",
};

function initials(name: string): string {
  const parts = name.replace(/\./g, ". ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function OperatorBar({
  storeCount,
  autoCount,
  manualCount,
  lastSyncAt,
  selectedId,
  onSelect,
  demoMode,
}: {
  storeCount: number;
  autoCount: number;
  manualCount: number;
  lastSyncAt: string | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  demoMode: boolean;
}) {
  const [operators, setOperators] = useState<OperatorInfo[]>([]);

  useEffect(() => {
    fetch("/api/operators")
      .then((r) => r.json())
      .then((d) => setOperators(d.operators ?? []))
      .catch(() => setOperators([]));
  }, []);

  const current = selectedId != null ? operators.find((o) => o.id === selectedId) : null;
  // Хамгийн олон дэлгүүр хариуцдагийг үндсэн оператор гэж үзнэ
  const primary = current ?? operators.find((o) => o.role === "operator") ?? operators[0] ?? null;

  // `Date.now()`-ыг render дотор дуудвал render цэвэр бус болж, React Compiler
  // memoization-ыг хаядаг. Mount дээр нэг л уншина — танилцуулгын хуудсанд
  // секунд тутам шинэчлэх шаардлагагүй.
  const [mountedAt] = useState(() => Date.now());
  const freshness = useMemo(() => {
    if (!lastSyncAt) return { dot: "bg-stone-300", label: "синк тодорхойгүй" };
    const hours = (mountedAt - new Date(lastSyncAt).getTime()) / 3600_000;
    if (hours <= 12) return { dot: "bg-teal-500", label: "дата шинэлэг" };
    if (hours <= 36) return { dot: "bg-amber-500", label: "дата хоцорсон" };
    return { dot: "bg-rose-500", label: "дата хэт хоцорсон" };
  }, [lastSyncAt, mountedAt]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
        {primary ? initials(primary.name) : <Icon.user className="h-4 w-4" />}
      </span>

      <span className="font-semibold text-stone-900">
        {primary ? primary.name : "Оператор"}
      </span>
      {primary && (
        <span className="text-xs text-stone-400">{ROLE_LABEL[primary.role] ?? primary.role}</span>
      )}

      <span className="text-stone-300">·</span>
      <span className="text-stone-600">
        <strong className="tabular-nums text-stone-900">{storeCount}</strong> дэлгүүр
      </span>
      <span className="text-stone-300">·</span>
      <span className="text-stone-600 tabular-nums">
        {autoCount} автомат / {manualCount} гараар
      </span>

      {/* Хэд хэдэн оператор байвал хамрах хүрээг сэлгэх боломж */}
      {operators.length > 1 && (
        <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-500">
          Хамрах хүрээ
          <select
            value={selectedId ?? ""}
            onChange={(e) => onSelect(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700"
          >
            <option value="">Бүх дэлгүүр</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.storeCount})
              </option>
            ))}
          </select>
        </label>
      )}

      <span
        className={cn("flex items-center gap-1.5 text-xs text-stone-400", operators.length > 1 ? "" : "ml-auto")}
        title={lastSyncAt ? new Date(lastSyncAt).toLocaleString("mn-MN") : undefined}
      >
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", freshness.dot)} />
        {freshness.label}
      </span>

      {demoMode && (
        <span className="rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
          ДЕМО
        </span>
      )}
    </div>
  );
}
