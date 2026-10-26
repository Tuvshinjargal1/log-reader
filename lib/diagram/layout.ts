/**
 * StoreFlow-ийн зангилаануудад координат (x/y) онооно; ирмэгийг cubic-bézier
 * замаар зурна. Хүнд lib-гүй, PURE — SVG рендэрт шууд ашиглана.
 */
import type { FlowEdge, FlowNode, StoreFlow } from "./model";

export interface PositionedNode extends FlowNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PositionedEdge extends FlowEdge {
  path: string;
  width: number;
}

export interface Layout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  nodeW?: number;
  nodeH?: number;
  colGap?: number;
  rowGap?: number;
  padX?: number;
  padY?: number;
  maxEdgeWidth?: number;
}

export function layoutFlow(flow: StoreFlow, opts: LayoutOptions = {}): Layout {
  const nodeW = opts.nodeW ?? 150;
  const nodeH = opts.nodeH ?? 68;
  const colGap = opts.colGap ?? 70;
  const rowGap = opts.rowGap ?? 26;
  const padX = opts.padX ?? 24;
  const padY = opts.padY ?? 24;
  const maxEdgeWidth = opts.maxEdgeWidth ?? 22;

  // Багана тус бүрийн зангилаа
  const stages = new Map<number, FlowNode[]>();
  for (const n of flow.nodes) {
    const arr = stages.get(n.stage);
    if (arr) arr.push(n);
    else stages.set(n.stage, [n]);
  }
  const stageKeys = [...stages.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(...[...stages.values()].map((a) => a.length), 1);
  const colH = maxRows * nodeH + (maxRows - 1) * rowGap;

  const pos = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  for (const stage of stageKeys) {
    const col = stages.get(stage)!;
    const x = padX + stage * (nodeW + colGap);
    const totalH = col.length * nodeH + (col.length - 1) * rowGap;
    const startY = padY + (colH - totalH) / 2;
    col.forEach((n, i) => {
      const y = startY + i * (nodeH + rowGap);
      const pn: PositionedNode = { ...n, x, y, w: nodeW, h: nodeH };
      pos.set(n.id, pn);
      nodes.push(pn);
    });
  }

  const maxVal = Math.max(...flow.edges.map((e) => Math.abs(e.value)), 1);
  const edges: PositionedEdge[] = flow.edges.map((e) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) {
      return { ...e, path: "", width: 1 };
    }
    const x1 = a.x + a.w;
    const y1 = a.y + a.h / 2;
    const x2 = b.x;
    const y2 = b.y + b.h / 2;
    const mx = (x1 + x2) / 2;
    const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
    const width = 2 + (Math.abs(e.value) / maxVal) * (maxEdgeWidth - 2);
    return { ...e, path, width };
  });

  const width =
    padX * 2 + stageKeys.length * nodeW + (stageKeys.length - 1) * colGap;
  const height = padY * 2 + colH;
  return { nodes, edges, width, height };
}
