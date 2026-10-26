"use client";

/**
 * ЦАГ ХУГАЦААНЫ МЭДРЭМЖ — "систем цаг үеэ дагаж чадаж байна уу, tune хийх
 * шаардлагатай юу?" гэдгийг харуулна.
 *
 * ⚠️ ХОЁР ТЭНХЛЭГТЭЙ ГРАФИК ХИЙХГҮЙ. "Нөөц дуусалт (өдөр)" ба "гараар өөрчилсөн
 * хувь" хоёр нь ТӨРӨЛ ЗҮЙЛ нь ч, масштаб нь ч өөр. Хоёр y-тэнхлэгийг нэг зурган
 * дээр тавибал тэдгээрийн зэрэгцүүлэлт дур зоргоороо болж, байхгүй хамаарлыг
 * зохиодог. Тиймээс SMALL MULTIPLES: хоёр тусдаа зураг, x-тэнхлэг ба хуанлийн
 * эгнээг ХУВААЛЦАНА, тус бүр өөрийн зохимжтой масштабтай.
 *
 * Нөхөлтийг (fill rate) БИШ, нөөц дуусалтыг сонгосон шалтгаан: нөхөлт нь
 * 99-100% хооронд хэлбэлздэг тул ямар ч масштабаар харуулахад хавтгай шугам
 * болно. Нөөц дуусалт нь Наадмын үед 5-10 дахин өсдөг — бодит, харагдахуйц
 * дохио.
 */
import { useMemo, useState } from "react";
import type { FleetTrendPoint } from "@/lib/replenish/board";
import { CHROME, SERIES_COLOR } from "@/lib/board/verdict";
import { formatPct } from "@/lib/labels.mn";
import { trendSentence } from "@/lib/board/insights";
import { HELP } from "@/lib/board/helpText";
import { ChartTooltip, TipRow, type TooltipState } from "./ChartTooltip";
import { HelpToggle, Icon, SectionHeader } from "./ui";

const W = 960;
const X0 = 62;
const X1 = 900;

/** Дээд зураг: нөөц дуусалт */
const A_Y0 = 16;
const A_Y1 = 132;
/** Доод зураг: гараар өөрчлөлт */
const B_Y0 = 168;
const B_Y1 = 268;
/** Хуанлийн эгнээ ба x шошго */
const LANE_Y = 282;
const LANE_H = 22;
const H = 336;

export function FleetTrend({ trend }: { trend: FleetTrendPoint[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // ⚠️ Дуусаагүй долоо хоногийг зурагт ОРУУЛАХГҮЙ. 3 хоногийн нийлбэрийг
  // бүтэн долоо хоногийн хажууд тавибал шугам огцом унаж, "эрэлт унасан" гэсэн
  // ХУДАЛ дүр зураг гаргана. Бүдэг дэвсгэр, тайлбар нь хүрэлцэхгүй — уншигч
  // шугамыг л хардаг.
  const partialCount = trend.filter((t) => t.partial).length;
  const pts = useMemo(() => trend.filter((t) => !t.partial), [trend]);
  const n = pts.length;
  const sentence = useMemo(() => trendSentence(trend), [trend]);

  const maxStockout = useMemo(
    () => Math.max(4, ...pts.map((p) => p.stockoutDays)),
    [pts],
  );
  const maxOverride = useMemo(
    () => Math.max(0.05, ...pts.map((p) => p.overrideRate)),
    [pts],
  );

  if (n < 2) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <SectionHeader
          icon={<Icon.trend className="h-5 w-5" />}
          title="Цаг хугацааны мэдрэмж"
          description="Хандлага харуулахад хангалттай долоо хоног хараахан алга."
        />
      </section>
    );
  }

  const xOf = (i: number) => X0 + (i / (n - 1)) * (X1 - X0);
  const aY = (v: number) => A_Y1 - Math.min(1, v / (maxStockout * 1.15)) * (A_Y1 - A_Y0);
  const bY = (v: number) => B_Y1 - Math.min(1, v / (maxOverride * 1.2)) * (B_Y1 - B_Y0);

  const linePath = (get: (p: FleetTrendPoint) => number, y: (v: number) => number) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${y(get(p)).toFixed(1)}`)
      .join(" ");

  const last = pts[n - 1];
  const aTicks = niceTicks(maxStockout * 1.15, 3);
  const bTicks = niceTicks(maxOverride * 1.2, 3);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <SectionHeader
        icon={<Icon.trend className="h-5 w-5" />}
        title={`Цаг хугацааны мэдрэмж · сүүлийн ${n} долоо хоног`}
        description="Систем баяр, эрэлтийн өөрчлөлтийг цаг тухайд мэдэрч байна уу?"
        right={
          <HelpToggle>
            {HELP.trend.map((t) => (
              <p key={t} className="mb-1.5 last:mb-0">{t}</p>
            ))}
          </HelpToggle>
        }
      />

      <div className="relative mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[680px]"
          role="img"
          aria-label="Долоо хоног тутмын нөөц дуусалт ба гараар өөрчлөлтийн хандлага"
        >
          {/* ── Зураг А: нөөц дуусалт ── */}
          <text x={X0} y={A_Y0 - 4} fontSize={11} fontWeight={600} fill={CHROME.labelStrong}>
            Нөөц дуусалт (бараа-өдөр)
          </text>
          {aTicks.map((t) => (
            <g key={`at${t}`}>
              <line x1={X0} x2={X1} y1={aY(t)} y2={aY(t)} stroke={CHROME.grid} strokeWidth={1} />
              <text
                x={X0 - 8} y={aY(t) + 3.5}
                textAnchor="end" fontSize={10} fill={CHROME.label} className="tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}
          <path
            d={linePath((p) => p.stockoutDays, aY)}
            fill="none" stroke={SERIES_COLOR.fill} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
          />
          {/* Хамгийн их дуусалттай долоо хоногийг ШУУД шошголоно (цэг тутамд биш) */}
          {(() => {
            const peak = pts.reduce(
              (best, p, i) => (p.stockoutDays > (pts[best]?.stockoutDays ?? -1) ? i : best),
              0,
            );
            const p = pts[peak];
            if (p.stockoutDays <= 0) return null;
            const flip = xOf(peak) > (X0 + X1) / 2;
            return (
              <g>
                <circle
                  cx={xOf(peak)} cy={aY(p.stockoutDays)} r={4}
                  fill={SERIES_COLOR.fill} stroke={CHROME.surface} strokeWidth={2}
                />
                <text
                  x={xOf(peak) + (flip ? -9 : 9)} y={aY(p.stockoutDays) + 3.5}
                  textAnchor={flip ? "end" : "start"}
                  fontSize={11} fontWeight={700} fill="#44403c"
                >
                  {p.stockoutDays}
                  {p.events.length > 0 && (
                    <tspan fontWeight={400} fill={CHROME.labelStrong}> · {p.events[0]}</tspan>
                  )}
                </text>
              </g>
            );
          })()}
          <line x1={X0} x2={X1} y1={A_Y1} y2={A_Y1} stroke={CHROME.axis} strokeWidth={1} />

          {/* ── Зураг Б: гараар өөрчлөлт ── */}
          <text x={X0} y={B_Y0 - 4} fontSize={11} fontWeight={600} fill={CHROME.labelStrong}>
            Гараар өөрчилсөн мөрийн хувь
          </text>
          {bTicks.map((t) => (
            <g key={`bt${t}`}>
              <line x1={X0} x2={X1} y1={bY(t)} y2={bY(t)} stroke={CHROME.grid} strokeWidth={1} />
              <text
                x={X0 - 8} y={bY(t) + 3.5}
                textAnchor="end" fontSize={10} fill={CHROME.label} className="tabular-nums"
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          <path
            d={linePath((p) => p.overrideRate, bY)}
            fill="none" stroke={SERIES_COLOR.override} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
          />
          <circle
            cx={xOf(n - 1)} cy={bY(last.overrideRate)} r={4}
            fill={SERIES_COLOR.override} stroke={CHROME.surface} strokeWidth={2}
          />
          <text
            x={xOf(n - 1) - 9} y={bY(last.overrideRate) + 3.5}
            textAnchor="end" fontSize={11} fontWeight={700} fill="#44403c"
          >
            {formatPct(last.overrideRate)}
          </text>
          <line x1={X0} x2={X1} y1={B_Y1} y2={B_Y1} stroke={CHROME.axis} strokeWidth={1} />

          {/* Эрэлтийн эргэлт — ХОЁР зурган дундуур босоо шугам + хоосон ромб */}
          {pts.map((p, i) =>
            p.regime ? (
              <g key={`r${i}`}>
                <line
                  x1={xOf(i)} x2={xOf(i)} y1={A_Y0} y2={B_Y1}
                  stroke={CHROME.reference} strokeWidth={1}
                />
                <path
                  d={`M${xOf(i)},${B_Y1 - 7} l7,7 l-7,7 l-7,-7 z`}
                  fill={CHROME.surface} stroke={CHROME.labelStrong} strokeWidth={1.5}
                />
              </g>
            ) : null,
          )}

          {/* Хуанлийн үйл явдал — ӨӨРИЙН эгнээнд, СААРМАГ өнгөөр. Зурган дундуур
              босоо шугам болгож тавибал бар код болно. */}
          {pts.map((p, i) =>
            p.events.length > 0 ? (
              <g key={`e${i}`}>
                <rect
                  x={xOf(i) - 27} y={LANE_Y} width={54} height={LANE_H}
                  rx={9} fill="#f5f5f4" stroke={CHROME.grid} strokeWidth={1}
                />
                <text
                  x={xOf(i)} y={LANE_Y + 15}
                  textAnchor="middle" fontSize={10} fill={CHROME.labelStrong}
                >
                  {p.events[0]}
                </text>
              </g>
            ) : null,
          )}

          {pts.map((p, i) =>
            i % 2 === 0 || i === n - 1 ? (
              <text
                key={`x${i}`}
                x={xOf(i)} y={LANE_Y + LANE_H + 16}
                textAnchor="middle" fontSize={10} fill={CHROME.label} className="tabular-nums"
              >
                {p.label}
              </text>
            ) : null,
          )}

          {/* Загалмай — хоёр зурганд зэрэг */}
          {hover != null && (
            <>
              <line
                x1={xOf(hover)} x2={xOf(hover)} y1={A_Y0} y2={B_Y1}
                stroke={CHROME.reference} strokeWidth={1}
              />
              <circle
                cx={xOf(hover)} cy={aY(pts[hover].stockoutDays)} r={5.5}
                fill={SERIES_COLOR.fill} stroke={CHROME.surface} strokeWidth={2}
              />
              <circle
                cx={xOf(hover)} cy={bY(pts[hover].overrideRate)} r={5.5}
                fill={SERIES_COLOR.override} stroke={CHROME.surface} strokeWidth={2}
              />
            </>
          )}

          {/* Долоо хоногийн зурвас — hover ба keyboard хоёуланд ижил */}
          {pts.map((p, i) => {
            const bw = (X1 - X0) / (n - 1);
            return (
              <rect
                key={`hit${i}`}
                x={xOf(i) - bw / 2} y={A_Y0}
                width={bw} height={LANE_Y + LANE_H - A_Y0}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${p.label}: нөөц дуусалт ${p.stockoutDays} өдөр, гараар ${formatPct(p.overrideRate)}`}
                className="cursor-crosshair outline-none"
                onMouseEnter={() => {
                  setHover(i);
                  setTip({ x: xOf(i) / W, y: 0.1, content: <WeekTip p={p} /> });
                }}
                onFocus={() => {
                  setHover(i);
                  setTip({ x: xOf(i) / W, y: 0.1, content: <WeekTip p={p} /> });
                }}
                onMouseLeave={() => {
                  setHover(null);
                  setTip(null);
                }}
                onBlur={() => {
                  setHover(null);
                  setTip(null);
                }}
              />
            );
          })}
        </svg>
        <ChartTooltip state={tip} />
      </div>

      {/* Текст нь датаны өнгө зүүхгүй — өнгөт түлхүүр нь хажууд */}
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ background: SERIES_COLOR.fill }} />
          Нөөц дуусалт
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ background: SERIES_COLOR.override }} />
          Гараар өөрчлөлт
        </span>
        <span className="inline-flex items-center gap-1.5 text-stone-400">
          <span className="text-stone-500">◇</span> эрэлтийн эргэлт
        </span>
        {partialCount > 0 && (
          <span className="text-stone-400">
            Дуусаагүй долоо хоногийг оруулаагүй
          </span>
        )}
      </div>

      {sentence && (
        <p className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm leading-relaxed text-stone-700">
          {sentence}
        </p>
      )}
    </section>
  );
}

/** Уншихад ойлгомжтой тэнхлэгийн заалт (1/2/5 × 10^n). */
function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function WeekTip({ p }: { p: FleetTrendPoint }) {
  return (
    <>
      <div className="mb-1.5 border-b border-stone-100 pb-1.5">
        <span className="font-semibold text-stone-800">
          {p.weekStart.slice(4, 6)}/{p.weekStart.slice(6, 8)} – {p.weekEnd.slice(4, 6)}/
          {p.weekEnd.slice(6, 8)}
        </span>
        {p.partial && <span className="ml-1.5 text-[11px] text-stone-400">(дуусаагүй)</span>}
      </div>
      <TipRow label="Нөөц дуусалт" value={p.stockoutDays} note="бараа-өдөр" />
      <TipRow label="Гараар өөрчилсөн" value={formatPct(p.overrideRate)} />
      <TipRow label="Нөхөлт" value={formatPct(p.fillRate, 1)} />
      <TipRow label="Захиалгын мөр" value={p.orderLines.toLocaleString("mn-MN")} />
      {p.events.length > 0 && (
        <div className="mt-1.5 border-t border-stone-100 pt-1.5 text-[11px] text-stone-500">
          Хуанли: {p.events.join(", ")}
        </div>
      )}
      {p.regime && (
        <div className="mt-1 text-[11px] font-medium text-stone-700">
          ◇ Эрэлтийн түвшин {p.regime === "up" ? "огцом өссөн" : "огцом буурсан"}
        </div>
      )}
    </>
  );
}
