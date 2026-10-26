"use client";

/**
 * Графикуудын хуваалцдаг tooltip бүрхүүл — ирмэгээс хальсан үед эргэж байрлана.
 *
 * Дүрэм: tooltip нь утгыг унших ЦОРЫН ГАНЦ зам байж болохгүй. Бүх тоо нь
 * хүснэгт харагдац эсвэл шууд шошгоор бас хүрэлцэхүйц байна — эндээс зөвхөн
 * дэлгэрэнгүйг нэмнэ. Keyboard focus нь hover-тэй ижлийг харуулна.
 */
import type { ReactNode } from "react";

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function ChartTooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null;
  // Ирмэг рүү ойртвол эсрэг тал руу эргүүлнэ
  const flipX = state.x > 0.62;
  const flipY = state.y > 0.6;
  return (
    <div
      className="pointer-events-none absolute z-20 w-max max-w-[19rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{
        left: `${state.x * 100}%`,
        top: `${state.y * 100}%`,
        transform: `translate(${flipX ? "calc(-100% - 14px)" : "14px"}, ${flipY ? "calc(-100% - 10px)" : "10px"})`,
      }}
    >
      {state.content}
    </div>
  );
}

/** Tooltip доторх "нэр — утга" мөр. Тоо нь баруун талд, tabular. */
export function TipRow({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-px">
      <span className="text-stone-500">{label}</span>
      <span className="font-semibold tabular-nums text-stone-800">
        {value}
        {note && <span className="ml-1 font-normal text-stone-400">{note}</span>}
      </span>
    </div>
  );
}

/** Tooltip-ийн эхний мөр — хамгийн чухал тоо нь ЭХЭНД. */
export function TipHead({
  value,
  caption,
  title,
  right,
}: {
  value: string;
  caption: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-1.5 border-b border-stone-100 pb-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold tabular-nums text-stone-900">{value}</span>
        <span className="text-stone-500">{caption}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="truncate font-medium text-stone-700">{title}</span>
        {right}
      </div>
    </div>
  );
}
