/**
 * Бүтэн мөчлөг — бүх дэлгүүрт төлөвлөгөө гаргаж, автомат горимтойг нь (сонговол)
 * SMS/API симуляцаар илгээнэ. Хуваарийн last/next run-ыг шинэчилнэ. Windows Task
 * Scheduler эсвэл cron-оос /api/cycle-ийг дуудаж автоматжуулж болно.
 */
import type { Db } from "@/lib/db/index";
import { listStores } from "@/lib/db/repositories/stores";
import { getSchedule, updateSchedule, computeNextRun } from "@/lib/db/repositories/schedule";
import { planStore } from "./planStore";
import { submitOrder } from "@/lib/ordering/submit";

export interface CycleStoreResult {
  storeId: number;
  orderId: number | null;
  storeMode?: string;
  lineCount?: number;
  totalQty?: number;
  submitted: boolean;
  externalRef: string | null;
  error?: string;
}

export interface CycleResult {
  asOf: string;
  planned: number;
  submitted: number;
  results: CycleStoreResult[];
  ranAt: string;
}

export async function runFullCycle(
  db: Db,
  opts: { asOf: string; autoSubmit: boolean; touchSchedule?: boolean },
): Promise<CycleResult> {
  const stores = listStores(db);
  const results: CycleStoreResult[] = [];

  for (const s of stores) {
    try {
      const plan = planStore(db, s.id, { asOf: opts.asOf });
      let submitted = false;
      let externalRef: string | null = null;
      if (opts.autoSubmit && plan.orderId != null && plan.storeMode === "auto") {
        const r = await submitOrder(db, plan.orderId, "auto");
        submitted = r.ok;
        externalRef = r.externalRef;
      }
      results.push({
        storeId: s.id,
        orderId: plan.orderId,
        storeMode: plan.storeMode,
        lineCount: plan.lineCount,
        totalQty: plan.totalQty,
        submitted,
        externalRef,
      });
    } catch (e) {
      results.push({
        storeId: s.id,
        orderId: null,
        submitted: false,
        externalRef: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const ranAt = new Date().toISOString();
  if (opts.touchSchedule !== false) {
    const sched = getSchedule(db);
    updateSchedule(db, {
      lastRunAt: ranAt,
      nextRunAt: computeNextRun(sched.timeOfDay, new Date()),
    });
  }

  return {
    asOf: opts.asOf,
    planned: results.filter((r) => r.orderId != null).length,
    submitted: results.filter((r) => r.submitted).length,
    results,
    ranAt,
  };
}
