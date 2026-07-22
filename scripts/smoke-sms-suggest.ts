import {
  buildSuggestions,
  countPeriodDays,
  lastNDaysRange,
  suggestForItem,
} from "../lib/sms/suggest";
import type { SmsItemSale } from "../lib/sms/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const item = (partial: Partial<SmsItemSale> & Pick<SmsItemSale, "itemCd" | "qty">): SmsItemSale => ({
  name: partial.name ?? partial.itemCd,
  category: partial.category ?? null,
  price: partial.price ?? 1000,
  daysSold: partial.daysSold ?? 7,
  stock: partial.stock ?? null,
  ...partial,
});

// --- suggestForItem ---
{
  const s = suggestForItem(item({ itemCd: "A", qty: 14, stock: null }), 7, 3);
  assert(s.avgDaily === 2, `avgDaily expected 2 got ${s.avgDaily}`);
  assert(s.need === 6, `need expected 6 got ${s.need}`);
  assert(s.suggestQty === 6, `suggest without stock expected 6 got ${s.suggestQty}`);
}

{
  const s = suggestForItem(item({ itemCd: "B", qty: 14, stock: 2 }), 7, 3);
  assert(s.suggestQty === 4, `suggest with stock 2 expected 4 got ${s.suggestQty}`);
}

{
  const s = suggestForItem(item({ itemCd: "C", qty: 14, stock: 10 }), 7, 3);
  assert(s.suggestQty === 0, `overstocked should suggest 0 got ${s.suggestQty}`);
}

{
  const list = buildSuggestions(
    [
      item({ itemCd: "X", qty: 21, stock: null, name: "X" }),
      item({ itemCd: "Y", qty: 7, stock: 5, name: "Y" }),
      item({ itemCd: "Z", qty: 1, stock: 10, name: "Z" }),
    ],
    7,
    3,
  );
  // X: need=9 suggest=9; Y: need=3 suggest=0; Z: need=1 suggest=0
  assert(list.length === 1, `expected 1 suggestion got ${list.length}`);
  assert(list[0].itemCd === "X", `expected X first`);
}

{
  const d = countPeriodDays("20260701", "20260707");
  assert(d === 7, `period days expected 7 got ${d}`);
}

{
  const { from, to } = lastNDaysRange(7, new Date("2026-07-22T12:00:00"));
  // end = yesterday 2026-07-21, from = 2026-07-15
  assert(to === "20260721", `lastNDays to expected 20260721 got ${to}`);
  assert(from === "20260715", `lastNDays from expected 20260715 got ${from}`);
}

console.log("sms suggest smoke: OK");
