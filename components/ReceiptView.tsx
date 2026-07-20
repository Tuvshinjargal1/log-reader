"use client";

interface ReceiptViewProps {
  lines: string[];
}

interface ReceiptLine {
  key: number;
  text: string;
  bold: boolean;
  kind: "text" | "qr" | "cut";
}

const TAG_RE = /^\[(PLG|NOR|BLD|EBT|CUT|IMG|QR|LOG)\]\[(\d{3})\](.*)$/i;

function parseReceiptLines(raw: string[]): ReceiptLine[] {
  const out: ReceiptLine[] = [];
  let key = 0;
  for (const line of raw) {
    const m = line.match(TAG_RE);
    if (m) {
      const tag = m[1].toUpperCase();
      const text = m[3] ?? "";
      if (tag === "PLG") continue;
      if (tag === "CUT") {
        out.push({ key: key++, text: "", bold: false, kind: "cut" });
        continue;
      }
      if (tag === "EBT" || tag === "QR" || tag === "IMG") {
        out.push({ key: key++, text: "", bold: false, kind: "qr" });
        continue;
      }
      out.push({
        key: key++,
        text: text.trimEnd(),
        bold: tag === "BLD",
        kind: "text",
      });
      continue;
    }
    // Untagged continuation (e.g. lottery number under EBT)
    const t = line.replace(/^\t+/, "").trimEnd();
    if (t) out.push({ key: key++, text: t, bold: false, kind: "text" });
  }
  return out;
}

export function ReceiptView({ lines }: ReceiptViewProps) {
  const parsed = parseReceiptLines(lines);
  if (parsed.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-stone-300 bg-white px-4 py-4 shadow-inner">
      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-stone-800">
        {parsed.map((l) =>
          l.kind === "cut" ? (
            <span key={l.key} className="block border-t border-dashed border-stone-300 pt-1 text-center text-stone-400">
              ✂ - - - - - - - - - - - - - - - -
            </span>
          ) : l.kind === "qr" ? (
            <span
              key={l.key}
              className="my-1 block rounded bg-stone-100 py-1.5 text-center text-stone-400"
            >
              [ QR код / eBarimt ]
            </span>
          ) : (
            <span key={l.key} className={l.bold ? "block font-bold" : "block"}>
              {l.text || "\u00A0"}
            </span>
          ),
        )}
      </pre>
    </div>
  );
}
