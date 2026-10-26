/**
 * P1a smoke: schema migration + repository + effective config provenance.
 * Ажиллуулах: npx tsx scripts/smoke-db.ts
 */
import { openTestDb } from "../lib/db/index";
import {
  upsertStore,
  listStores,
  getStore,
  clearStoreData,
  deleteStore,
} from "../lib/db/repositories/stores";
import {
  upsertItem,
  setStoreConfig,
  setCategoryConfig,
  setItemConfig,
  resolveItemConfig,
  getItem,
  categoryKeyOf,
} from "../lib/db/repositories/config";
import { upsertDailyMetric, getItemHistory } from "../lib/db/repositories/metrics";
import { createOrder, getLatestOrder, updateLineFinalQty } from "../lib/db/repositories/orders";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
}

const db = openTestDb();

// --- stores ---
const s1 = upsertStore(db, { ip: "10.0.0.1", bizplCd: "V1234", name: "Дэлгүүр А" });
const s1again = upsertStore(db, { ip: "10.0.0.1", name: "Дэлгүүр А2" });
assert(s1 === s1again, "IP давхардал нэг store_id өгөх ёстой");
assert(getStore(db, s1)!.name === "Дэлгүүр А2", "нэр шинэчлэгдэх ёстой");
upsertStore(db, { ip: "10.0.0.2", name: "Дэлгүүр Б" });
assert(listStores(db).length === 2, "2 дэлгүүр байх ёстой");

// --- items + config provenance ---
upsertItem(db, {
  storeId: s1,
  itemCd: "ITM1",
  name: "Кола 0.5",
  mclsCd: "BEV",
  mclsNm: "Ундаа",
  sclsCd: "SODA",
  sclsNm: "Хийжүүлсэн",
  price: 2500,
});
const item = getItem(db, s1, "ITM1")!;
assert(categoryKeyOf(item) === "BEV", "category key = mcls_cd");

// Анх бүх утга global-аас
let r = resolveItemConfig(db, s1, item);
assert(r.value.coverDays === 3, "global cover 3");
assert(r.sources.coverDays === "global", "cover provenance = global");
assert(r.value.mode === "manual", "global mode manual");

// store түвшинд cover=5
setStoreConfig(db, s1, { coverDays: 5, mode: "auto" });
r = resolveItemConfig(db, s1, item);
assert(r.value.coverDays === 5, "store cover 5");
assert(r.sources.coverDays === "store", "cover provenance = store");
assert(r.value.mode === "auto" && r.sources.mode === "store", "store mode auto");

// category түвшинд cover=7 (store-г дарна)
setCategoryConfig(db, s1, "BEV", { coverDays: 7 });
r = resolveItemConfig(db, s1, item);
assert(r.value.coverDays === 7, "category cover 7 overrides store");
assert(r.sources.coverDays === "category", "cover provenance = category");

// item түвшинд cover=2 (бүгдийг дарна)
setItemConfig(db, s1, "ITM1", { coverDays: 2, mode: "manual" });
r = resolveItemConfig(db, s1, item);
assert(r.value.coverDays === 2, "item cover 2 overrides all");
assert(r.sources.coverDays === "item", "cover provenance = item");
assert(r.value.mode === "manual" && r.sources.mode === "item", "item mode manual");

// --- daily metrics ---
upsertDailyMetric(db, { storeId: s1, itemCd: "ITM1", d: "20260701", soldQty: 5, soldAmt: 12500, onHandEnd: 10 });
upsertDailyMetric(db, { storeId: s1, itemCd: "ITM1", d: "20260702", soldQty: 3, soldAmt: 7500, onHandEnd: 7 });
const hist = getItemHistory(db, s1, "ITM1", "20260601", "20260731");
assert(hist.length === 2, "2 өдрийн metric");
assert(hist[0].d === "20260701" && hist[0].soldQty === 5, "эхний өдөр зөв");

// --- orders + manual edit ---
const orderId = createOrder(db, {
  storeId: s1,
  mode: "manual",
  orderDate: "20260703",
  lines: [
    {
      itemCd: "ITM1",
      name: "Кола 0.5",
      categoryKey: "BEV",
      categoryNm: "Ундаа",
      price: 2500,
      suggestedQty: 6,
      finalQty: 6,
      decidedBy: "auto",
      configSnapshot: r.value,
      factorsSnapshot: { avgDaily: 4 },
    },
  ],
});
let ord = getLatestOrder(db, s1)!;
assert(ord.id === orderId, "latest order = created");
assert(ord.totalAmount === 15000, `total 6*2500=15000 got ${ord.totalAmount}`);
assert(ord.lines[0].factorsSnapshot != null, "factors snapshot хадгалагдсан");

updateLineFinalQty(db, orderId, ord.lines[0].id, 10);
ord = getLatestOrder(db, s1)!;
assert(ord.lines[0].finalQty === 10, "final qty засагдсан");
assert(ord.lines[0].decidedBy === "manual", "гараар зассан тул decided_by=manual");
assert(ord.totalAmount === 25000, `засварласны дараа total 10*2500 got ${ord.totalAmount}`);
assert(ord.status === "edited", "статус edited");

// --- clearStoreData: дата цэвэрлэгдэж, дэлгүүр үлдэнэ ---
clearStoreData(db, s1);
assert(getStore(db, s1) != null, "цэвэрлэсний дараа дэлгүүр үлдэх ёстой");
assert(getItemHistory(db, s1, "ITM1", "20260601", "20260731").length === 0, "метрик цэвэрлэгдсэн");
assert(getLatestOrder(db, s1) == null, "захиалга цэвэрлэгдсэн");

// --- deleteStore: бүрэн устгана ---
const before = listStores(db).length;
deleteStore(db, s1);
assert(getStore(db, s1) == null, "дэлгүүр устсан");
assert(listStores(db).length === before - 1, "жагсаалтаас хасагдсан");

console.log("smoke-db: OK");
