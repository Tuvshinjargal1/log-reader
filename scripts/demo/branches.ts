/**
 * Демо флот — Улаанбаатарын 20 салбар.
 *
 * Координатыг УБ-ын дүүргүүдийн зөв хүрээнд (lat 47.86–47.96, lng 106.78–107.05)
 * 6 дүүрэгт тарааж байрлуулсан — газрын зураг дээр бөөгнөрөл биш, бодит флот
 * шиг харагдана.
 *
 * ⚠️ Эдгээрийг GS25-ийн БОДИТ хаяг гэж танилцуулж болохгүй. Бодит нэр,
 * координат хэрэгтэй бол нэг удаа:
 *     npm run seed:demo -- --live-branches
 * ажиллуулбал gs25.mn-ээс татаж, доорх хүснэгтийн оронд буулгах TS literal-ыг
 * stdout-д хэвлэнэ. Хуулж тавьсны дараа fixture нь бодит бөгөөд детерминистик,
 * offline-safe хэвээр байна.
 */

export interface DemoBranch {
  /** 0..19 — архетиптэй тулгах индекс (ARCHETYPE_PLAN[slot]) */
  slot: number;
  /** gs25.mn-тэй тулгах нормчилсон код */
  code: string;
  name: string;
  district: string;
  /** stores.ip нь NOT NULL UNIQUE — демо дээр зөвхөн түлхүүрийн үүрэгтэй */
  ip: string;
  lat: number;
  lng: number;
  /** Эрэлтийн масштаб (том/жижиг салбар) */
  sizeFactor: number;
  /** Тухайн салбарын барааны тоо */
  skuCount: number;
  /** Зурагт харуулах 2-3 тэмдэгт (bubble label) */
  short: string;
}

export const DEMO_BRANCHES: readonly DemoBranch[] = [
  // --- auto_healthy (slot 0-7) ---
  { slot: 0,  code: "2101", name: "GS25 Сүхбаатарын талбай", district: "Сүхбаатар",      ip: "10.20.1.11", lat: 47.9188, lng: 106.9176, sizeFactor: 1.45, skuCount: 58, short: "СБ" },
  { slot: 1,  code: "2104", name: "GS25 Сансар",             district: "Баянзүрх",       ip: "10.20.1.12", lat: 47.9210, lng: 106.9581, sizeFactor: 1.20, skuCount: 54, short: "СН" },
  { slot: 2,  code: "2108", name: "GS25 Зайсан",             district: "Хан-Уул",        ip: "10.20.1.13", lat: 47.8842, lng: 106.9264, sizeFactor: 1.05, skuCount: 50, short: "ЗС" },
  { slot: 3,  code: "2112", name: "GS25 Их дэлгүүр",         district: "Чингэлтэй",      ip: "10.20.1.14", lat: 47.9152, lng: 106.9042, sizeFactor: 1.35, skuCount: 56, short: "ИД" },
  { slot: 4,  code: "2115", name: "GS25 Гурван гал",         district: "Чингэлтэй",      ip: "10.20.1.15", lat: 47.9271, lng: 106.9128, sizeFactor: 0.95, skuCount: 48, short: "ГГ" },
  { slot: 5,  code: "2118", name: "GS25 Мишээл",             district: "Хан-Уул",        ip: "10.20.1.16", lat: 47.8951, lng: 106.8709, sizeFactor: 1.15, skuCount: 52, short: "МШ" },
  { slot: 6,  code: "2121", name: "GS25 Дүнжингарав",        district: "Баянзүрх",       ip: "10.20.1.17", lat: 47.9184, lng: 106.9836, sizeFactor: 1.25, skuCount: 54, short: "ДГ" },
  { slot: 7,  code: "2124", name: "GS25 Тэнгис",             district: "Сүхбаатар",      ip: "10.20.1.18", lat: 47.9243, lng: 106.9192, sizeFactor: 1.00, skuCount: 50, short: "ТН" },

  // --- tune_up (slot 8-9): хажууд нь шинэ оффис/барилга ---
  { slot: 8,  code: "2127", name: "GS25 Шангри-Ла",          district: "Сүхбаатар",      ip: "10.20.1.19", lat: 47.9128, lng: 106.9218, sizeFactor: 1.30, skuCount: 56, short: "ШЛ" },
  { slot: 9,  code: "2130", name: "GS25 Blue Sky",           district: "Сүхбаатар",      ip: "10.20.1.20", lat: 47.9165, lng: 106.9146, sizeFactor: 1.20, skuCount: 54, short: "БС" },

  // --- tune_down (slot 10-11): зам засварт орсон ---
  { slot: 10, code: "2133", name: "GS25 Баянгол зочид буудал", district: "Баянгол",      ip: "10.20.1.21", lat: 47.9096, lng: 106.8862, sizeFactor: 0.90, skuCount: 48, short: "БГ" },
  { slot: 11, code: "2136", name: "GS25 Драгон",             district: "Баянгол",        ip: "10.20.1.22", lat: 47.9126, lng: 106.8388, sizeFactor: 0.85, skuCount: 46, short: "ДР" },

  // --- manual_value (slot 12-15): сургууль/оффис/цэнгэлдэх хажууд ---
  { slot: 12, code: "2139", name: "GS25 ШУТИС",              district: "Сүхбаатар",      ip: "10.20.1.23", lat: 47.9231, lng: 106.9375, sizeFactor: 1.10, skuCount: 52, short: "ШУ" },
  { slot: 13, code: "2142", name: "GS25 МУИС",               district: "Сүхбаатар",      ip: "10.20.1.24", lat: 47.9245, lng: 106.9291, sizeFactor: 1.05, skuCount: 50, short: "МУ" },
  { slot: 14, code: "2145", name: "GS25 Төв цэнгэлдэх",      district: "Хан-Уул",        ip: "10.20.1.25", lat: 47.9012, lng: 106.9114, sizeFactor: 1.15, skuCount: 52, short: "ЦД" },
  { slot: 15, code: "2148", name: "GS25 Хүннү молл",         district: "Хан-Уул",        ip: "10.20.1.26", lat: 47.8703, lng: 106.7864, sizeFactor: 0.95, skuCount: 48, short: "ХН" },

  // --- data_problem (slot 16-17): 4 долоо хоногийн өмнө нээгдсэн ---
  { slot: 16, code: "2151", name: "GS25 Яармаг шинэ",        district: "Хан-Уул",        ip: "10.20.1.27", lat: 47.8768, lng: 106.8402, sizeFactor: 0.70, skuCount: 42, short: "ЯР" },
  { slot: 17, code: "2154", name: "GS25 Баянхошуу",          district: "Сонгинохайрхан", ip: "10.20.1.28", lat: 47.9421, lng: 106.8017, sizeFactor: 0.65, skuCount: 40, short: "БХ" },

  // --- offline (slot 18-19): POS холболт тасарсан ---
  { slot: 18, code: "2157", name: "GS25 Налайх төв",         district: "Налайх",         ip: "10.20.1.29", lat: 47.7712, lng: 107.2528, sizeFactor: 0.75, skuCount: 44, short: "НЛ" },
  { slot: 19, code: "2160", name: "GS25 Толгойт",            district: "Сонгинохайрхан", ip: "10.20.1.30", lat: 47.9358, lng: 106.7802, sizeFactor: 0.80, skuCount: 44, short: "ТГ" },
] as const;

// --- --live-branches туслах -------------------------------------------------

interface Gs25ApiDoc {
  name?: string;
  title?: string;
  code?: string;
  branchCode?: string;
  district?: string;
  location?: { coordinates?: [number, number] } | null;
}

/**
 * gs25.mn-ээс бодит салбарын нэр/координатыг татаж, дээрх хүснэгтийг солих
 * TS literal-ыг хэвлэнэ. Байршил нь `[lng, lat]` дарааллаар ирдэг
 * (app/api/gs25-branches/route.ts-тэй ижил).
 */
export async function printLiveBranches(): Promise<void> {
  const docs: Gs25ApiDoc[] = [];
  for (let page = 1; page <= 10 && docs.length < 200; page++) {
    const res = await fetch(
      `https://gs25.mn/api/branches?limit=100&page=${page}&depth=0`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) break;
    const data = (await res.json()) as { docs?: Gs25ApiDoc[] };
    if (!data.docs?.length) break;
    docs.push(...data.docs);
  }

  const usable = docs
    .filter((d) => d.location?.coordinates?.length === 2)
    .slice(0, DEMO_BRANCHES.length);

  if (usable.length < DEMO_BRANCHES.length) {
    console.error(
      `⚠️  gs25.mn-ээс зөвхөн ${usable.length}/${DEMO_BRANCHES.length} салбар олдлоо — үлдсэнийг одоогийн fixture-ээр нөхнө.`,
    );
  }

  console.log("export const DEMO_BRANCHES: readonly DemoBranch[] = [");
  DEMO_BRANCHES.forEach((b, i) => {
    const live = usable[i];
    const coords = live?.location?.coordinates;
    const name = live?.name ?? live?.title ?? b.name;
    const code = live?.code ?? live?.branchCode ?? b.code;
    const lat = coords ? coords[1] : b.lat;
    const lng = coords ? coords[0] : b.lng;
    console.log(
      `  { slot: ${b.slot}, code: ${JSON.stringify(code)}, name: ${JSON.stringify(name)}, ` +
        `district: ${JSON.stringify(live?.district ?? b.district)}, ip: ${JSON.stringify(b.ip)}, ` +
        `lat: ${lat}, lng: ${lng}, sizeFactor: ${b.sizeFactor}, skuCount: ${b.skuCount}, ` +
        `short: ${JSON.stringify(b.short)} },`,
    );
  });
  console.log("] as const;");
}
