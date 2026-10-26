/**
 * Танилцуулгын слайд 05-д хэрэгтэй backtest-ийн НЭГТГЭЛ.
 *
 * ЯАГААД тусдаа скрипт вэ: `/api/analytics` нь `overstockReduced`-ыг бүх
 * бараа, бүх ҮЕЧЛЭЛИЙН НИЙЛБЭРЭЭР буцаана. Тэр нийлбэрийг ямар нэг дундаж
 * үечлэлд хуваах нь БУРУУ — үечлэлийн тоо бараа бүрт өөр (6-68). Зөв нь
 * бараа тус бүрийн өдрийн дундажийг гаргаад дараа нь нийлбэрлэх юм.
 *
 *   REPLENISH_DB_PATH=data/demo.db npx tsx scripts/deck/data/collect-backtest.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/lib/db";
import { listStores } from "@/lib/db/repositories/stores";
import { analyzeStore } from "@/lib/replenish/analytics";

const db = getDb();
const asOf = (db.prepare("SELECT MAX(d) d FROM daily_metrics").get() as { d: string }).d;

let dailyExtraMnt = 0;
let lostSalesAvoided = 0;
let engineUnmet = 0;
let baselineUnmet = 0;
let items = 0;

for (const s of listStores(db)) {
  for (const it of analyzeStore(db, s.id, { asOf }).items) {
    const p = it.backtest.evaluatedPeriods;
    if (p <= 0) continue;
    items++;
    // overstockReduced < 0 гэдэг нь engine baseline-аас ИЛҮҮ нөөц барьсан гэсэн үг
    dailyExtraMnt += -it.backtest.overstockReduced / p;
    lostSalesAvoided += it.backtest.lostSalesAvoided;
    engineUnmet += it.backtest.engine.totalUnmet;
    baselineUnmet += it.backtest.baseline.totalUnmet;
  }
}

const out = {
  asOf,
  items,
  /** Флотын хэмжээнд нэг өдөрт дунджаар хэдэн ₮-ийн ИЛҮҮ нөөц барьсан бэ */
  dailyExtraMnt,
  /** Түүнийг 90 хоног барихад гарах зардал (жилийн 50% хадгалалт) */
  holdingCostMnt: (dailyExtraMnt * 0.5 * 90) / 365,
  lostSalesAvoided,
  engineUnmet,
  baselineUnmet,
};
const path = join(process.cwd(), "scripts", "deck", "data", "backtest.json");
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(out);
console.log("→", path);
