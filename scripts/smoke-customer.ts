import fs from "fs";
import path from "path";
import { resetEntryIds, parseLogText } from "../lib/parseFile";
import { buildParsedLog } from "../lib/buildDeals";

const dir = path.join(__dirname, "..", "..", "log example");
const file = "smartpos.20260720__13.log";
resetEntryIds();
const text = fs.readFileSync(path.join(dir, file), "utf8");
const { entries, meta } = parseLogText(text, file);
const parsed = buildParsedLog(entries, [meta]);
const counts: Record<string, number> = {};
for (const d of parsed.deals) {
  for (const t of d.customer.tags) counts[t] = (counts[t] || 0) + 1;
}
const appDeals = parsed.deals.filter((d) => d.customer.tags.includes("app"));
console.log(
  JSON.stringify(
    {
      deals: parsed.dealCount,
      counts,
      appSamples: appDeals.slice(0, 5).map((d) => ({
        index: d.index,
        tags: d.customer.tags,
        name: d.customer.name,
        phone: d.customer.phone,
      })),
      phoneOnlyLms: parsed.deals.filter(
        (d) =>
          d.customer.tags.includes("lms") && !d.customer.tags.includes("app"),
      ).length,
    },
    null,
    2,
  ),
);
