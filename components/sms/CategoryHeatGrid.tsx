"use client";

/**
 * ДЭЛГҮҮР × АНГИЛАЛ — аль дэлгүүрийн аль бүлэгт юу болж байгааг нэг дор.
 *
 * Нүд бүр ХОЁР суваг л агуулна: өнгө (шийдвэр) + тэмдэг (өнгөгүй ч уншигдана).
 * Хэмжээ (₮) нь нүдэнд ОРОХГҮЙ — мөрийн төгсгөлийн баганад байна. Нүд тутам
 * гурав дахь суваг нэмбэл уншилтын дээд хязгаараас давна.
 *
 * ⚠️ Хоёр өөр "хоосон":
 *    хүрээтэй хоосон чип = хэмжих дата хүрэлцэхгүй ("хэлж чадахгүй")
 *    огт хоосон нүд      = тэр бүлэгт захиалах юм байхгүй
 * Эдгээрийг хольж БОЛОХГҮЙ.
 */
import { useMemo, useState } from "react";
import type { BoardCategory, BoardStore, Verdict } from "@/lib/replenish/board";
import { VERDICT, VERDICT_LEGEND, verdictFillStyle } from "@/lib/board/verdict";
import { formatCompactMnt, formatPct } from "@/lib/labels.mn";
import { HELP } from "@/lib/board/helpText";
import { ChartTooltip, TipHead, TipRow, type TooltipState } from "./ChartTooltip";
import { cn, HelpToggle, Icon, SectionHeader, Segmented } from "./ui";

type Sort = "verdict" | "amount" | "name";

export function CategoryHeatGrid({
  stores,
  filter,
  onOpen,
}: {
  stores: BoardStore[];
  filter: Verdict | null;
  onOpen: (storeId: number, categoryKey: string) => void;
}) {
  const [sort, setSort] = useState<Sort>("verdict");
  const [tip, setTip] = useState<TooltipState | null>(null);

  /** Бүх дэлгүүрийн ангиллын нэгдэл — багана нь тогтмол дараалалтай байх ёстой. */
  const columns = useMemo(() => {
    const seen = new Map<string, { key: string; name: string; gmv: number }>();
    for (const s of stores) {
      for (const c of s.categories) {
        const prev = seen.get(c.key);
        if (prev) prev.gmv += c.metrics.gmv;
        else seen.set(c.key, { key: c.key, name: c.name, gmv: c.metrics.gmv });
      }
    }
    return [...seen.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 10);
  }, [stores]);

  const rows = useMemo(() => {
    const list = filter ? stores.filter((s) => s.verdictInfo.verdict === filter) : [...stores];
    list.sort((a, b) => {
      if (sort === "amount")
        return (b.latestOrder?.totalAmount ?? 0) - (a.latestOrder?.totalAmount ?? 0);
      if (sort === "name") return a.name.localeCompare(b.name, "mn");
      return (
        VERDICT[a.verdictInfo.verdict].order - VERDICT[b.verdictInfo.verdict].order ||
        b.verdictInfo.impactMnt - a.verdictInfo.impactMnt
      );
    });
    return list;
  }, [stores, filter, sort]);

  const maxAmount = Math.max(1, ...rows.map((s) => s.latestOrder?.totalAmount ?? 0));

  // Verdict-ээр бүлэглэсэн тусгаарлагч мөрүүд (зөвхөн verdict эрэмбийн үед)
  const groups = useMemo(() => {
    if (sort !== "verdict") return null;
    const out: { verdict: Verdict; stores: BoardStore[] }[] = [];
    for (const s of rows) {
      const v = s.verdictInfo.verdict;
      const last = out[out.length - 1];
      if (last && last.verdict === v) last.stores.push(s);
      else out.push({ verdict: v, stores: [s] });
    }
    return out;
  }, [rows, sort]);

  const body = groups
    ? groups.flatMap((g) => [
        <tr key={`g-${g.verdict}`} className="bg-stone-50">
          <td
            colSpan={columns.length + 2}
            className="sticky left-0 z-10 border-b border-stone-100 bg-stone-50 px-3 py-1.5"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-500">
              <span
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[9px]"
                style={verdictFillStyle(g.verdict)}
              >
                {VERDICT[g.verdict].glyph}
              </span>
              {VERDICT[g.verdict].label}
              <span className="tabular-nums text-stone-400">({g.stores.length})</span>
            </span>
          </td>
        </tr>,
        ...g.stores.map((s) => (
          <Row
            key={s.storeId}
            store={s}
            columns={columns}
            maxAmount={maxAmount}
            onOpen={onOpen}
            setTip={setTip}
          />
        )),
      ])
    : rows.map((s) => (
        <Row
          key={s.storeId}
          store={s}
          columns={columns}
          maxAmount={maxAmount}
          onOpen={onOpen}
          setTip={setTip}
        />
      ));

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.grid className="h-5 w-5" />}
        title="Дэлгүүр × ангилал"
        description="Нүд дээр дарж тухайн бүлгийн бараануудыг харах, засах."
        right={
          <>
            <Segmented<Sort>
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: "verdict", label: "Шийдвэрээр" },
                { value: "amount", label: "Дүнгээр" },
                { value: "name", label: "Нэрээр" },
              ]}
            />
            <HelpToggle>
              {HELP.heatgrid.map((t) => (
                <p key={t} className="mb-1.5 last:mb-0">{t}</p>
              ))}
            </HelpToggle>
          </>
        }
      />

      {/* Картад overflow-hidden ТАВИХГҮЙ — sticky толгойг унагана.
          Дотоод гүйлгэх div-д л булан дугуйруулна. */}
      <div className="relative mt-4 overflow-x-auto rounded-lg">
        <table
          className="w-full min-w-[1000px] border-separate text-sm"
          style={{ borderSpacing: 0 }}
        >
          <thead>
            <tr>
              {/* ⚠️ sticky багана нь border-separate шаардана — Chromium нь
                  border-collapse үед sticky border-ыг унагадаг. Энэ бол
                  FactorMatrix-ийн border-collapse-ыг ХУУЛЖ БОЛОХГҮЙ цорын ганц газар. */}
              <th className="sticky left-0 z-20 w-44 border-b border-stone-200 bg-white px-3 pb-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-stone-500">
                Дэлгүүр
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  title={c.name}
                  className="border-b border-stone-200 px-1 pb-2 align-bottom text-[11px] font-medium leading-tight text-stone-500"
                >
                  {/* Эргүүлээгүй — 11px эргүүлсэн кирилл уншигдахгүй */}
                  <span className="line-clamp-2 block text-center">{c.name}</span>
                </th>
              ))}
              <th className="w-20 border-b border-stone-200 px-2 pb-2 text-right align-bottom text-[11px] font-medium text-stone-500">
                Захиалга
              </th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
        <ChartTooltip state={tip} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
        {VERDICT_LEGEND.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[9px] font-bold"
              style={verdictFillStyle(l.key)}
            >
              {l.glyph}
            </span>
            {l.short}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-dashed border-stone-300" />
          захиалга алга
        </span>
      </div>
    </section>
  );
}

function Row({
  store: s,
  columns,
  maxAmount,
  onOpen,
  setTip,
}: {
  store: BoardStore;
  columns: { key: string; name: string }[];
  maxAmount: number;
  onOpen: (storeId: number, categoryKey: string) => void;
  setTip: (t: TooltipState | null) => void;
}) {
  const byKey = new Map(s.categories.map((c) => [c.key, c] as const));
  const amount = s.latestOrder?.totalAmount ?? 0;

  return (
    <tr className="group">
      <td className="sticky left-0 z-10 border-b border-stone-100 bg-white px-3 py-1 group-hover:bg-stone-50">
        <button
          type="button"
          onClick={() => {
            const first = s.categories[0];
            if (first) onOpen(s.storeId, first.key);
          }}
          className="flex w-full items-center gap-1.5 truncate text-left text-[13px] font-medium text-stone-800 hover:text-teal-700"
        >
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[9px] font-bold"
            style={verdictFillStyle(s.verdictInfo.verdict)}
          >
            {VERDICT[s.verdictInfo.verdict].glyph}
          </span>
          <span className="truncate">{s.name.replace(/^GS25\s*/, "")}</span>
        </button>
      </td>

      {columns.map((col) => {
        const c = byKey.get(col.key);
        return (
          <td key={col.key} className="border-b border-stone-100 p-[2px] group-hover:bg-stone-50">
            {c ? (
              <Cell store={s} cat={c} onOpen={onOpen} setTip={setTip} />
            ) : (
              /* Огт хоосон = захиалах юм байхгүй (дата дутуутай ХОЛИХГҮЙ) */
              <div className="h-8 w-full" aria-hidden />
            )}
          </td>
        );
      })}

      <td className="border-b border-stone-100 px-2 py-1 group-hover:bg-stone-50">
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] tabular-nums text-stone-500">
            {formatCompactMnt(amount)}
          </span>
          <span className="h-1.5 w-full max-w-[52px] rounded-full bg-stone-100">
            <span
              className="block h-1.5 rounded-full bg-teal-600"
              style={{ width: `${Math.max(2, (amount / maxAmount) * 100)}%` }}
            />
          </span>
        </div>
      </td>
    </tr>
  );
}

function Cell({
  store: s,
  cat: c,
  onOpen,
  setTip,
}: {
  store: BoardStore;
  cat: BoardCategory;
  onOpen: (storeId: number, categoryKey: string) => void;
  setTip: (t: TooltipState | null) => void;
}) {
  const v = c.verdictInfo.verdict;
  const t = VERDICT[v];

  const show = (e: React.MouseEvent | React.FocusEvent) => {
    const host = (e.currentTarget as HTMLElement).closest(".overflow-x-auto") as HTMLElement | null;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!host) return;
    const hostBox = host.getBoundingClientRect();
    setTip({
      x: (box.left - hostBox.left + host.scrollLeft + box.width / 2) / host.scrollWidth,
      y: (box.top - hostBox.top + host.scrollTop) / host.scrollHeight,
      content: <CellTip store={s} cat={c} />,
    });
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(s.storeId, c.key)}
      onMouseEnter={show}
      onFocus={show}
      onMouseLeave={() => setTip(null)}
      onBlur={() => setTip(null)}
      aria-label={`${s.name} · ${c.name} — ${t.label}`}
      className={cn(
        "flex h-8 w-full items-center justify-center rounded-[5px] text-[11px] font-bold transition-transform",
        "hover:scale-[1.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900",
      )}
      style={verdictFillStyle(v)}
    >
      {t.glyph}
    </button>
  );
}

function CellTip({ store: s, cat: c }: { store: BoardStore; cat: BoardCategory }) {
  const m = c.metrics;
  const t = VERDICT[c.verdictInfo.verdict];
  const touched = Math.round(m.overrideRate * m.orderLines);
  const measurable = m.overrideSamples >= 4;
  return (
    <>
      <TipHead
        value={formatPct(m.fillRate)}
        caption="нөхөлт"
        title={`${s.name.replace(/^GS25\s*/, "")} · ${c.name}`}
        right={
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={verdictFillStyle(c.verdictInfo.verdict)}
          >
            {t.glyph} {t.label}
          </span>
        }
      />
      <TipRow label="Бараа" value={m.items} />
      <TipRow
        label="Гараар өөрчилсөн"
        value={formatPct(m.overrideRate)}
        note={`${touched} / ${m.orderLines} мөр`}
      />
      {measurable && (
        <TipRow
          label="Өөрчлөлт зөв гарсан"
          value={formatPct(m.overrideAccuracy)}
          note={m.overrideAccuracy < 0.5 ? "← 50%-аас доогуур" : undefined}
        />
      )}
      <TipRow label="Илүүдэл" value={`${m.overstockRatio.toFixed(1)}×`} />
      <TipRow label="Захиалгын дүн" value={formatCompactMnt(m.gmv)} />
      <div className="mt-1.5 border-t border-stone-100 pt-1.5 text-[11px] text-stone-500">
        Дарж бараануудыг харах / засах →
      </div>
    </>
  );
}
