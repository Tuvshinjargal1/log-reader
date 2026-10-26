/**
 * Гүйлгээний KPI (өдөр / сар / оргил цаг / оргил өдөр) smoke.
 * Ажиллуулах: npx tsx scripts/smoke-tx-stats.ts
 */
import { openTestDb } from "../lib/db/index";
import { upsertStore } from "../lib/db/repositories/stores";
import {
  getStoreTxStats,
  hasTxHourly,
  upsertTxHourly,
} from "../lib/db/repositories/txStats";
import { addCalendarMonths } from "../lib/engine/util";
import { selectionRange, toYmd } from "../lib/load/period";
import {
  summarizeTx,
  rollingMonthRange,
  type TxHourlyRow,
} from "../lib/pos/txStats";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

assert(addCalendarMonths("20260902", -1) === "20260802", "09-02 − 1 сар = 08-02");
assert(addCalendarMonths("20260331", -1) === "20260228", "03-31 − 1 сар = 02-28 (2026)");
assert(addCalendarMonths("20240331", -1) === "20240229", "03-31 − 1 сар = 02-29 (өндөр жил)");

const win = rollingMonthRange("20260902");
assert(win.from === "20260802" && win.to === "20260902", "rolling цонх");

const rows: TxHourlyRow[] = [
  { saleDt: "20260901", hour: 8, txCount: 40, amount: 80_000 },
  { saleDt: "20260901", hour: 18, txCount: 90, amount: 200_000 },
  { saleDt: "20260902", hour: 12, txCount: 55, amount: 110_000 },
  { saleDt: "20260902", hour: 19, txCount: 120, amount: 260_000 },
  { saleDt: "20260831", hour: 18, txCount: 999, amount: 1 },
  { saleDt: "20260801", hour: 10, txCount: 7, amount: 1 }, // цонхноос өмнө
];

const s = summarizeTx(rows, "20260902");
assert(s.today.txCount === 175, `өнөөдөр 175, гарсан ${s.today.txCount}`);
assert(s.dayCount === 32, `цонх 32 өдөр, гарсан ${s.dayCount}`);
assert(
  Math.abs(s.avgDailyTx - 1304 / 32) < 1e-9,
  `өдрийн дундаж ${s.avgDailyTx}`,
);
assert(
  s.month.txCount === 999 + 40 + 90 + 55 + 120,
  `сарын нийт (now−1month) ${s.month.txCount}`,
);
assert(s.month.from === "20260802" && s.month.to === "20260902", "сарын цонх");
assert(s.peakHour?.txCount === 999 && s.peakHour.date === "20260831", "оргил цаг");
assert(s.peakDay?.txCount === 999 && s.peakDay.date === "20260831", "оргил өдөр");
assert(
  !s.daily.some((d) => d.date === "20260801"),
  "08-01 цонхноос гадуур",
);

const db = openTestDb();
const id = upsertStore(db, { ip: "10.0.0.9", name: "Тест" });
assert(!hasTxHourly(db, id), "эхэнд хоосон");
upsertTxHourly(db, id, rows);
assert(hasTxHourly(db, id), "бичигдсэн");

const cached = getStoreTxStats(db, id, "20260902");
assert(cached.today.txCount === 175, "кэш өнөөдөр");
assert(cached.peakHour?.txCount === 999, "кэш оргил цаг");
assert(cached.month.txCount === 1304, "кэш сар = now−1month");
assert(cached.month.from === "20260802", "кэш сарын эхлэл");
assert(Math.abs(cached.avgDailyTx - 1304 / 32) < 1e-9, "кэш өдрийн дундаж");

const loadRange = selectionRange({ month: "2026-09", week: null, day: null });
const lastOfSep = toYmd(new Date(2026, 9, 0));
const today = toYmd(new Date());
const asOf = lastOfSep < today ? lastOfSep : today;
assert(loadRange.to === asOf, `load to ${loadRange.to} (хүлээсэн ${asOf})`);
assert(
  loadRange.from === addCalendarMonths(asOf, -1),
  `load from ${loadRange.from}`,
);

console.log("smoke-tx-stats OK");
