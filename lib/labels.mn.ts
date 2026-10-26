export const PRIORITY_LABELS: Record<number, string> = {
  0: "Хамгийн бага",
  1: "Мэдээлэл",
  2: "Анхааруулга",
  3: "Дэлгэрэнгүй",
  4: "Чухал",
};

const MODULE_LABELS: Record<string, string> = {
  ItemSaleViewPresenter: "Борлуулалт",
  TranCompleteViewPresenter: "Гүйлгээ дуусгах",
  EbarimtViewPresenter: "eBarimt",
  PosMainViewPresenter: "Үндсэн дэлгэц",
  CustomerDisplayViewPresenter: "Үйлчлүүлэгчийн дэлгэц",
  ApprovalMgr: "Зөвшөөрөл / төлбөр",
  ReceiptMgr: "Баримт",
  PopupManager: "Цонх нээх",
  ViewManager: "Дэлгэц солих",
  EncryptMgr: "Шифрлэлт",
  ItemRegiMgr: "Бараа бүртгэл",
  MPayTenderViewPresenter: "Мобайл төлбөр",
  MPayTenderView: "Мобайл төлбөр",
  MPayTenderMgr: "Мобайл төлбөр",
  BankCardTenderViewPresenter: "Банкны карт",
  BankCardTenderView: "Банкны карт",
  UnityTenderViewPresenter: "Төлбөрийн сонголт",
  CashTenderViewPresenter: "Бэлэн мөнгө",
  PosPrinterUtil: "Принтер",
  ShellForm: "POS Shell",
  Start_Monitor: "Хяналт",
};

const EVENT_LABELS: Record<string, string> = {
  deal_start: "Борлуулалт эхэлсэн",
  scan: "Бараа скан",
  display_message: "Дэлгэцийн мессеж",
  popup: "Цонх нээгдсэн",
  payment: "Төлбөр",
  ebarimt: "eBarimt",
  api_send: "API илгээсэн",
  api_recv: "API хариу",
  http_error: "HTTP алдаа",
  exception: "Системийн алдаа",
  receipt: "Баримт хэвлэсэн",
  tender: "Төлбөрийн төрөл",
  other: "Бусад",
};

const VIEW_LABELS: Record<string, string> = {
  ScrSaverView: "Дэлгэц хамгаалагч",
  MPayTenderView: "Мобайл төлбөр",
  BankCardTenderView: "Банкны карт",
  UnityTenderView: "Төлбөр сонгох",
  CashTenderView: "Бэлэн мөнгө",
  EbarimtView: "eBarimt",
  TranCompleteView: "Гүйлгээ дууссан",
  ItemSaleView: "Борлуулалт",
};

const PAYMENT_LABELS: Record<string, string> = {
  QPAY: "QPay",
  SOCIALPAY: "SocialPay",
  MPAY: "MPay",
  TDB: "TDB",
  CASH: "Бэлэн мөнгө",
  CARD: "Карт",
  BANKCARD: "Банкны карт",
  PAYMENT_CARD: "Карт",
};

export function moduleLabel(shortClass: string): string {
  return MODULE_LABELS[shortClass] ?? shortClass;
}

export function eventLabel(kind: string): string {
  return EVENT_LABELS[kind] ?? kind;
}

export function viewLabel(viewName: string): string {
  return VIEW_LABELS[viewName] ?? viewName;
}

export function paymentLabel(method: string): string {
  const key = method.toUpperCase();
  return PAYMENT_LABELS[key] ?? method;
}

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? String(priority);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("mn-MN").format(amount) + " ₮";
}

/**
 * Богиносгосон дүн — тэнхлэгийн заалт, бөмбөлгийн шошго, tooltip-д.
 * `formatAmount` нь "1,435,200 ₮" гаргадаг бөгөөд 10px хэмжээтэй бөмбөлөг
 * дотор уншигдахгүй. Хүснэгт, нийт дүнд `formatAmount` хэвээр ашиглана.
 */
export function formatCompactMnt(amount: number): string {
  const a = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (a >= 1_000_000_000) return `${sign}${(a / 1_000_000_000).toFixed(1)} тэрбум ₮`;
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)} сая ₮`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)} мянга ₮`;
  return `${sign}${Math.round(a)} ₮`;
}

/** 0..1 → "84%" */
export function formatPct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Хувийн зөрүү — "н.э." = нэгж эзлэх хувь (percentage point) */
export function formatPctPoints(delta: number): string {
  const v = delta * 100;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1)} н.э.`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} сек` : `${m} мин`;
}
