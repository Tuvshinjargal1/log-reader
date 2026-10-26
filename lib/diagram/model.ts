/**
 * Захиалгын мөрүүдийн factor snapshot-оос дэлгүүрийн ШИЙДВЭРИЙН УРСГАЛЫГ
 * (decision flow) бүтээнэ. Нэгдсэн (aggregate) утгаар: эрэлт → аюулгүйн нөөц →
 * захиалах түвшин → − нөөц → түүхий захиалга → эцсийн → горим. Зангилаа бүр
 * тоотой, ирмэг өргөн нь хэмжээтэй пропорциональ. PURE — client дээр ажиллана.
 */
import type { OrderMode } from "@/lib/config/types";
import type { DecisionFactors } from "@/lib/engine/types";
import type { OrderLine } from "@/lib/db/repositories/orders";

export type FlowKind =
  | "demand"
  | "safety"
  | "orderup"
  | "inventory"
  | "raw"
  | "final"
  | "mode";

export interface FlowNode {
  id: string;
  stage: number; // багана (0-оос эхэлнэ)
  kind: FlowKind;
  label: string;
  value: number;
  detail: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  value: number;
  sign: "add" | "sub" | "flow";
  label?: string;
}

export interface CategoryNode {
  key: string;
  name: string;
  qty: number;
  lineCount: number;
}

export interface StoreFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  categories: CategoryNode[];
  totals: {
    forecastDemand: number;
    safetyStock: number;
    orderUpTo: number;
    inventoryPosition: number;
    rawQty: number;
    suggested: number;
    mode: OrderMode;
    lineCount: number;
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildStoreFlow(
  lines: OrderLine[],
  mode: OrderMode,
): StoreFlow {
  let forecastDemand = 0;
  let safetyStock = 0;
  let orderUpTo = 0;
  let inventoryPosition = 0;
  let rawQty = 0;
  let suggested = 0;

  const catMap = new Map<string, CategoryNode>();

  for (const l of lines) {
    const f = l.factorsSnapshot as DecisionFactors | null;
    if (f) {
      forecastDemand += f.forecastDemand;
      safetyStock += f.safetyStock;
      orderUpTo += f.orderUpTo;
      inventoryPosition += f.inventoryPosition;
      rawQty += f.rawQty;
    }
    suggested += l.finalQty;

    const key = l.categoryKey ?? "_none";
    const c = catMap.get(key);
    if (c) {
      c.qty += l.finalQty;
      c.lineCount++;
    } else {
      catMap.set(key, {
        key,
        name: l.categoryNm ?? "Ангилалгүй",
        qty: l.finalQty,
        lineCount: 1,
      });
    }
  }

  const nodes: FlowNode[] = [
    {
      id: "demand",
      stage: 0,
      kind: "demand",
      label: "Прогноз эрэлт",
      value: forecastDemand,
      detail: "Ирэх хугацааны эрэлт (μ × гараг × трэнд × улирал)",
    },
    {
      id: "safety",
      stage: 0,
      kind: "safety",
      label: "Аюулгүйн нөөц",
      value: safetyStock,
      detail: "z × σ × √P — гэнэтийн эрэлтийг даах нөөц",
    },
    {
      id: "orderup",
      stage: 1,
      kind: "orderup",
      label: "Захиалах түвшин S",
      value: orderUpTo,
      detail: "S = прогноз эрэлт + аюулгүйн нөөц",
    },
    {
      id: "inventory",
      stage: 1,
      kind: "inventory",
      label: "Одоогийн нөөц",
      value: inventoryPosition,
      detail: "Байгаа + замд яваа нөөц (IP)",
    },
    {
      id: "raw",
      stage: 2,
      kind: "raw",
      label: "Түүхий захиалга",
      value: rawQty,
      detail: "max(0, S − IP)",
    },
    {
      id: "final",
      stage: 3,
      kind: "final",
      label: "Эцсийн захиалга",
      value: suggested,
      detail: "Багц дугуйруулалт + min/max + shelf-life хязгаар",
    },
    {
      id: "mode",
      stage: 4,
      kind: "mode",
      label: mode === "auto" ? "АВТОМАТ" : "ГАРААР",
      value: suggested,
      detail:
        mode === "auto"
          ? "Систем автоматаар баталгаажуулж илгээнэ"
          : "Оператор хянаж, засаад баталгаажуулна",
    },
  ];

  const edges: FlowEdge[] = [
    { from: "demand", to: "orderup", value: forecastDemand, sign: "add" },
    { from: "safety", to: "orderup", value: safetyStock, sign: "add" },
    { from: "orderup", to: "raw", value: orderUpTo, sign: "flow" },
    { from: "inventory", to: "raw", value: inventoryPosition, sign: "sub", label: "хасна" },
    { from: "raw", to: "final", value: rawQty, sign: "flow" },
    { from: "final", to: "mode", value: suggested, sign: "flow" },
  ];

  const categories = [...catMap.values()].sort((a, b) => b.qty - a.qty);

  return {
    nodes: nodes.map((n) => ({ ...n, value: round(n.value) })),
    edges: edges.map((e) => ({ ...e, value: round(e.value) })),
    categories,
    totals: {
      forecastDemand: round(forecastDemand),
      safetyStock: round(safetyStock),
      orderUpTo: round(orderUpTo),
      inventoryPosition: round(inventoryPosition),
      rawQty: round(rawQty),
      suggested: round(suggested),
      mode,
      lineCount: lines.length,
    },
  };
}
