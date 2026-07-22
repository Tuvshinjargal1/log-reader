export type Priority = 0 | 1 | 2 | 3 | 4;

export type EventKind =
  | "deal_start"
  | "scan"
  | "display_message"
  | "popup"
  | "payment"
  | "ebarimt"
  | "api_send"
  | "api_recv"
  | "http_error"
  | "exception"
  | "receipt"
  | "tender"
  | "other";

export interface LogEntry {
  id: number;
  lineNumber: number;
  priority: Priority;
  time: string;
  date: string | null;
  className: string;
  shortClass: string;
  method: string;
  message: string;
  continuation: string[];
  fileName: string;
  isInOut: boolean;
  isHeartbeat: boolean;
  isError: boolean;
  eventKind: EventKind;
  sortKey: string;
}

export interface DealEvent {
  kind: EventKind;
  time: string;
  title: string;
  detail?: string;
  entryId: number;
  isError?: boolean;
}

export interface BasketItem {
  name: string;
  barCode?: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
}

export interface PaymentInfo {
  method: string;
  amount?: number;
  status?: string;
  cardPan?: string;
}

export interface EbarimtInfo {
  lottery?: string;
  ddtd?: string;
  success: boolean;
}

export interface ErrorSummary {
  entryId: number;
  time: string;
  technical: string;
  explanation: string;
  location?: string;
}

export interface CustomerInfo {
  tags: CustomerTag[];
  name?: string;
  phone?: string;
  customerId?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  vouchersUsed?: { id?: string; amount?: number }[];
  couponsUsed?: { name?: string; discountApplied?: number }[];
}

export type CustomerTag =
  | "lms"
  | "app"
  | "voucher"
  | "coupon"
  | "points"
  | "guest";

export interface Deal {
  id: string;
  index: number;
  startTime: string;
  endTime: string;
  date: string | null;
  durationMs: number;
  hasError: boolean;
  salesNo?: string;
  amount?: number;
  paymentMethod?: string;
  events: DealEvent[];
  entryIds: number[];
  entryStart: number;
  entryEnd: number;
  basket: BasketItem[];
  payment?: PaymentInfo;
  ebarimt?: EbarimtInfo;
  errors: ErrorSummary[];
  receiptLines?: string[];
  customer: CustomerInfo;
}

export interface ParsedFileMeta {
  fileName: string;
  date: string | null;
  hour: string | null;
  lineCount: number;
  entryCount: number;
}

export interface ParsedLog {
  files: ParsedFileMeta[];
  entries: LogEntry[];
  deals: Deal[];
  errorCount: number;
  dealCount: number;
}

export interface LogFiltersState {
  query: string;
  priorities: Priority[];
  modules: string[];
  hideInOut: boolean;
  hideHeartbeat: boolean;
  onlyErrors: boolean;
  onlyApi: boolean;
  dealEntryIds: number[] | null;
}
