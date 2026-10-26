/** Захиалгын хуудсыг CSV болгож экспортлоно (хүн SMS системд оруулах лавлагаа). */
import type { OrderWithLines } from "@/lib/db/repositories/orders";

function csvCell(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function orderToCsv(order: OrderWithLines, storeName: string): string {
  const header = [
    "#",
    "Барааны код",
    "Нэр",
    "Ангилал",
    "Нэгж үнэ",
    "Санал",
    "Захиалах",
    "Дүн",
  ];
  const lines: string[] = [];
  lines.push(`# Дэлгүүр: ${storeName}`);
  lines.push(`# Захиалгын огноо: ${order.orderDate}  Горим: ${order.mode}`);
  lines.push(header.map(csvCell).join(","));

  order.lines.forEach((l, i) => {
    lines.push(
      [
        i + 1,
        l.itemCd,
        l.name,
        l.categoryNm ?? "",
        l.price ?? "",
        l.suggestedQty,
        l.finalQty,
        Math.round(l.finalQty * (l.price ?? 0)),
      ]
        .map(csvCell)
        .join(","),
    );
  });

  lines.push(
    ["", "", "", "", "", "", order.totalQty, Math.round(order.totalAmount)]
      .map(csvCell)
      .join(","),
  );
  return lines.join("\n");
}
