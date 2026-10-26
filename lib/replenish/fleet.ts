/**
 * Бүх дэлгүүрийн (fleet) нэгдсэн төлөв — газрын зураг, factor sensitivity matrix,
 * exception queue-д зориулсан дата. Хадгалсан хамгийн сүүлийн захиалга +
 * ingestion + дохионоос тооцно (live POS шаардахгүй).
 */
import type { Db } from "@/lib/db/index";
import type { OrderMode } from "@/lib/config/types";
import type { DecisionFactors } from "@/lib/engine/types";
import { listStores } from "@/lib/db/repositories/stores";
import { getGlobalDefaults, getStoreConfig } from "@/lib/db/repositories/config";
import { getLatestOrder } from "@/lib/db/repositories/orders";
import { latestIngestionRun, listOpenAlerts } from "@/lib/db/repositories/ops";
import { clamp } from "@/lib/engine/util";

export type FleetStatus = "healthy" | "stockout" | "tuning" | "offline";

export interface FactorBars {
  dow: number; // -1..1: гараг нөлөө (амралт ↑)
  trend: number; // -1..1: өсөлт/бууралт
  season: number; // -1..1: улирал/баяр
  safety: number; // 0..1: аюулгүйн нөөцийн эзлэх хувь
  stockCoverage: number; // 0..1: одоогийн нөөцийн хангамж
  confidence: number; // 0..1: прогнозын итгэлцэл
}

export interface FleetStore {
  id: number;
  ip: string;
  name: string;
  code: string | null;
  bizplCd: string | null;
  lat: number | null;
  lng: number | null;
  mode: OrderMode;
  status: FleetStatus;
  lastSyncAt: string | null;
  order: {
    id: number;
    orderDate: string;
    status: string;
    lineCount: number;
    totalQty: number;
    totalAmount: number;
  } | null;
  alerts: { critical: number; warn: number };
  factorBars: FactorBars;
}

function aggregateFactors(
  factorsList: DecisionFactors[],
): FactorBars {
  if (factorsList.length === 0) {
    return { dow: 0, trend: 0, season: 0, safety: 0, stockCoverage: 0, confidence: 0 };
  }
  let wSum = 0;
  let dow = 0;
  let trend = 0;
  let season = 0;
  let safetyShare = 0;
  let coverage = 0;
  let conf = 0;
  for (const f of factorsList) {
    const w = Math.max(f.forecastDemand, 0.1); // эрэлтээр жинлэнэ
    wSum += w;
    dow += w * (f.dowFactorAvg - 1);
    trend += w * (f.trend - 1);
    season += w * (f.seasonFactorAvg - 1);
    safetyShare += w * (f.orderUpTo > 0 ? f.safetyStock / f.orderUpTo : 0);
    coverage += w * (f.orderUpTo > 0 ? f.inventoryPosition / f.orderUpTo : 0);
    conf += w * f.confidence;
  }
  return {
    dow: clamp(dow / wSum, -1, 1),
    trend: clamp(trend / wSum, -1, 1),
    season: clamp(season / wSum, -1, 1),
    safety: clamp(safetyShare / wSum, 0, 1),
    stockCoverage: clamp(coverage / wSum, 0, 1),
    confidence: clamp(conf / wSum, 0, 1),
  };
}

const STALE_MS = 1000 * 60 * 60 * 36; // 36 цаг

export function fleetSummary(db: Db): FleetStore[] {
  const global = getGlobalDefaults(db);
  const alerts = listOpenAlerts(db);
  const stores = listStores(db);

  return stores.map((s) => {
    const storeCfg = getStoreConfig(db, s.id);
    const mode: OrderMode = storeCfg?.mode ?? global.mode;
    const order = getLatestOrder(db, s.id);
    const run = latestIngestionRun(db, s.id);

    const storeAlerts = alerts.filter((a) => a.storeId === s.id);
    const critical = storeAlerts.filter((a) => a.severity === "critical").length;
    const warn = storeAlerts.filter((a) => a.severity === "warn").length;

    const factorsList: DecisionFactors[] = order
      ? order.lines
          .map((l) => l.factorsSnapshot as DecisionFactors | null)
          .filter((f): f is DecisionFactors => f != null)
      : [];

    // Төлөв тодорхойлох
    let status: FleetStatus;
    const staleOrOffline =
      !s.lastSyncAt ||
      run?.status === "failed" ||
      Date.now() - new Date(s.lastSyncAt).getTime() > STALE_MS;
    if (!order && staleOrOffline) status = "offline";
    else if (critical > 0) status = "stockout";
    else if (warn > 0) status = "tuning";
    else status = "healthy";

    return {
      id: s.id,
      ip: s.ip,
      name: s.name,
      code: s.code,
      bizplCd: s.bizplCd,
      lat: s.lat,
      lng: s.lng,
      mode,
      status,
      lastSyncAt: s.lastSyncAt,
      order: order
        ? {
            id: order.id,
            orderDate: order.orderDate,
            status: order.status,
            lineCount: order.lines.length,
            totalQty: order.totalQty,
            totalAmount: order.totalAmount,
          }
        : null,
      alerts: { critical, warn },
      factorBars: aggregateFactors(factorsList),
    };
  });
}
