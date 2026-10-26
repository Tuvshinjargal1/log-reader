/** Захиалгын горим */
export type OrderMode = "auto" | "manual";

/** Config-ийн давхарга (provenance) */
export type ConfigLayer = "global" | "store" | "category" | "item";

/** Бүх дэлгүүрийн суурь утга (global_defaults, ганц мөр) */
export interface GlobalDefaults {
  mode: OrderMode;
  reviewPeriodDays: number;
  leadTimeDays: number;
  coverDays: number;
  serviceLevel: number;
  autoSubmitMaxAmount: number | null;
}

/** Дэлгүүрийн түвшний override (null = тухайн талбарыг дараадаагүй) */
export interface StoreConfigRow {
  mode: OrderMode | null;
  reviewPeriodDays: number | null;
  leadTimeDays: number | null;
  coverDays: number | null;
  serviceLevel: number | null;
  autoSubmitMaxAmount: number | null;
}

/** Ангиллын түвшний override */
export interface CategoryConfigRow {
  mode: OrderMode | null;
  coverDays: number | null;
  serviceLevel: number | null;
}

/** Барааны түвшний override */
export interface ItemConfigRow {
  mode: OrderMode | null;
  coverDays: number | null;
  serviceLevel: number | null;
  orderMultiple: number | null;
  minQty: number | null;
  maxQty: number | null;
  shelfLifeDays: number | null;
}

/** Барааны каталогийн үндсэн шинж (override биш — суурь атрибут) */
export interface ItemCatalog {
  orderMultiple: number;
  minQty: number | null;
  maxQty: number | null;
  leadTimeDays: number | null;
  shelfLifeDays: number | null;
  perishable: boolean;
}

/** Тооцоонд шууд орох эцсийн (resolved) утга */
export interface EffectiveConfig {
  mode: OrderMode;
  reviewPeriodDays: number;
  leadTimeDays: number;
  coverDays: number;
  serviceLevel: number;
  orderMultiple: number;
  minQty: number | null;
  maxQty: number | null;
  shelfLifeDays: number | null;
  perishable: boolean;
  autoSubmitMaxAmount: number | null;
}

/** Талбар бүр аль давхаргаас шийдэгдснийг тэмдэглэнэ (диаграмын тайлбар) */
export type ConfigSources = Partial<Record<keyof EffectiveConfig, ConfigLayer>>;

export interface ResolvedConfig {
  value: EffectiveConfig;
  sources: ConfigSources;
}
