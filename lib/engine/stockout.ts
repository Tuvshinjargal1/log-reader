/**
 * Censored demand-ийн тааварлал. Бодит POS-д ӨДРИЙН түүхэн нөөц ихэвчлэн
 * хадгалагддаггүй тул зарагдсан тоо 0 байсан өдөр нь эрэлт БАЙГААГҮЙ гэсэн үг үү,
 * эсвэл НӨӨЦ ДУУССАН уу гэдгийг ялгах боломжгүй. Тогтмол сайн зарагддаг барааны
 * тусгаарлагдсан 0 өдрийг нөөц дууссан гэж болгоомжтойгоор тэмдэглэнэ —
 * ингэснээр forecast эдгээр өдрийг хасаж, эрэлтийг дутуу үнэлэхгүй.
 *
 * P2-т өдөр тутмын нөөцийн snapshot хуримтлагдвал (ingest бүр өнөөдрийн нөөцийг
 * бичдэг) бодит stockout_flag үүнийг орлоно.
 */
import type { DailyPoint } from "./types";
import { median } from "./util";

const MIN_POINTS = 7;
const MIN_SELL_FREQ = 0.7; // өдрүүдийн 70%-д зарагддаг
const MIN_MEDIAN = 3; // эерэг өдрийн медиан ≥ 3

export function inferStockouts(points: DailyPoint[]): DailyPoint[] {
  if (points.length < MIN_POINTS) return points;
  const positives = points.filter((p) => p.soldQty > 0);
  const freq = positives.length / points.length;
  const med = median(positives.map((p) => p.soldQty));
  if (freq < MIN_SELL_FREQ || med < MIN_MEDIAN) return points;

  return points.map((p) =>
    p.soldQty === 0 && !p.stockout ? { ...p, stockout: true } : p,
  );
}
