import type { LogEntry } from "./types";

interface ErrorExplanation {
  explanation: string;
  location?: string;
}

const EXCEPTION_EXPLANATIONS: [RegExp, string][] = [
  [
    /NullReferenceException/i,
    "Программын дотоод алдаа гарсан. Гүйлгээнд нөлөөлсөн эсэхийг шалгана уу.",
  ],
  [
    /TimeoutException|timed?\s*out/i,
    "Хариу хүлээх хугацаа хэтэрсэн. Сүлжээ эсвэл сервер удаан байж болзошгүй.",
  ],
  [
    /SocketException|WebException|HttpRequestException/i,
    "Сүлжээний холболтын алдаа. Интернэт эсвэл серверийн холболтыг шалгана уу.",
  ],
  [
    /SqlException|DbException/i,
    "Өгөгдлийн сангийн алдаа гарсан.",
  ],
  [
    /IOException|FileNotFoundException/i,
    "Файл эсвэл төхөөрөмжид хандахад алдаа гарсан.",
  ],
  [
    /InvalidOperationException/i,
    "Программ буруу дарааллаар үйлдэл хийхийг оролдсон дотоод алдаа.",
  ],
  [
    /ArgumentException|FormatException/i,
    "Буруу утга/формат бүхий өгөгдөл боловсруулах гэж оролдсон.",
  ],
];

const LOCATION_LABELS: [RegExp, string][] = [
  [/EbarimtViewPresenter/i, "eBarimt дэлгэц дээр"],
  [/ItemSaleViewPresenter/i, "борлуулалтын дэлгэц дээр"],
  [/TranComplete/i, "гүйлгээ дуусгах үед"],
  [/ApprovalMgr/i, "төлбөрийн зөвшөөрөл авах үед"],
  [/ReceiptMgr|PosPrinter/i, "баримт хэвлэх үед"],
  [/Tender/i, "төлбөр төлөх дэлгэц дээр"],
  [/PosMainViewPresenter/i, "үндсэн дэлгэц дээр"],
  [/CustomerDisplay/i, "үйлчлүүлэгчийн дэлгэц дээр"],
];

export function explainError(entry: LogEntry): ErrorExplanation {
  const full = [entry.message, ...entry.continuation].join("\n");

  if (/HTTP communication error/i.test(full)) {
    return {
      explanation:
        "Сервертэй холбогдож чадаагүй. Интернэт холболт эсвэл серверийг шалгана уу.",
      location: findLocation(full) ?? findLocation(entry.className),
    };
  }

  if (
    /\bRECV\b/i.test(entry.message) &&
    /"status"\s*:\s*"(ERROR|FAIL|FAILED)"/i.test(full)
  ) {
    if (/receipt|lottery|ddtd/i.test(full)) {
      return { explanation: "eBarimt баримт үүсээгүй." };
    }
    return { explanation: "Сервер алдаатай хариу буцаасан." };
  }

  for (const [re, explanation] of EXCEPTION_EXPLANATIONS) {
    if (re.test(full)) {
      return {
        explanation,
        location: findLocation(full),
      };
    }
  }

  return {
    explanation: "Системийн алдаа бүртгэгдсэн.",
    location: findLocation(full) ?? findLocation(entry.className),
  };
}

/** Short technical name of the error, e.g. "NullReferenceException". */
export function technicalName(entry: LogEntry): string {
  const full = [entry.message, ...entry.continuation].join("\n");
  const typed =
    full.match(/exception of type '([^']+)'/i)?.[1] ||
    full.match(/^Type\s*:\s*([^,\n]+)/m)?.[1];
  if (typed) {
    const parts = typed.trim().split(".");
    return parts[parts.length - 1];
  }
  if (/HTTP communication error/i.test(full)) return "HTTP холболтын алдаа";
  return entry.shortClass;
}

function findLocation(text: string): string | undefined {
  for (const [re, label] of LOCATION_LABELS) {
    if (re.test(text)) return label;
  }
  return undefined;
}
