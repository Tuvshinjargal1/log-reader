/** gs25.mn-ээс ирэх салбарын хялбарчилсан мэдээлэл */
export interface Gs25Branch {
  id: string;
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  isTwentyFourSeven: boolean;
}

/** Нэг POS-ийн нэг өдрийн нэг цагийн борлуулалтын нэгтгэл */
export interface HourlyRow {
  saleDt: string; // YYYYMMDD
  hour: number; // 0-23
  txCount: number;
  amount: number;
}

/** /api/analyze-аас IP тус бүрд ирэх үр дүн */
export interface PosAnalyzeResult {
  ip: string;
  status: "ok" | "failed";
  error?: string;
  bizplCd?: string; // V**** формат
  rows?: HourlyRow[];
}

export interface AnalyzeResponse {
  results: PosAnalyzeResult[];
}

/** Салбар (bizpl_cd) түвшинд нэгтгэсэн ачааллын үзүүлэлт */
export interface BranchLoad {
  bizplCd: string;
  code: string; // V-г хассан код (gs25.mn-ийн code-той тулгахад)
  ips: string[];
  totalTx: number;
  totalAmount: number;
  dayCount: number;
  avgDailyTx: number;
  avgDailyAmount: number;
  peakHour: number | null;
  peakHourAvgTx: number;
  /** Тухайн хугацаанд нэг цагт бүртгэгдсэн хамгийн их чек */
  peakHourMaxTx: number;
  peakHourMaxDate: string | null;
  peakHourMaxHour: number | null;
  /** Тухайн хугацаанд нэг өдөрт бүртгэгдсэн хамгийн их чек */
  peakDayTx: number;
  peakDayDate: string | null;
  /** Хамгийн сүүлийн өдрийн гүйлгээ */
  latestDayTx: number;
  latestDay: string | null;
  dailyTx: { date: string; txCount: number }[];
  hourlyAvgTx: number[]; // 24 элемент — цаг тутмын өдрийн дундаж гүйлгээ
  score: number; // 0-100 ачааллын оноо
  branch: Gs25Branch | null; // газрын зурагтай тулгагдсан салбар
}

/** Шинэ салбар нээхийг санал болгож буй цэг */
export interface Suggestion {
  lat: number;
  lng: number;
  loadSum: number;
  reason: string;
  sourceCodes: string[];
}
