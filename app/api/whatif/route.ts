/**
 * "Хэрэв..." симулятор — параметр батлахаас ӨМНӨ үр дүнг харуулна.
 *
 *  POST { storeId, categoryKey?, serviceLevel, coverDays }
 *    → { current, proposed, delta }
 *
 * Одоо байгаа `backtestItem`-ыг хоёр өөр config-оор гүйлгэнэ — шинэ математик
 * нэмээгүй. Эрэлтээр эрэмбэлсэн дээд N барааг л авна (slider debounce-той тул
 * хариу сөрөг секунд байх ёстой).
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getStoreHistory } from "@/lib/db/repositories/metrics";
import { categoryKeyOf, listItems } from "@/lib/db/repositories/config";
import { prefetchStoreConfigs, resolveFor } from "@/lib/replenish/configBulk";
import { backtestItem, densifyDaily, toDailyPoints } from "@/lib/engine";
import { addDays, clamp } from "@/lib/engine/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Дээд тал нь хэдэн барааг үнэлэх (эрэлтээр эрэмбэлсэн) */
const MAX_ITEMS = 25;
const LOOKBACK_DAYS = 84;
/** backtestItem-ийн MIN_TRAIN (14) + хамгаалалтын цонх — үүнээс доош гүйхгүй */
const MIN_HISTORY_ROWS = 18;

interface Projection {
  serviceLevel: number;
  coverDays: number;
  fillRate: number;
  cycleServiceLevel: number;
  unmetQty: number;
  overstockQty: number;
  lostSalesMnt: number;
  overstockMnt: number;
  orderQty: number;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body шаардлагатай" }, { status: 400 });
  }

  const storeId = Number(body.storeId);
  if (!Number.isFinite(storeId)) {
    return NextResponse.json({ error: "storeId буруу" }, { status: 400 });
  }
  const categoryKey = body.categoryKey != null ? String(body.categoryKey) : null;
  const serviceLevel = clamp(Number(body.serviceLevel), 0.5, 0.99);
  const coverDays = clamp(Math.round(Number(body.coverDays)), 1, 30);
  if (!Number.isFinite(serviceLevel) || !Number.isFinite(coverDays)) {
    return NextResponse.json({ error: "serviceLevel / coverDays буруу" }, { status: 400 });
  }

  try {
    const db = getDb();
    const maxD = (
      db.prepare("SELECT MAX(d) AS d FROM daily_metrics WHERE store_id = ?").get(storeId) as {
        d: string | null;
      }
    ).d;
    if (!maxD) {
      return NextResponse.json({ error: "Энэ дэлгүүрт дата алга" }, { status: 400 });
    }

    const bundle = prefetchStoreConfigs(db, storeId);
    const items = listItems(db, storeId).filter(
      (it) => categoryKey == null || categoryKeyOf(it) === categoryKey,
    );
    const history = getStoreHistory(db, storeId, addDays(maxD, -(LOOKBACK_DAYS - 1)), maxD);

    const ranked = items
      .map((it) => ({
        item: it,
        raw: history.get(it.itemCd) ?? [],
        sold: (history.get(it.itemCd) ?? []).reduce((a, r) => a + r.soldQty, 0),
      }))
      .filter((x) => x.raw.length >= MIN_HISTORY_ROWS)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, MAX_ITEMS);

    if (ranked.length === 0) {
      // Шинэ салбарт (2-3 долоо хоног) backtest гүйлгэх түүх байхгүй. Энэ нь
      // алдаа БИШ — тул шалтгаан ба дараагийн алхмыг тодорхой хэлнэ.
      const maxRows = Math.max(0, ...items.map((it) => (history.get(it.itemCd) ?? []).length));
      return NextResponse.json(
        {
          error:
            `Туршилт гүйлгэхэд түүх хүрэлцэхгүй (хамгийн урт нь ${maxRows} хоног, ` +
            `${MIN_HISTORY_ROWS} хоног шаардлагатай). Шинэ салбарт хэдэн долоо хоног ` +
            `борлуулалт хуримтлагдсаны дараа боломжтой болно.`,
        },
        { status: 400 },
      );
    }

    const run = (sl: number | null, cd: number | null): Projection => {
      const acc = {
        fill: 0, csl: 0, w: 0,
        unmet: 0, overstock: 0, lostMnt: 0, overMnt: 0, orderQty: 0,
      };
      for (const r of ranked) {
        const base = resolveFor(bundle, r.item).value;
        const cfg = { ...base, serviceLevel: sl ?? base.serviceLevel, coverDays: cd ?? base.coverDays };
        const pts = densifyDaily(toDailyPoints(r.raw));
        const bt = backtestItem(pts, cfg, { itemCd: r.item.itemCd, price: r.item.price });
        const price = r.item.price ?? 0;
        const w = Math.max(bt.engine.totalDemand, 0.1);
        acc.w += w;
        acc.fill += w * bt.engine.fillRate;
        acc.csl += w * bt.engine.cycleServiceLevel;
        acc.unmet += bt.engine.totalUnmet;
        acc.overstock += bt.engine.totalOverstock;
        acc.lostMnt += bt.engine.totalUnmet * price;
        acc.overMnt += bt.engine.avgOverstock * price;
        acc.orderQty += bt.engine.totalDemand + bt.engine.avgOverstock;
      }
      const W = Math.max(acc.w, 1e-9);
      return {
        serviceLevel: sl ?? bundle.global.serviceLevel,
        coverDays: cd ?? bundle.global.coverDays,
        fillRate: acc.fill / W,
        cycleServiceLevel: acc.csl / W,
        unmetQty: Math.round(acc.unmet),
        overstockQty: Math.round(acc.overstock),
        lostSalesMnt: Math.round(acc.lostMnt),
        overstockMnt: Math.round(acc.overMnt),
        orderQty: Math.round(acc.orderQty),
      };
    };

    const current = run(null, null);
    const proposed = run(serviceLevel, coverDays);

    return NextResponse.json({
      itemsEvaluated: ranked.length,
      current,
      proposed,
      delta: {
        fillRate: proposed.fillRate - current.fillRate,
        cycleServiceLevel: proposed.cycleServiceLevel - current.cycleServiceLevel,
        unmetQty: proposed.unmetQty - current.unmetQty,
        overstockQty: proposed.overstockQty - current.overstockQty,
        lostSalesMnt: proposed.lostSalesMnt - current.lostSalesMnt,
        overstockMnt: proposed.overstockMnt - current.overstockMnt,
        orderQty: proposed.orderQty - current.orderQty,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
