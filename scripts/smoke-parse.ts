import fs from "fs";
import path from "path";
import { resetEntryIds, parseLogText, mergeParsedFiles } from "../lib/parseFile";
import { buildParsedLog } from "../lib/buildDeals";

const exampleDir = path.join(__dirname, "..", "..", "log example");
const files = ["smartpos.20260720__14.log", "smartpos.20260719__08.log"];

resetEntryIds();
const results = files.map((f) => {
  const text = fs.readFileSync(path.join(exampleDir, f), "utf8");
  return parseLogText(text, f);
});
const { entries, files: metas } = mergeParsedFiles(results);
const parsed = buildParsedLog(entries, metas);

console.log(
  JSON.stringify(
    {
      files: metas.map((m) => ({
        name: m.fileName,
        entries: m.entryCount,
        lines: m.lineCount,
      })),
      totalEntries: entries.length,
      deals: parsed.dealCount,
      errors: parsed.errorCount,
      firstDeal: parsed.deals[0]
        ? {
            index: parsed.deals[0].index,
            start: parsed.deals[0].startTime,
            events: parsed.deals[0].events.length,
            salesNo: parsed.deals[0].salesNo,
            amount: parsed.deals[0].amount,
            payment: parsed.deals[0].paymentMethod,
            hasError: parsed.deals[0].hasError,
            basket: parsed.deals[0].basket,
            paymentInfo: parsed.deals[0].payment,
            ebarimt: parsed.deals[0].ebarimt,
            receiptLineCount: parsed.deals[0].receiptLines?.length ?? 0,
            eventTitles: parsed.deals[0].events
              .slice(0, 12)
              .map((e) => e.title + (e.detail ? " | " + e.detail : "")),
          }
        : null,
      errorDeals: parsed.deals
        .filter((d) => d.errors.length > 0)
        .map((d) => ({
          index: d.index,
          errors: d.errors.map((e) => `${e.technical}: ${e.explanation} ${e.location ?? ""}`),
        })),
      kinds: entries.reduce(
        (a: Record<string, number>, e) => {
          a[e.eventKind] = (a[e.eventKind] || 0) + 1;
          return a;
        },
        {},
      ),
    },
    null,
    2,
  ),
);
