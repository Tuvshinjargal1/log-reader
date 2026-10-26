/**
 * Демо барааны каталог — 10 ангилал, ~120 SKU.
 *
 * `mcls_cd` нь ангиллын түлхүүр (`categoryKeyOf` = `items.mcls_cd`), тул
 * heat grid болон drawer-ийн drill-down энэ код дээр тулгуурлана.
 *
 * `item_cd` формат `${mclsCd}${nnnn}` — POS-той төстэй тоон код, ингэснээр
 * SMS-ийн бие (`ITEMCD*QTY`) бодитоор харагдана.
 */

export interface DemoCategory {
  mclsCd: string;
  mclsNm: string;
  /** 7 гарагийн коэффициент, 0 = Ням */
  dow: readonly [number, number, number, number, number, number, number];
  /** Өдрийн суурь эрэлтийн хүрээ (sizeFactor = 1 үед) */
  baseDaily: readonly [number, number];
  price: readonly [number, number];
  orderMultiple: number;
  perishable: boolean;
  shelfLifeDays: number | null;
  /** Суурь хэлбэлзэл (σ/μ) */
  cov: number;
  /** 0 борлуулалттай өдөр МӨР ҮҮСГЭХГҮЙ магадлал (POS-ийн бодит зан) */
  sparseProb: number;
  /** Сарын улирлын коэффициент (заавал биш) */
  monthFactor?: (m: number) => number;
}

export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  {
    mclsCd: "10", mclsNm: "Тамхи",
    dow: [1.0, 0.98, 0.98, 1.0, 1.02, 1.08, 1.05],
    baseDaily: [6, 16], price: [3500, 8000],
    orderMultiple: 10, perishable: false, shelfLifeDays: null,
    cov: 0.22, sparseProb: 0.02,
  },
  {
    mclsCd: "20", mclsNm: "Ундаа",
    dow: [1.15, 0.9, 0.92, 0.95, 1.0, 1.25, 1.35],
    baseDaily: [8, 24], price: [1500, 4500],
    orderMultiple: 6, perishable: false, shelfLifeDays: null,
    cov: 0.28, sparseProb: 0.03,
    monthFactor: (m) => (m >= 6 && m <= 8 ? 1.18 : m === 1 || m === 2 ? 0.88 : 1),
  },
  {
    mclsCd: "21", mclsNm: "Сүү, сүүн бүтээгдэхүүн",
    dow: [0.9, 1.08, 1.05, 1.05, 1.05, 1.0, 0.88],
    baseDaily: [5, 14], price: [2000, 6500],
    orderMultiple: 6, perishable: true, shelfLifeDays: 12,
    cov: 0.3, sparseProb: 0.05,
  },
  {
    mclsCd: "30", mclsNm: "Талх, нарийн боов",
    dow: [0.85, 1.12, 1.1, 1.08, 1.08, 1.0, 0.82],
    baseDaily: [4, 12], price: [1200, 4000],
    orderMultiple: 1, perishable: true, shelfLifeDays: 5,
    cov: 0.35, sparseProb: 0.06,
  },
  {
    mclsCd: "31", mclsNm: "Бэлэн хүнс",
    // Ажлын өдрийн үдийн хоол — хамгийн цаг мэдрэмтгий ангилал.
    //
    // ⚠️ shelfLifeDays-ыг хэт бага (1-2) тавьж БОЛОХГҮЙ. Өдөр тутам S = 2
    // хоногийн эрэлт + аюулгүйн нөөц хэмжээгээр захиалдаг тул аюулгүйн нөөц
    // мөчлөг тутам хугацаа дуусч, хаягдал нь хүргэлтийн 23% хүрдэг (бодит
    // конбини ~2-3%). 4 хоног нь агаар хязгаарласан баглаатай онигири/сэндвичийн
    // бодит хугацаа бөгөөд хаягдлыг үнэмшилтэй хэмжээнд байлгана — гэхдээ
    // хаягдлын түүх (WastePanel) хэвээр үлдэнэ.
    dow: [0.6, 1.55, 1.6, 1.6, 1.55, 1.35, 0.7],
    baseDaily: [6, 18], price: [4500, 12000],
    orderMultiple: 1, perishable: true, shelfLifeDays: 4,
    cov: 0.38, sparseProb: 0.04,
  },
  {
    mclsCd: "40", mclsNm: "Хөлдүү, зайрмаг",
    dow: [1.1, 0.92, 0.95, 0.98, 1.0, 1.2, 1.25],
    baseDaily: [3, 10], price: [2500, 9000],
    orderMultiple: 6, perishable: true, shelfLifeDays: 90,
    cov: 0.32, sparseProb: 0.1,
    monthFactor: (m) => (m >= 6 && m <= 8 ? 1.55 : m === 12 || m <= 2 ? 0.6 : 1),
  },
  {
    mclsCd: "50", mclsNm: "Чипс, амттан",
    dow: [1.12, 0.92, 0.95, 0.95, 1.02, 1.2, 1.3],
    baseDaily: [5, 15], price: [1800, 7500],
    orderMultiple: 12, perishable: false, shelfLifeDays: null,
    cov: 0.3, sparseProb: 0.05,
  },
  {
    mclsCd: "60", mclsNm: "Согтууруулах ундаа",
    // Хамгийн хүчтэй гарагийн хэлбэлзэл — Ба/Бя
    dow: [0.95, 0.6, 0.62, 0.7, 0.9, 1.9, 1.85],
    baseDaily: [3, 12], price: [3500, 15000],
    orderMultiple: 6, perishable: false, shelfLifeDays: null,
    cov: 0.34, sparseProb: 0.07,
  },
  {
    mclsCd: "70", mclsNm: "Гэр ахуй, хувийн хэрэглээ",
    // Удаан эргэлттэй — sparse мөр нь densifyDaily-г үнэхээр ажиллуулна.
    // μ-г 1.5-аас доош болговол бүхэл тоонд дугуйрахад нөөц байнга 0 болж,
    // planStore худал "нөөц дууссан" дохио үерлүүлнэ.
    dow: [1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.05],
    baseDaily: [1.5, 5], price: [2500, 25000],
    orderMultiple: 1, perishable: false, shelfLifeDays: null,
    cov: 0.45, sparseProb: 0.35,
  },
  {
    mclsCd: "80", mclsNm: "Кофе, халуун ундаа",
    dow: [0.75, 1.4, 1.38, 1.35, 1.35, 1.1, 0.8],
    baseDaily: [5, 16], price: [2000, 6000],
    orderMultiple: 1, perishable: false, shelfLifeDays: null,
    cov: 0.26, sparseProb: 0.04,
    monthFactor: (m) => (m >= 11 || m <= 2 ? 1.3 : m >= 6 && m <= 8 ? 0.82 : 1),
  },
] as const;

export interface DemoSku {
  itemCd: string;
  name: string;
  mclsCd: string;
  sclsCd: string;
  sclsNm: string;
  /** 0..1 — ангиллын үнийн хүрээн доторх байрлал */
  priceIndex: number;
  /** 0..1 — ангиллын эрэлтийн хүрээн доторх байрлал */
  demandIndex: number;
}

/** Ангилал бүрийн дэд ангилал ба барааны нэрс. */
const SKU_SOURCE: Record<string, { scls: string; sclsNm: string; names: string[] }[]> = {
  "10": [
    { scls: "1001", sclsNm: "Гадаад тамхи", names: ["Marlboro Red", "Marlboro Gold", "Parliament Aqua", "Kent HD 4", "Camel Blue", "Winston Blue"] },
    { scls: "1002", sclsNm: "Дотоод тамхи", names: ["Sky Blue", "Tiger Classic", "Zeus Silver"] },
  ],
  "20": [
    { scls: "2001", sclsNm: "Хийжүүлсэн", names: ["Coca-Cola 0.5л", "Coca-Cola 1.5л", "Sprite 0.5л", "Fanta 0.5л", "Pepsi 0.5л"] },
    { scls: "2002", sclsNm: "Ус", names: ["Ундрага 0.5л", "Ундрага 1.5л", "Bonaqua 0.5л", "Хархорин рашаан"] },
    { scls: "2003", sclsNm: "Жүүс", names: ["Vita жүүс алим", "Vita жүүс жүрж", "Nestea лимон", "Rich мандарин"] },
    { scls: "2004", sclsNm: "Эрчим хүчний", names: ["Red Bull 250мл", "Hulk эрчим", "Burn 0.33л"] },
  ],
  "21": [
    { scls: "2101", sclsNm: "Сүү", names: ["Сүү 1л ССҮҮ", "Сүү 0.5л ССҮҮ", "APU сүү 1л"] },
    { scls: "2102", sclsNm: "Тараг, йогурт", names: ["Тараг 500г", "Йогурт гүзээлзгэнэ", "Йогурт тоор", "Айраг 1л"] },
    { scls: "2103", sclsNm: "Бяслаг, цөцгий", names: ["Бяслаг 200г", "Цөцгийн тос 200г", "Өрөм 250г"] },
  ],
  "30": [
    { scls: "3001", sclsNm: "Талх", names: ["Талх цагаан", "Талх хар", "Талх тост"] },
    { scls: "3002", sclsNm: "Нарийн боов", names: ["Круассан", "Донат шоколад", "Булочка", "Бялуу зүсэм", "Пирог"] },
  ],
  "31": [
    { scls: "3101", sclsNm: "Онигири, самса", names: ["Онигири тунец", "Онигири тахиа", "Самса үхрийн", "Самса ногоотой"] },
    { scls: "3102", sclsNm: "Сэндвич", names: ["Сэндвич тахиа", "Сэндвич өндөг", "Сэндвич хиам", "Бургер тахиа"] },
    { scls: "3103", sclsNm: "Халуун хоол", names: ["Хуушуур 2ш", "Бууз 5ш", "Цуйван хайрцаг", "Лапша халуун"] },
  ],
  "40": [
    { scls: "4001", sclsNm: "Зайрмаг", names: ["Зайрмаг ваниль", "Зайрмаг шоколад", "Эскимо", "Мөстэй жүүс"] },
    { scls: "4002", sclsNm: "Хөлдөөсөн хүнс", names: ["Хөлдүү бууз 20ш", "Хөлдүү банш", "Хөлдүү хуушуур"] },
  ],
  "50": [
    { scls: "5001", sclsNm: "Чипс", names: ["Lay's classic", "Lay's сметана", "Pringles original", "Читос"] },
    { scls: "5002", sclsNm: "Шоколад", names: ["Snickers", "Twix", "KitKat", "Alpen Gold", "Ritter Sport"] },
    { scls: "5003", sclsNm: "Жигнэмэг", names: ["Печенье Oreo", "Крекер", "Вафли"] },
  ],
  "60": [
    { scls: "6001", sclsNm: "Шар айраг", names: ["Сэнгүр 0.5л", "Нийслэл 0.5л", "Хархорум 0.5л", "Heineken 0.5л", "Tiger 0.33л"] },
    { scls: "6002", sclsNm: "Архи", names: ["Чингис архи 0.5л", "Соёмбо архи 0.35л", "Эрдэнэ архи 0.5л"] },
    { scls: "6003", sclsNm: "Дарс", names: ["Улаан дарс 0.75л", "Цагаан дарс 0.75л"] },
  ],
  "70": [
    { scls: "7001", sclsNm: "Ариун цэвэр", names: ["Ариун цэврийн цаас 4ш", "Шүдний оо", "Саван", "Гар угаагч", "Шампунь 250мл"] },
    { scls: "7002", sclsNm: "Гэр ахуй", names: ["Батарей AA 4ш", "Гэрлийн чийдэн", "Шүүр", "Хогийн уут 30ш"] },
    { scls: "7003", sclsNm: "Бусад", names: ["Цаасан алчуур", "Зөөлөн салфетка", "Гар утасны цэнэглэгч"] },
  ],
  "80": [
    { scls: "8001", sclsNm: "Кофе", names: ["Nescafe 3in1", "Americano аяга", "Latte аяга", "Cappuccino аяга", "Кофе шош 200г"] },
    { scls: "8002", sclsNm: "Цай", names: ["Сүүтэй цай аяга", "Ногоон цай", "Хар цай Lipton"] },
  ],
};

function buildSkus(): DemoSku[] {
  const out: DemoSku[] = [];
  for (const cat of DEMO_CATEGORIES) {
    const groups = SKU_SOURCE[cat.mclsCd] ?? [];
    let n = 1;
    const total = groups.reduce((a, g) => a + g.names.length, 0);
    let idx = 0;
    for (const g of groups) {
      for (const name of g.names) {
        out.push({
          itemCd: `${cat.mclsCd}${String(n).padStart(4, "0")}`,
          name,
          mclsCd: cat.mclsCd,
          sclsCd: g.scls,
          sclsNm: g.sclsNm,
          // Эхний барааг хамгийн эрэлттэй / хямд болгож тархаана
          priceIndex: total > 1 ? idx / (total - 1) : 0.5,
          demandIndex: total > 1 ? 1 - idx / (total - 1) : 0.5,
        });
        n++;
        idx++;
      }
    }
  }
  return out;
}

export const DEMO_SKUS: readonly DemoSku[] = buildSkus();

export const CATEGORY_BY_CD = new Map(
  DEMO_CATEGORIES.map((c) => [c.mclsCd, c] as const),
);

/** Бүх конбини заавал агуулдаг цөм ангиллууд — дэлгүүр бүрд бүтнээр нь орно. */
export const CORE_CATEGORIES: readonly string[] = ["20", "21", "30", "31"];
