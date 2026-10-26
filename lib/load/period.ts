/** Сар → 7 хоног → өдөр гэсэн шатлалтай хугацааны сонголт */
import { rollingMonthRange } from "@/lib/engine/util";
export interface PeriodSelection {
  month: string; // "YYYY-MM"
  week: number | null; // сарын доторх 7 хоногийн индекс (0-ээс)
  day: string | null; // "YYYY-MM-DD"
}

export interface WeekRange {
  index: number;
  from: Date;
  to: Date; // inclusive
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Сарын доторх 7 хоногууд (Даваа гарагаас эхэлж, сарын хилээр тайрна) */
export function monthWeeks(month: string): WeekRange[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);

  const weeks: WeekRange[] = [];
  let cursor = new Date(first);
  let index = 0;

  while (cursor <= last) {
    // Даваа=0 ... Ням=6 болгож хөрвүүлнэ
    const dow = (cursor.getDay() + 6) % 7;
    const weekEnd = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + (6 - dow));
    const to = weekEnd > last ? new Date(last) : weekEnd;

    weeks.push({
      index,
      from: new Date(cursor),
      to,
      label: `${cursor.getMonth() + 1}/${cursor.getDate()} – ${to.getMonth() + 1}/${to.getDate()}`,
    });

    cursor = new Date(to);
    cursor.setDate(cursor.getDate() + 1);
    index++;
  }

  return weeks;
}

/** Долоо хоногийн доторх өдрүүд */
export function weekDays(week: WeekRange): Date[] {
  const days: Date[] = [];
  const cursor = new Date(week.from);
  while (cursor <= week.to) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Сонголтын төгсгөл өдөр (asOf). Цонх үргэлж asOf − 1 сар. */
export function selectionAsOf(sel: PeriodSelection): string {
  if (sel.day) {
    return toYmd(new Date(sel.day + "T00:00:00"));
  }
  const weeks = monthWeeks(sel.month);
  if (sel.week !== null && weeks[sel.week]) {
    return toYmd(weeks[sel.week].to);
  }
  const [y, m] = sel.month.split("-").map(Number);
  const lastOfMonth = toYmd(new Date(y, m, 0));
  const today = toYmd(new Date());
  return lastOfMonth < today ? lastOfMonth : today;
}

/** Сонголтоос from/to (YYYYMMDD, inclusive) — бүгд now−1month цонх */
export function selectionRange(sel: PeriodSelection): { from: string; to: string } {
  return rollingMonthRange(selectionAsOf(sel));
}

export function selectionLabel(sel: PeriodSelection): string {
  const { from, to } = selectionRange(sel);
  return `${prettyYmd(from)} → ${prettyYmd(to)} (сүүлийн 1 сар)`;
}

function prettyYmd(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
