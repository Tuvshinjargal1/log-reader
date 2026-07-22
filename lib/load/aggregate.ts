import type {
  BranchLoad,
  Gs25Branch,
  PosAnalyzeResult,
} from "./types";

/** "V5291" → "5291", хоосон тэгүүдийг хасаж жигдэлнэ */
export function normalizeCode(bizplCd: string): string {
  return bizplCd.trim().replace(/^[Vv]/, "").replace(/^0+/, "");
}

/** Нэг кодын бүх боломжит түлхүүр (4 оронтой pad гэх мэт) */
function codeAliases(code: string): string[] {
  const raw = code.trim().replace(/^[Vv]/, "");
  const stripped = raw.replace(/^0+/, "") || "0";
  const aliases = new Set<string>([stripped, raw]);
  if (/^\d+$/.test(stripped)) {
    aliases.add(stripped.padStart(4, "0"));
    aliases.add(stripped.padStart(5, "0"));
  }
  return [...aliases];
}

function findBranch(
  map: Map<string, Gs25Branch>,
  bizplCd: string,
): Gs25Branch | null {
  for (const key of codeAliases(bizplCd)) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  return null;
}

/**
 * IP тус бүрийн үр дүнг bizpl_cd-ээр нэгтгэж, ачааллын оноо тооцно.
 * Оноо = 0.6 × (өдрийн дундаж гүйлгээ / хамгийн их) + 0.4 × (оргил цагийн эрчим / хамгийн их)
 */
export function buildBranchLoads(
  results: PosAnalyzeResult[],
  branches: Gs25Branch[],
): BranchLoad[] {
  const branchByCode = new Map<string, Gs25Branch>();
  for (const b of branches) {
    for (const key of codeAliases(b.code)) {
      if (!branchByCode.has(key)) branchByCode.set(key, b);
    }
  }

  const groups = new Map<
    string,
    { ips: string[]; byDayHour: Map<string, { tx: number; amt: number }> }
  >();

  for (const r of results) {
    if (r.status !== "ok" || !r.bizplCd) continue;
    const key = r.bizplCd.trim().toUpperCase();
    let g = groups.get(key);
    if (!g) {
      g = { ips: [], byDayHour: new Map() };
      groups.set(key, g);
    }
    g.ips.push(r.ip);
    for (const row of r.rows ?? []) {
      const k = `${row.saleDt}|${row.hour}`;
      const cur = g.byDayHour.get(k) ?? { tx: 0, amt: 0 };
      cur.tx += row.txCount;
      cur.amt += row.amount;
      g.byDayHour.set(k, cur);
    }
  }

  const loads: BranchLoad[] = [];
  for (const [bizplCd, g] of groups) {
    const days = new Set<string>();
    const hourlyTx = new Array<number>(24).fill(0);
    let totalTx = 0;
    let totalAmount = 0;

    for (const [k, v] of g.byDayHour) {
      const [saleDt, hourStr] = k.split("|");
      const hour = Number(hourStr);
      days.add(saleDt);
      totalTx += v.tx;
      totalAmount += v.amt;
      if (hour >= 0 && hour < 24) hourlyTx[hour] += v.tx;
    }

    const dayCount = Math.max(days.size, 1);
    const hourlyAvgTx = hourlyTx.map((t) => t / dayCount);

    let peakHour: number | null = null;
    let peakHourAvgTx = 0;
    for (let h = 0; h < 24; h++) {
      if (hourlyAvgTx[h] > peakHourAvgTx) {
        peakHourAvgTx = hourlyAvgTx[h];
        peakHour = h;
      }
    }

    const code = normalizeCode(bizplCd);
    loads.push({
      bizplCd,
      code,
      ips: g.ips,
      totalTx,
      totalAmount,
      dayCount: days.size,
      avgDailyTx: totalTx / dayCount,
      avgDailyAmount: totalAmount / dayCount,
      peakHour,
      peakHourAvgTx,
      hourlyAvgTx,
      score: 0,
      branch: findBranch(branchByCode, bizplCd),
    });
  }

  const maxAvg = Math.max(...loads.map((l) => l.avgDailyTx), 1);
  const maxPeak = Math.max(...loads.map((l) => l.peakHourAvgTx), 1);
  for (const l of loads) {
    l.score = Math.round(
      100 * (0.6 * (l.avgDailyTx / maxAvg) + 0.4 * (l.peakHourAvgTx / maxPeak)),
    );
  }

  loads.sort((a, b) => b.score - a.score);
  return loads;
}
