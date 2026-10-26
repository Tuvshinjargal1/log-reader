"use client";

/**
 * ШИЙДВЭРИЙН ЗУРАГ — захирлын гол асуултыг шууд хариулна.
 *
 *   Хэвтээ: оператор захиалгын хэдэн %-ийг гараар зассан бэ (ХӨДӨЛМӨР)
 *   Босоо:  тэр өөрчлөлт борлуулалтаар зөв гарсан хувь  (ҮР ДҮН)
 *
 * Босоо тэнхлэгийн 50% нь ТОХИРУУЛЖ БОЛДОГГҮЙ байгалийн лавлах шугам — зоос
 * шидэлт. "Дээр нь оператор системийг дийлсэн, доор нь систем зөв байсан"
 * гэсэн ганц өгүүлбэр графикийг өөрөө өөрийгөө тайлбарладаг болгоно.
 *
 * ⚠️ Байрлал ба ӨНГӨ зөрж болно — энэ нь алдаа биш, ХАМГИЙН САЙН түүх:
 * баруун дээд буланд амбер (TUNE) бөмбөлөг гарвал "оператор зөв, гэхдээ ҮРГЭЛЖ
 * нэг чигт → өдөр бүр гараар хийхийн оронд параметрээ зас" гэсэн үг.
 */
import { useMemo, useState } from "react";
import type { BoardStore, Verdict } from "@/lib/replenish/board";
import { VERDICT, VERDICT_LEGEND, CHROME, verdictFillStyle } from "@/lib/board/verdict";
import {
  PLOT,
  place,
  quadrantOf,
  quadrants,
  sx,
  sy,
  type ScatterPoint,
} from "@/lib/board/scatter";
import { formatCompactMnt, formatPct } from "@/lib/labels.mn";
import { HELP } from "@/lib/board/helpText";
import { ChartTooltip, TipHead, TipRow, type TooltipState } from "./ChartTooltip";
import { StoreLeaderboard } from "./StoreLeaderboard";
import { cn, HelpToggle, Icon, SectionHeader, Segmented } from "./ui";

type View = "chart" | "table";

/** Хэмжих боломжтой override түүхтэй эсэх. Үгүй бол зурагт ОРУУЛАХГҮЙ. */
function measurable(s: BoardStore): boolean {
  return s.metrics.overrideSamples >= 4 && !s.offline;
}

export function DecisionQuadrant({
  stores,
  filter,
  onSelect,
}: {
  stores: BoardStore[];
  filter: Verdict | null;
  onSelect: (storeId: number) => void;
}) {
  const [view, setView] = useState<View>("chart");
  const [tip, setTip] = useState<TooltipState | null>(null);

  const plotted = useMemo(() => stores.filter(measurable), [stores]);
  const gutter = useMemo(() => stores.filter((s) => !measurable(s)), [stores]);

  const placed = useMemo(() => {
    const pts: ScatterPoint<BoardStore>[] = plotted.map((s) => ({
      datum: s,
      x: s.metrics.overrideRate,
      y: s.metrics.overrideAccuracy,
      weight: s.latestOrder?.totalAmount ?? 0,
    }));
    const maxW = Math.max(1, ...pts.map((p) => p.weight));
    return place(pts, maxW);
  }, [plotted]);

  const quads = useMemo(() => quadrants(), []);
  const quadCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of placed) m.set(quadrantOf(p.x, p.y), (m.get(quadrantOf(p.x, p.y)) ?? 0) + 1);
    return m;
  }, [placed]);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.chart className="h-5 w-5" />}
        title={`Шийдвэрийн зураг · ${stores.length} дэлгүүр`}
        description="Хүний оролцоо өгөөжөө өгч байна уу?"
        right={
          <>
            <Segmented<View>
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Зураг", icon: <Icon.chart /> },
                { value: "table", label: "Хүснэгт", icon: <Icon.list /> },
              ]}
            />
            <HelpToggle>
              {HELP.quadrant.map((t) => (
                <p key={t} className="mb-1.5 last:mb-0">{t}</p>
              ))}
            </HelpToggle>
          </>
        }
      />

      {view === "table" ? (
        <div className="mt-4">
          <StoreLeaderboard stores={stores} filter={filter} onSelect={onSelect} />
        </div>
      ) : (
        <>
          <div className="relative mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
              className="h-auto w-full min-w-[720px]"
              role="img"
              aria-label="Дэлгүүрүүдийн гараар оролцоо ба түүний зөв гарсан хувь"
            >
              {/* 1. Дөрөвний нэгийн дэвсгэр — анхаарал шаардсан доод хоёр л бага зэрэг бүдэг.
                  Том өнгөт блок тавибал бөмбөлгийн өнгөтэй өрсөлдөнө. */}
              {quads.map((q) => (
                <rect
                  key={q.key}
                  x={q.x} y={q.y} width={q.w} height={q.h}
                  fill={q.wash ? CHROME.wash : CHROME.surface}
                />
              ))}

              {/* 2. Сүлжээ — БҮТЭН hairline, тасархай ХЭЗЭЭ Ч биш */}
              {[0, 0.25, 0.75, 1].map((t) => (
                <line
                  key={`h${t}`}
                  x1={PLOT.x0} x2={PLOT.x1} y1={sy(t)} y2={sy(t)}
                  stroke={CHROME.grid} strokeWidth={1}
                />
              ))}
              {[0.05, 0.1, 0.2, 0.25, 0.3, 0.35, 0.4].map((t) => (
                <line
                  key={`v${t}`}
                  x1={sx(t)} x2={sx(t)} y1={PLOT.y0} y2={PLOT.y1}
                  stroke={CHROME.grid} strokeWidth={1}
                />
              ))}

              {/* 3. Лавлах шугамууд — сүлжээнээс нэг шат бараан.
                  ⚠️ 50%-ийн шугам нь ЗӨВХӨН баруун талыг хуваана: зүүн талд
                  (оролцоо <15%) нарийвчлал нь 4-6 мөр дээр тооцоологддог тул
                  статистикийн хувьд утгагүй — тэндээс шугам татвал сайн
                  ажиллаж байгаа дэлгүүрийг "буруу" тал руу хуваана. */}
              <line
                x1={sx(PLOT.xDivider)} x2={PLOT.x1}
                y1={sy(PLOT.yDivider)} y2={sy(PLOT.yDivider)}
                stroke={CHROME.reference} strokeWidth={1}
              />
              <line
                x1={sx(PLOT.xDivider)} x2={sx(PLOT.xDivider)} y1={PLOT.y0} y2={PLOT.y1}
                stroke={CHROME.reference} strokeWidth={1}
              />
              <text
                x={PLOT.x1 - 6} y={sy(PLOT.yDivider) - 7}
                textAnchor="end" fontSize={11} fill={CHROME.labelStrong}
              >
                50% — систем ба оператор тэнцүү
              </text>

              {/* 4. Дөрөвний нэгийн гарчиг + тоо. ЭНЭ нь 10 секундын уншилт:
                  өөр юу ч уншаагүй хүн "АВТОМАТ ХЭВЭЭР — 8"-ыг авна. */}
              {quads.map((q) => {
                const n = quadCounts.get(q.key) ?? 0;
                return (
                  <g key={`l-${q.key}`}>
                    <text
                      x={q.labelX} y={q.labelY}
                      textAnchor={q.anchor}
                      fontSize={12} fontWeight={700} letterSpacing="0.04em"
                      fill={CHROME.labelStrong}
                    >
                      {q.title}
                    </text>
                    <text
                      x={q.labelX} y={q.labelY + 21}
                      textAnchor={q.anchor} fontSize={18} fontWeight={700}
                      fill="#44403c"
                    >
                      {n}
                      <tspan fontSize={12} fontWeight={500} fill={CHROME.label}> дэлгүүр</tspan>
                    </text>
                    <text
                      x={q.labelX} y={q.labelY + 37}
                      textAnchor={q.anchor} fontSize={10} fill={CHROME.label}
                    >
                      {q.note}
                    </text>
                  </g>
                );
              })}

              {/* 5. Бөмбөлөг — 2px гадаргуун цагаан цагираг нь давхцсаныг уншигдахуйц болгоно */}
              {placed.map((p) => {
                const s = p.datum;
                const v = s.verdictInfo.verdict;
                const t = VERDICT[v];
                const dim = filter != null && filter !== v;
                return (
                  <g key={s.storeId} opacity={dim ? 0.15 : 1}>
                    <circle
                      cx={p.cx} cy={p.cy} r={p.r}
                      fill={t.fill ?? CHROME.surface}
                      fillOpacity={t.fill ? 0.9 : 1}
                      stroke={t.fill ? CHROME.surface : t.stroke ?? CHROME.reference}
                      strokeWidth={2}
                    />
                    {p.r >= 11 ? (
                      <text
                        x={p.cx} y={p.cy + 3.5}
                        textAnchor="middle" fontSize={10} fontWeight={700}
                        fill={t.ink}
                        pointerEvents="none"
                      >
                        {s.short}
                      </text>
                    ) : (
                      <text
                        x={p.cx + p.r + 4} y={p.cy + 3.5}
                        fontSize={10} fill="#57534e" pointerEvents="none"
                      >
                        {s.short}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 6. Хүрэх давхарга — ≥28px, бөмбөлгөөс том */}
              {placed.map((p) => {
                const s = p.datum;
                return (
                  <circle
                    key={`hit-${s.storeId}`}
                    cx={p.cx} cy={p.cy} r={Math.max(p.r + 9, 14)}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${s.name}: гараар ${formatPct(s.metrics.overrideRate)}, зөв гарсан ${formatPct(s.metrics.overrideAccuracy)}`}
                    className="cursor-pointer outline-none focus-visible:stroke-stone-900"
                    strokeWidth={2}
                    onPointerEnter={() =>
                      setTip({
                        x: p.trueCx / PLOT.width,
                        y: p.trueCy / PLOT.height,
                        content: <StoreTip store={s} />,
                      })
                    }
                    onFocus={() =>
                      setTip({
                        x: p.trueCx / PLOT.width,
                        y: p.trueCy / PLOT.height,
                        content: <StoreTip store={s} />,
                      })
                    }
                    onPointerLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                    onClick={() => onSelect(s.storeId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(s.storeId);
                      }
                    }}
                  />
                );
              })}

              {/* Тэнхлэгүүд */}
              <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} stroke={CHROME.axis} strokeWidth={1} />
              <line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y0} y2={PLOT.y1} stroke={CHROME.axis} strokeWidth={1} />

              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <text
                  key={`yt${t}`}
                  x={PLOT.x0 - 8} y={sy(t) + 3.5}
                  textAnchor="end" fontSize={10} fill={CHROME.label}
                  className="tabular-nums"
                >
                  {Math.round(t * 100)}%
                </text>
              ))}
              {[0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map((t) => (
                <text
                  key={`xt${t}`}
                  x={sx(t)} y={PLOT.y1 + 16}
                  textAnchor="middle" fontSize={10} fill={CHROME.label}
                  className="tabular-nums"
                >
                  {Math.round(t * 100)}%
                </text>
              ))}
              <text x={sx(PLOT.xDivider)} y={PLOT.y1 + 31} textAnchor="middle" fontSize={10} fill={CHROME.labelStrong}>
                ↑ хөдөлмөрийн хязгаар
              </text>
              <text x={PLOT.x1} y={PLOT.y1 + 31} textAnchor="end" fontSize={11} fill={CHROME.labelStrong}>
                Гараар өөрчилсөн мөрийн хувь →
              </text>
              <text
                x={-((PLOT.y0 + PLOT.y1) / 2)} y={26}
                transform="rotate(-90)" textAnchor="middle"
                fontSize={11} fill={CHROME.labelStrong}
              >
                Өөрчлөлт зөв гарсан хувь →
              </text>

              {/* "Дата дутуу" тусгаарлагдсан талбай — эдгээрийг (0,0)-д тавибал
                  "0% оролцоо, 0% зөв" гэж уншигдаж, ЗОХИОГҮЙ дүгнэлт үүснэ. */}
              {gutter.length > 0 && (
                <>
                  <line
                    x1={PLOT.gutterX1 + 12} x2={PLOT.gutterX1 + 12}
                    y1={PLOT.y0} y2={PLOT.y1}
                    stroke={CHROME.grid} strokeWidth={1}
                  />
                  <text
                    x={(PLOT.gutterX0 + PLOT.gutterX1) / 2} y={PLOT.y0 - 8}
                    textAnchor="middle" fontSize={10} fill={CHROME.label}
                  >
                    Дата дутуу
                  </text>
                  {gutter.map((s, i) => {
                    const cy = PLOT.y0 + 26 + i * 34;
                    if (cy > PLOT.y1 - 10) return null;
                    return (
                      <g key={s.storeId}>
                        <circle
                          cx={(PLOT.gutterX0 + PLOT.gutterX1) / 2} cy={cy} r={11}
                          fill={CHROME.surface} stroke={CHROME.reference} strokeWidth={2}
                          strokeDasharray="3 2"
                        />
                        <text
                          x={(PLOT.gutterX0 + PLOT.gutterX1) / 2} y={cy + 3.5}
                          textAnchor="middle" fontSize={9} fill={CHROME.labelStrong}
                        >
                          {s.short}
                        </text>
                        <circle
                          cx={(PLOT.gutterX0 + PLOT.gutterX1) / 2} cy={cy} r={16}
                          fill="transparent" tabIndex={0} role="button"
                          aria-label={`${s.name}: хэмжих дата хүрэлцэхгүй`}
                          className="cursor-pointer outline-none"
                          onPointerEnter={() =>
                            setTip({
                              x: 0.06,
                              y: cy / PLOT.height,
                              content: <StoreTip store={s} />,
                            })
                          }
                          onPointerLeave={() => setTip(null)}
                          onClick={() => onSelect(s.storeId)}
                        />
                      </g>
                    );
                  })}
                </>
              )}
            </svg>

            <ChartTooltip state={tip} />
          </div>

          {/* Тайлбар — өнгө дангаараа мэдээлэл дамжуулахгүй */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
            {VERDICT_LEGEND.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[9px] font-bold"
                  style={verdictFillStyle(l.key)}
                >
                  {l.glyph}
                </span>
                {l.label}
              </span>
            ))}
            <span className="ml-auto">Бөмбөлгийн хэмжээ = захиалгын дүн</span>
          </div>

          {gutter.length > 0 && (
            <p className="mt-2 text-[11px] text-stone-400">
              {gutter.length} дэлгүүрийн хэмжих дата хүрэлцэхгүй тул зурагт оруулаагүй — зүүн талд
              тусад нь харуулав.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function StoreTip({ store: s }: { store: BoardStore }) {
  const m = s.metrics;
  const t = VERDICT[s.verdictInfo.verdict];
  const lines = m.orderLines;
  const touched = Math.round(m.overrideRate * lines);
  return (
    <>
      <TipHead
        value={m.overrideSamples >= 4 ? formatPct(m.overrideAccuracy) : "—"}
        caption="өөрчлөлт зөв гарсан"
        title={s.name}
        right={
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={verdictFillStyle(s.verdictInfo.verdict)}
          >
            {t.glyph} {t.label}
          </span>
        }
      />
      <TipRow
        label="Гараар өөрчилсөн"
        value={formatPct(m.overrideRate)}
        note={`${touched} / ${lines} мөр`}
      />
      <TipRow
        label="Захиалгын дүн"
        value={formatCompactMnt(s.latestOrder?.totalAmount ?? 0)}
      />
      <TipRow label="Нөхөлт" value={formatPct(m.fillRate)} />
      <TipRow label="Итгэлцэл" value={m.avgConfidence.toFixed(2)} />
      <div className={cn("mt-1.5 border-t border-stone-100 pt-1.5 text-[11px] text-stone-500")}>
        Дарж ангиллаар нь харах →
      </div>
    </>
  );
}
