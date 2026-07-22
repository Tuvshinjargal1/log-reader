import type { BranchLoad, Gs25Branch, Suggestion } from "./types";

const OVERLOAD_TOP_RATIO = 0.15; // дээд 15% — "хэт ачаалалтай"
const PAIR_MAX_DIST_M = 2000; // хос салбарын хоорондын дээд зай
const MIN_DIST_TO_EXISTING_M = 300; // одоо байгаа салбараас хамгийн багадаа
const LONE_OFFSET_M = 500; // ганц ачаалалтай салбарын эргэн тойрны офсет
const MAX_SUGGESTIONS = 6;

interface Point {
  lat: number;
  lng: number;
}

/** Хоёр цэгийн хоорондын зай метрээр (haversine) */
export function distanceM(a: Point, b: Point): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function offsetPoint(p: Point, dNorthM: number, dEastM: number): Point {
  const dLat = (dNorthM / 6371000) * (180 / Math.PI);
  const dLng =
    (dEastM / (6371000 * Math.cos((p.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

interface Located {
  load: BranchLoad;
  lat: number;
  lng: number;
}

/**
 * Шинэ салбар нээх байршлын санал:
 * 1. Оноогоор дээд 15% салбарыг хэт ачаалалтайд тооцно
 * 2. 2км дотор орших хэт ачаалалтай хосын жигнэсэн дундаж цэг,
 *    ганц бол эргэн тойрны 500м офсет цэгүүдийг нэр дэвшүүлнэ
 * 3. Одоо байгаа аль ч салбараас 300м-ээс ойрыг хасна
 * 4. Ойролцоох ачааллын нийлбэрээр эрэмбэлж топ саналыг буцаана
 */
export function suggestLocations(
  loads: BranchLoad[],
  allBranches: Gs25Branch[],
): Suggestion[] {
  const located: Located[] = loads
    .filter((l) => l.branch && l.branch.lat !== null && l.branch.lng !== null)
    .map((l) => ({ load: l, lat: l.branch!.lat!, lng: l.branch!.lng! }));

  if (located.length === 0) return [];

  const sorted = [...located].sort((a, b) => b.load.score - a.load.score);
  const overloadedCount = Math.max(1, Math.ceil(sorted.length * OVERLOAD_TOP_RATIO));
  const overloaded = sorted.slice(0, overloadedCount);

  const existing: Point[] = allBranches
    .filter((b) => b.lat !== null && b.lng !== null)
    .map((b) => ({ lat: b.lat!, lng: b.lng! }));

  const candidates: Suggestion[] = [];
  const pairedIdx = new Set<number>();

  // (а) Ойр орших хэт ачаалалтай хосуудын жигнэсэн дундаж цэг
  for (let i = 0; i < overloaded.length; i++) {
    for (let j = i + 1; j < overloaded.length; j++) {
      const a = overloaded[i];
      const b = overloaded[j];
      const d = distanceM(a, b);
      if (d > PAIR_MAX_DIST_M || d < 1) continue;
      const wa = a.load.score;
      const wb = b.load.score;
      const lat = (a.lat * wa + b.lat * wb) / (wa + wb);
      const lng = (a.lng * wa + b.lng * wb) / (wa + wb);
      pairedIdx.add(i);
      pairedIdx.add(j);
      candidates.push({
        lat,
        lng,
        loadSum: wa + wb,
        reason: `${branchName(a.load)}, ${branchName(b.load)} салбаруудын хооронд — хоёуланг нь хөнгөвчилнө`,
        sourceCodes: [a.load.code, b.load.code],
      });
    }
  }

  // (б) Ганцаараа хэт ачаалалтай салбарын эргэн тойрны офсет цэгүүд
  for (let i = 0; i < overloaded.length; i++) {
    if (pairedIdx.has(i)) continue;
    const o = overloaded[i];
    const offsets: Point[] = [
      offsetPoint(o, LONE_OFFSET_M, 0),
      offsetPoint(o, 0, LONE_OFFSET_M),
      offsetPoint(o, -LONE_OFFSET_M, 0),
      offsetPoint(o, 0, -LONE_OFFSET_M),
    ];
    // Одоо байгаа салбаруудаас хамгийн хол офсетыг сонгоно
    let best: Point | null = null;
    let bestMinDist = -1;
    for (const p of offsets) {
      const minDist = Math.min(...existing.map((e) => distanceM(p, e)));
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = p;
      }
    }
    if (best) {
      candidates.push({
        lat: best.lat,
        lng: best.lng,
        loadSum: o.load.score,
        reason: `${branchName(o.load)} салбарын ачааллыг хуваалцана`,
        sourceCodes: [o.load.code],
      });
    }
  }

  // Одоо байгаа салбараас хэт ойр цэгүүдийг хасна
  const valid = candidates.filter((c) =>
    existing.every((e) => distanceM(c, e) >= MIN_DIST_TO_EXISTING_M),
  );

  // Ойролцоо давхцах саналуудаас өндөр ачаалалтайг нь үлдээнэ
  valid.sort((a, b) => b.loadSum - a.loadSum);
  const picked: Suggestion[] = [];
  for (const c of valid) {
    if (picked.some((p) => distanceM(p, c) < MIN_DIST_TO_EXISTING_M)) continue;
    picked.push(c);
    if (picked.length >= MAX_SUGGESTIONS) break;
  }

  return picked;
}

function branchName(load: BranchLoad): string {
  return load.branch?.name ?? load.bizplCd;
}
