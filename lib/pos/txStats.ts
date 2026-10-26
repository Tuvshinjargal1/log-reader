/**
 * POS гүйлгээний ачааллын үзүүлэлт — өдөр / сар / оргил цаг / оргил өдөр.
 *
 * Эх сурвалж: TP_TR_HDR (чек бүрийг 1 гүйлгээ гэж тоолно). SKU борлуулалтын
 * ширхэгтэй ХОЛИХГҮЙ — нэг чекэнд олон бараа байж болно.
 */
import sql from "mssql";
import { daysBetween, rollingMonthRange } from "@/lib/engine/util";
import { connectPos } from "./connect";
import { HOURLY_TX_QUERY } from "./queries";

export interface TxHourlyRow {
  saleDt: string; // YYYYMMDD
  hour: number; // 0-23
  txCount: number;
  amount: number;
}

export interface TxDayRow {
  date: string;
  txCount: number;
  amount: number;
}

export interface TxPeakHour {
  date: string;
  hour: number;
  txCount: number;
  amount: number;
}

export interface TxStats {
  asOf: string;
  /** Сүүлийн 1 сарын өдрийн дундаж гүйлгээ */
  avgDailyTx: number;
  dayCount: number;
  today: TxDayRow;
  month: { from: string; to: string; txCount: number; amount: number };
  peakHour: TxPeakHour | null;
  peakDay: TxDayRow | null;
  daily: TxDayRow[];
}

export function todayYmd(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

/** Тухайн YYYYMMDD-ийн сарын эхний/сүүлийн өдөр */
export function monthBounds(ymd: string): { from: string; to: string } {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const last = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${ymd.slice(0, 6)}01`,
    to: `${ymd.slice(0, 6)}${pad(last)}`,
  };
}

/** POS-оос татах/кэш унших цонх = сүүлийн 1 сар */
export function statsLookback(asOf: string): { from: string; to: string } {
  return rollingMonthRange(asOf);
}

export { rollingMonthRange } from "@/lib/engine/util";

function emptyDay(date: string): TxDayRow {
  return { date, txCount: 0, amount: 0 };
}

/**
 * Цагийн мөрүүдээс дөрвөн KPI гаргана. Бүгд asOf − 1 сар … asOf цонхонд:
 *   өдрийн гүйлгээ = цонхны өдрийн дундаж
 *   сарын нийт    = цонхны нийлбэр
 *   нэг цагийн max / өдрийн max = цонхны оргил
 */
export function summarizeTx(rows: TxHourlyRow[], asOf: string): TxStats {
  const { from: monthFrom, to: monthEnd } = rollingMonthRange(asOf);
  const windowDays = Math.max(1, daysBetween(monthFrom, monthEnd) + 1);

  const byDay = new Map<string, TxDayRow>();
  let peakHour: TxPeakHour | null = null;
  for (const r of rows) {
    if (r.saleDt < monthFrom || r.saleDt > monthEnd) continue;
    const day = byDay.get(r.saleDt) ?? emptyDay(r.saleDt);
    day.txCount += r.txCount;
    day.amount += r.amount;
    byDay.set(r.saleDt, day);
    if (!peakHour || r.txCount > peakHour.txCount) {
      peakHour = {
        date: r.saleDt,
        hour: r.hour,
        txCount: r.txCount,
        amount: r.amount,
      };
    }
  }

  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  let monthTx = 0;
  let monthAmt = 0;
  let peakDay: TxDayRow | null = null;
  for (const d of daily) {
    monthTx += d.txCount;
    monthAmt += d.amount;
    if (!peakDay || d.txCount > peakDay.txCount) peakDay = d;
  }

  const today = byDay.get(asOf) ?? emptyDay(asOf);

  return {
    asOf,
    avgDailyTx: monthTx / windowDays,
    dayCount: windowDays,
    today,
    month: { from: monthFrom, to: monthEnd, txCount: monthTx, amount: monthAmt },
    peakHour,
    peakDay,
    daily,
  };
}

export async function fetchTxFromPos(
  ip: string,
  from: string,
  to: string,
): Promise<TxHourlyRow[]> {
  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await connectPos(ip);
    const res = await pool
      .request()
      .input("from", sql.VarChar(8), from)
      .input("to", sql.VarChar(8), to)
      .query<{ sale_dt: string; hr: number; tx_cnt: number; amt: number | null }>(
        HOURLY_TX_QUERY,
      );
    return res.recordset
      .filter((r) => r.hr != null && r.sale_dt)
      .map((r) => ({
        saleDt: String(r.sale_dt).trim(),
        hour: Number(r.hr),
        txCount: Number(r.tx_cnt),
        amount: Number(r.amt ?? 0),
      }))
      .filter((r) => r.hour >= 0 && r.hour <= 23 && /^\d{8}$/.test(r.saleDt));
  } finally {
    try {
      await pool?.close();
    } catch {
      // ignore
    }
  }
}
