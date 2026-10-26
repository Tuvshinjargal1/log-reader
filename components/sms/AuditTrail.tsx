"use client";

/**
 * АУДИТ / ТҮҮХ — "хэн, хэзээ, юуг өөрчилсөн".
 *
 * `audit_log` ба `tuning_history` хүснэгтүүд байсан ч UI байхгүй байсан.
 * Аливаа автомат шийдвэрийг эргэн мөшгих боломжтой байх нь засаглалын
 * шаардлага — захирлын "хяналт хэрхэн хийгдэх вэ?" гэсэн асуултыг хаана.
 */
import { useCallback, useEffect, useState } from "react";
import { HELP } from "@/lib/board/helpText";
import { Alert, Badge, Button, HelpToggle, Icon, SectionHeader, Skeleton } from "./ui";

interface AuditEvent {
  id: string;
  at: string;
  kind: "action" | "tuning";
  actor: string;
  title: string;
  detail: string | null;
  storeId: number | null;
  storeName: string | null;
}

export function AuditTrail({ storeId }: { storeId?: number | null }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = storeId != null ? `?storeId=${storeId}&limit=120` : "?limit=120";
    fetch(`/api/audit${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setEvents(d.events ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ачаалахад алдаа гарлаа"))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(load, [load]);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.history className="h-5 w-5" />}
        title="Өөрчлөлтийн түүх"
        description="Тохиргооны өөрчлөлт ба захиалгын үйлдэл — цаг хугацааны дарааллаар."
        right={
          <>
            <Button variant="outline" size="sm" loading={loading} onClick={load}>
              Шинэчлэх
            </Button>
            <HelpToggle>
              {HELP.audit.map((t) => (
                <p key={t} className="mb-1 last:mb-0">{t}</p>
              ))}
            </HelpToggle>
          </>
        }
      />

      {error && <div className="mt-3"><Alert tone="error" onClose={() => setError(null)}>{error}</Alert></div>}

      {events == null && loading && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {events != null && events.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
          Бүртгэл хараахан алга.
        </p>
      )}

      {events != null && events.length > 0 && (
        <ol className="mt-3.5 space-y-0">
          {events.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-3.5 pl-1">
              {/* Цаг хугацааны шугам */}
              {i < events.length - 1 && (
                <span className="absolute left-[9px] top-5 h-full w-px bg-stone-200" aria-hidden />
              )}
              <span
                className={
                  e.kind === "tuning"
                    ? "z-10 mt-1 h-[10px] w-[10px] shrink-0 rounded-full bg-amber-500 ring-2 ring-white"
                    : "z-10 mt-1 h-[10px] w-[10px] shrink-0 rounded-full bg-teal-600 ring-2 ring-white"
                }
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-stone-900">{e.title}</span>
                  <Badge tone={e.kind === "tuning" ? "amber" : "teal"}>
                    {e.kind === "tuning" ? "ТОХИРГОО" : "ҮЙЛДЭЛ"}
                  </Badge>
                  <span className="text-xs text-stone-400">
                    {new Date(e.at.replace(" ", "T") + (e.at.includes("Z") ? "" : "Z")).toLocaleString("mn-MN")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  <span className="font-medium text-stone-600">{e.actor}</span>
                  {e.storeName && <> · {e.storeName}</>}
                  {e.detail && <> · {e.detail}</>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
