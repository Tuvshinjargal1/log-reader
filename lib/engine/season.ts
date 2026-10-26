/**
 * Улирал / баярын хүчин зүйл (энгийн календарь). P2-д seasonality_profile
 * болон бодит борлуулалтын түүхээр баяжина. Одоохондоо тодорхой мэдэгдэж буй
 * Монголын эрэлт өсдөг үеүдийг л тусгана.
 */
import { ymdToDate } from "./util";

export interface SeasonFactor {
  factor: number;
  label: string | null;
}

/**
 * ЗӨВХӨН DOW хүчин зүйлд баригддаггүй эрэлтийн онцгой үеийг тусгана
 * (амралтын өдрийн нөлөө нь dowFactors-д аль хэдийн орсон тул давхардуулахгүй).
 */
export function seasonFactor(ymd: string): SeasonFactor {
  const dt = ymdToDate(ymd);
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();

  // Наадам (7-р сарын 11-13) — хэрэглээ огцом нэмэгдэнэ
  if (month === 7 && day >= 11 && day <= 13) {
    return { factor: 1.25, label: "Наадам" };
  }
  // Шинэ жил (12-р сарын сүүл)
  if (month === 12 && day >= 28) {
    return { factor: 1.2, label: "Шинэ жил" };
  }
  // Цалингийн өдрүүд (сарын эхэн ба дунд) — бага зэрэг өсөлт
  if (day <= 2 || (day >= 15 && day <= 16)) {
    return { factor: 1.08, label: "Цалин" };
  }
  return { factor: 1, label: null };
}
