"use client";

import { useMemo, useState } from "react";
import type { OrderSuggestion, StoreOrderView } from "@/lib/sms/types";
import { formatAmount } from "@/lib/labels.mn";

interface StorePickerProps {
  stores: StoreOrderView[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function StorePicker({ stores, selectedKey, onSelect }: StorePickerProps) {
  if (stores.length === 0) return null;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Дэлгүүр сонгох ({stores.length})
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => {
          const active = s.key === selectedKey;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                className={[
                  "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
                ].join(" ")}
              >
                <div className="truncate text-sm font-semibold text-stone-900">
                  {s.name}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-500">
                  <span className="font-mono">{s.bizplCd}</span>
                  <span>·</span>
                  <span>{s.suggestions.length} захиалга</span>
                  <span>·</span>
                  <span>{s.itemCount} бараа</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface CategoryGroup {
  name: string;
  items: OrderSuggestion[];
  totalSuggest: number;
}

interface OrderTableProps {
  store: StoreOrderView;
}

export function OrderTable({ store }: OrderTableProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return store.suggestions;
    return store.suggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.itemCd.toLowerCase().includes(q) ||
        (s.category?.toLowerCase().includes(q) ?? false),
    );
  }, [store.suggestions, query]);

  const groups = useMemo((): CategoryGroup[] => {
    const map = new Map<string, OrderSuggestion[]>();
    for (const s of filtered) {
      const key = s.category?.trim() || "Ангилалгүй";
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }

    const out: CategoryGroup[] = [];
    for (const [name, items] of map) {
      items.sort((a, b) => b.suggestQty - a.suggestQty || b.qty - a.qty);
      out.push({
        name,
        items,
        totalSuggest: items.reduce((sum, i) => sum + i.suggestQty, 0),
      });
    }
    out.sort((a, b) => {
      if (a.name === "Ангилалгүй") return 1;
      if (b.name === "Ангилалгүй") return -1;
      return a.name.localeCompare(b.name, "mn");
    });
    return out;
  }, [filtered]);

  function toggleGroup(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    setCollapsed(new Set(groups.map((g) => g.name)));
  }

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">{store.name}</h3>
          <p className="text-xs text-stone-500">
            <span className="font-mono">{store.bizplCd}</span>
            {" · "}
            <span className="font-mono">{store.ip}</span>
            {" · "}
            {store.suggestions.length} бараа · {groups.length} ангилал
            {!store.stockAvailable && (
              <span className="ml-2 text-amber-600">
                (нөөц уншигдаагүй — зөвхөн борлуулалтаар)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр / код / ангилал хайх…"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            Бүгдийг нээх
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            Бүгдийг хураах
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-stone-500">
          Шүүлтэнд тохирох бараа олдсонгүй.
        </p>
      ) : (
        <div className="divide-y divide-stone-200">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.name);
            return (
              <div key={group.name}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="flex w-full items-center gap-3 bg-stone-100 px-4 py-2.5 text-left hover:bg-stone-200/70"
                >
                  <span className="w-4 shrink-0 text-stone-400">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">
                    {group.name}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {group.items.length} бараа
                  </span>
                  <span className="shrink-0 rounded-md bg-teal-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-900">
                    санал {group.totalSuggest.toLocaleString("mn-MN")}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-180 text-left text-sm">
                      <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Бараа</th>
                          <th className="px-3 py-2 text-right font-medium">7 хоног</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Өдөр дундаж
                          </th>
                          <th className="px-3 py-2 text-right font-medium">Нөөц</th>
                          <th className="px-3 py-2 text-right font-medium">Санал</th>
                          <th className="px-3 py-2 text-right font-medium">Үнэ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {group.items.map((row, i) => (
                          <tr key={row.itemCd} className="hover:bg-stone-50/80">
                            <td className="px-3 py-2 text-xs text-stone-400">
                              {i + 1}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-stone-900">
                                {row.name}
                              </div>
                              <div className="font-mono text-xs text-stone-400">
                                {row.itemCd}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                              {row.qty.toLocaleString("mn-MN")}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                              {row.avgDaily.toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-stone-600">
                              {row.stock != null
                                ? row.stock.toLocaleString("mn-MN")
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="inline-block rounded-md bg-teal-100 px-2 py-0.5 font-semibold tabular-nums text-teal-900">
                                {row.suggestQty.toLocaleString("mn-MN")}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                              {row.price != null ? formatAmount(row.price) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
