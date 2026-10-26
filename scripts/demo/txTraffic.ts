/**
 * Демо гүйлгээний цагийн задаргаа.
 *
 * SKU борлуулалтын ширхгээс чекийн тоо гаргана (сагсны дундаж ~2.6 бараа),
 * дараа нь GS25 24 цагийн хэв маягаар цагт хуваана. Детерминистик rng —
 * seed дахин ажиллуулахад ижил тоо гарна.
 */
import { dowOf } from "@/lib/engine/util";
import type { TxHourlyRow } from "@/lib/pos/txStats";
import { gauss, streamFor, type Rng } from "./rng";

/** Шөнийн бага, өглөө/үд/оройн оргил — харьцангуй жин */
const HOUR_SHAPE = [
  0.7, 0.4, 0.25, 0.2, 0.22, 0.45, // 00-05
  1.1, 2.4, 3.2, 2.6, 2.1, 2.3, // 06-11
  3.6, 3.0, 2.2, 2.0, 2.4, 3.2, // 12-17
  4.0, 3.5, 2.7, 2.1, 1.5, 1.0, // 18-23
];
const SHAPE_SUM = HOUR_SHAPE.reduce((a, b) => a + b, 0);

export function synthesizeHourlyTx(
  storeSlot: number,
  daily: Map<string, { qty: number; amt: number }>,
  sizeFactor: number,
): TxHourlyRow[] {
  const rng = streamFor(storeSlot, 4242);
  const rows: TxHourlyRow[] = [];
  const dates = [...daily.keys()].sort();
  for (const d of dates) {
    const tot = daily.get(d)!;
    const basket = 2.2 + rng() * 1.1;
    const baseTx = Math.max(8, Math.round((tot.qty / basket) * sizeFactor));
    const weekend = dowOf(d) === 0 || dowOf(d) === 6 ? 1.12 : 1;
    const dailyTx = Math.max(4, Math.round(baseTx * weekend * (0.92 + rng() * 0.16)));
    const parts = splitHours(dailyTx, tot.amt, rng, d);
    for (const p of parts) {
      if (p.txCount <= 0) continue;
      rows.push({ saleDt: d, hour: p.hour, txCount: p.txCount, amount: p.amount });
    }
  }
  return rows;
}

function splitHours(
  dailyTx: number,
  dailyAmt: number,
  rng: Rng,
  d: string,
): { hour: number; txCount: number; amount: number }[] {
  const dow = dowOf(d);
  const eveningBoost = dow === 5 || dow === 6 ? 1.15 : 1;
  const weights = HOUR_SHAPE.map((w, h) => {
    const eve = h >= 17 && h <= 21 ? eveningBoost : 1;
    const noise = Math.max(0.15, 1 + gauss(rng) * 0.12);
    return w * eve * noise;
  });
  const wSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / wSum) * dailyTx);
  const counts = raw.map((x) => Math.max(0, Math.floor(x)));
  let leftover = dailyTx - counts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, h) => ({ h, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (leftover > 0 && order.length > 0) {
    counts[order[i % order.length].h] += 1;
    leftover--;
    i++;
  }

  const txSum = Math.max(counts.reduce((a, b) => a + b, 0), 1);
  return counts.map((tx, hour) => ({
    hour,
    txCount: tx,
    amount: dailyAmt * (tx / txSum),
  }));
}
