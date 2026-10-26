/**
 * Нэг дэлгүүрийн нөхөн дүүргэлтийн ТӨЛӨВЛӨГӨӨ гаргана: хадгалсан daily_metrics +
 * effective config-оор бараа тус бүрд engine ажиллуулж, санал бүхий (proposed)
 * захиалга үүсгэнэ. Мөр бүрд config + factor snapshot-ыг өөрчлөгдөшгүйгээр авна
 * (диаграм ба аудитын эх сурвалж). Онцгой байдлын дохиог мөн үүсгэнэ.
 */
import type { Db } from "@/lib/db/index";
import type { OrderMode } from "@/lib/config/types";
import { getStore } from "@/lib/db/repositories/stores";
import {
  categoryKeyOf,
  getGlobalDefaults,
  getStoreConfig,
  listItems,
  resolveItemConfig,
} from "@/lib/db/repositories/config";
import {
  getStoreHistory,
  latestOnHand,
} from "@/lib/db/repositories/metrics";
import { createOrder, type OrderLineInput } from "@/lib/db/repositories/orders";
import { audit, clearStoreAlerts, raiseAlert } from "@/lib/db/repositories/ops";
import { computeSuggestion } from "@/lib/engine";
import { addDays } from "@/lib/engine/util";

export interface PlanOptions {
  asOf: string; // YYYYMMDD
  lookbackDays?: number;
}

export interface PlanResult {
  storeId: number;
  orderId: number | null;
  storeMode: OrderMode;
  lineCount: number;
  totalQty: number;
  skipped: number;
}

const DEFAULT_LOOKBACK = 28;

export function planStore(
  db: Db,
  storeId: number,
  opts: PlanOptions,
): PlanResult {
  const store = getStore(db, storeId);
  if (!store) throw new Error(`Дэлгүүр олдсонгүй: ${storeId}`);

  const lookback = opts.lookbackDays ?? DEFAULT_LOOKBACK;
  const from = addDays(opts.asOf, -(lookback - 1));
  const to = opts.asOf;

  const history = getStoreHistory(db, storeId, from, to);
  const items = new Map(listItems(db, storeId).map((it) => [it.itemCd, it]));

  const global = getGlobalDefaults(db);
  const storeCfg = getStoreConfig(db, storeId);
  const storeMode: OrderMode = storeCfg?.mode ?? global.mode;

  clearStoreAlerts(db, storeId);

  const lines: OrderLineInput[] = [];
  let skipped = 0;

  for (const [itemCd, hist] of history) {
    const item = items.get(itemCd);
    if (!item) {
      skipped++;
      continue;
    }
    const resolved = resolveItemConfig(db, storeId, item);
    const onHand = latestOnHand(db, storeId, itemCd) ?? 0;
    const sug = computeSuggestion({
      itemCd,
      history: hist,
      config: resolved.value,
      asOf: opts.asOf,
      onHand,
    });

    // Онцгой байдлын дохио
    if (sug.factors.baseDailyDemand > 0 && onHand <= 0) {
      raiseAlert(db, {
        storeId,
        kind: "stockout_risk",
        severity: "critical",
        itemCd,
        message: `${item.name}: нөөц дууссан, өдрийн эрэлт ${sug.factors.baseDailyDemand.toFixed(1)}`,
      });
    }
    if (sug.factors.lowConfidence && sug.suggestedQty > 0) {
      raiseAlert(db, {
        storeId,
        kind: "low_confidence",
        severity: "warn",
        itemCd,
        message: `${item.name}: прогнозын итгэлцэл бага (${(sug.factors.confidence * 100).toFixed(0)}%)`,
      });
    }

    if (sug.suggestedQty <= 0) {
      skipped++;
      continue;
    }

    lines.push({
      itemCd,
      name: item.name,
      categoryKey: categoryKeyOf(item),
      categoryNm: item.mclsNm ?? "Ангилалгүй",
      price: item.price,
      suggestedQty: sug.suggestedQty,
      finalQty: sug.suggestedQty,
      decidedBy: "auto",
      configSnapshot: resolved,
      factorsSnapshot: sug.factors,
    });
  }

  if (lines.length === 0) {
    return { storeId, orderId: null, storeMode, lineCount: 0, totalQty: 0, skipped };
  }

  const orderId = createOrder(db, {
    storeId,
    mode: storeMode,
    orderDate: opts.asOf,
    status: "proposed",
    lines,
  });

  const totalQty = lines.reduce((a, l) => a + l.finalQty, 0);
  audit(db, {
    action: "plan_store",
    entity: "order",
    entityId: String(orderId),
    after: { storeId, mode: storeMode, lineCount: lines.length, totalQty },
  });

  return { storeId, orderId, storeMode, lineCount: lines.length, totalQty, skipped };
}
