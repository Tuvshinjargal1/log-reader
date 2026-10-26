/**
 * Board-ын өгүүлбэрүүд — hardcode ХИЙХГҮЙ, дата өөрчлөгдөхөд үнэн хэвээр байна.
 *
 * Эдгээр өгүүлбэр нь гоёл биш: захирал графикийг биш, ЭНЭ ӨГҮҮЛБЭРИЙГ өөрийн
 * зөвлөлдөө давтан хэлнэ.
 */
import type { DecisionBoard, FleetTrendPoint } from "@/lib/replenish/board";
import { formatCompactMnt } from "@/lib/labels.mn";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** "Өнөөдөр систем чиний төлөө юу хийсэн бэ" — нэг өгүүлбэр. */
export function todaySentence(board: DecisionBoard): string {
  const t = board.totals;
  const submitted = board.stores.filter(
    (s) => s.mode === "auto" && s.latestOrder?.status === "submitted",
  ).length;
  const lines = t.metrics.orderLines;
  const touched = Math.round(t.metrics.overrideRate * lines);
  const needAction = t.byVerdict.TUNE + t.byVerdict.WATCH + t.byVerdict.DATA;

  const parts: string[] = [];
  parts.push(
    `Систем ${t.stores} дэлгүүрийн ${lines.toLocaleString("mn-MN")} захиалгын мөрийг тооцоолж, ` +
      `${submitted} дэлгүүрийн захиалгыг автоматаар илгээв.`,
  );
  if (touched > 0) {
    parts.push(
      `Оператор ${touched.toLocaleString("mn-MN")} мөрийг гараар зассан — үүний ` +
        `${pct(t.metrics.overrideAccuracy)} нь борлуулалтаар зөв гарсан.`,
    );
  }
  parts.push(
    needAction > 0
      ? `Өнөөдөр ${needAction} дэлгүүрт л оролцоно.`
      : `Өнөөдөр гараар оролцох шаардлагагүй.`,
  );
  return parts.join(" ");
}

/** Автомат vs гараар — нэг мөрийн дүгнэлт. */
export function autoVsManualSentence(board: DecisionBoard): string {
  const a = board.totals.autoVsManual;
  const win = pct(a.manualWinRate);
  if (a.manualLines < 20) {
    return "Гараар өөрчлөлт цөөн тул автомат/гараар харьцуулалт хийхэд хангалтгүй.";
  }
  if (a.verdict === "manual_wins") {
    return (
      `Гараар зассан ${a.manualLines.toLocaleString("mn-MN")} мөрийн ${win} нь системийн саналаас ` +
      `ойрхон гарсан — нийт ${formatCompactMnt(a.manualValueMnt)} үнэ цэнэ нэмсэн. ` +
      `Гэхдээ энэ нь дэлгүүр бүрт адилгүй: доорх зурагт нэг талын өөрчлөлт (амбер) нь ` +
      `хүний ур чадвар биш, буруу тохируулгыг илтгэнэ.`
    );
  }
  if (a.verdict === "auto_wins") {
    return (
      `Гараар зассан ${a.manualLines.toLocaleString("mn-MN")} мөрийн ердөө ${win} нь сайжруулсан — ` +
      `үлдсэн нь системийн саналаас ХОЛДУУЛСАН. Эдгээр дэлгүүрийг автомат руу шилжүүлэх боломжтой.`
    );
  }
  return (
    `Гараар өөрчлөлтийн ${win} нь сайжруулсан — автомат ба гараар ойролцоо. ` +
    `Аль дэлгүүрт хүний оролцоо үнэхээр хэрэгтэйг доорх зурагнаас хараарай.`
  );
}

/**
 * Trend чартын доорх дүгнэлт. Хуанлийн эвент эсвэл эрэлтийн эргэлтийн орчим
 * хоёр цувааны хамгийн их зөрүүг олж тайлбарлана.
 */
export function trendSentence(trend: FleetTrendPoint[]): string | null {
  const usable = trend.filter((t) => !t.partial && t.orderLines > 0);
  if (usable.length < 3) return null;

  const avgStockout =
    usable.reduce((a, t) => a + t.stockoutDays, 0) / Math.max(1, usable.length);

  // Хамгийн их нөөц дуусалттай долоо хоногийг олно — баярын үеийн дохио
  let peak = usable[0];
  for (const t of usable) if (t.stockoutDays > peak.stockoutDays) peak = t;

  const spike = avgStockout > 0 ? peak.stockoutDays / avgStockout : 1;

  if (spike < 1.6 || peak.stockoutDays < 4) {
    const avgOverride =
      usable.reduce((a, t) => a + t.overrideRate, 0) / usable.length;
    return (
      `Сүүлийн ${usable.length} долоо хоногт нөөц дуусалт долоо хоногт ` +
      `${avgStockout.toFixed(0)} бараа-өдөр орчим тогтвортой, гараар оролцоо ${pct(avgOverride)}. ` +
      `Огцом өөрчлөлт ажиглагдаагүй — одоогийн тохиргоо цаг үеэ дагаж чадаж байна.`
    );
  }

  const ev = peak.events.length > 0 ? peak.events.join(", ") : null;
  const head = ev ? `${ev}-ын долоо хоногт` : `${peak.label}-ны долоо хоногт`;

  const idx = usable.indexOf(peak);
  const prev = idx > 0 ? usable[idx - 1] : null;
  const overridePart =
    prev && peak.overrideRate - prev.overrideRate >= 0.015
      ? ` Оператор гараар оролцоог ${pct(prev.overrideRate)} → ${pct(peak.overrideRate)} болгож нөхсөн.`
      : prev
        ? ` Гараар оролцоо ${pct(peak.overrideRate)} хэвээр байсан — хүн ч гүйцээгүй.`
        : "";

  // ⚠️ Шалтгааныг ЗӨВ хэлнэ. Хуанлийн үйл явдалгүй долоо хоногт "баярын эрэлт"
  // гэж бичвэл байхгүй шалтгааныг зохиож, буруу дүгнэлт гаргана.
  const cause = ev
    ? " — систем баярын эрэлтийг дутуу тооцсон."
    : peak.regime
      ? " — эрэлтийн түвшин өөрчлөгдсөнийг прогноз хараахан амжиж дагаагүй."
      : " — прогноз тухайн үеийн эрэлтээс хоцорсон.";
  const tail = ev
    ? " Улирлын коэффициентээ тохируулах шаардлагатай."
    : " Нөөцлөлтийн түвшинг дахин тохируулах шаардлагатай.";

  return (
    `${head} нөөц дуусалт долоо хоногийн дунджаас ${spike.toFixed(1)} дахин өсч ` +
    `${peak.stockoutDays} бараа-өдөр болсон${cause}` +
    overridePart +
    tail
  );
}

/** Ажлын дараалалд зарцуулах ойролцоо хугацаа. */
export function estimateMinutes(storesNeedingWork: number): number {
  // Дэлгүүр тус бүрт ~2 минут (verdict унших + үйлдэл батлах)
  return Math.max(1, Math.round(storesNeedingWork * 2));
}
