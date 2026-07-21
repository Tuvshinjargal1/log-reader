import fs from "fs";
import path from "path";
import { resetEntryIds, parseLogText, mergeParsedFiles } from "../lib/parseFile";
import { buildParsedLog } from "../lib/buildDeals";

const exampleDir = path.join(__dirname, "..", "..", "log example");
const files = ["smartpos.log", "smartpos.20260720__14.log"];

resetEntryIds();
const results = files.map((f) => {
  const text = fs.readFileSync(path.join(exampleDir, f), "utf8");
  return parseLogText(text, f);
});
const { entries, files: metas } = mergeParsedFiles(results);
const parsed = buildParsedLog(entries, metas);

const plain = results[0];
const plainParsed = buildParsedLog(plain.entries, [plain.meta]);
const d = plainParsed.deals[0];

console.log(
  JSON.stringify(
    {
      plainMeta: plain.meta,
      plainDeals: plainParsed.dealCount,
      plainFirst: d
        ? {
            date: d.date,
            amount: d.amount,
            payment: d.paymentMethod,
            basket: d.basket.map((b) => b.name),
            ebarimt: d.ebarimt,
          }
        : null,
      files: metas.map((m) => ({
        name: m.fileName,
        date: m.date,
        hour: m.hour,
        entries: m.entryCount,
      })),
      totalEntries: entries.length,
      deals: parsed.dealCount,
      errors: parsed.errorCount,
    },
    null,
    2,
  ),
);
