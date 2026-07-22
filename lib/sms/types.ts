/** Нэг барааны борлуулалтын мөр (API-аас) */
export interface SmsItemSale {
  itemCd: string;
  name: string;
  category: string | null;
  price: number | null;
  qty: number;
  daysSold: number;
  stock: number | null;
}

/** /api/sms-analyze — IP тус бүрийн үр дүн */
export interface SmsPosResult {
  ip: string;
  ok: boolean;
  error?: string;
  bizplCd?: string;
  items?: SmsItemSale[];
  stockAvailable?: boolean;
}

export interface SmsAnalyzeResponse {
  results: SmsPosResult[];
}

/** Захиалгын саналын мөр (client-д тооцно) */
export interface OrderSuggestion {
  itemCd: string;
  name: string;
  category: string | null;
  price: number | null;
  qty: number;
  daysSold: number;
  avgDaily: number;
  stock: number | null;
  need: number;
  suggestQty: number;
}

/** Дэлгүүрийн нэгтгэсэн үр дүн */
export interface StoreOrderView {
  key: string;
  ip: string;
  bizplCd: string;
  name: string;
  itemCount: number;
  suggestions: OrderSuggestion[];
  stockAvailable: boolean;
}
