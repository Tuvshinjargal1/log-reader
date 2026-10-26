"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BranchLoad, Gs25Branch, Suggestion } from "@/lib/load/types";
import { ymdToIso } from "@/lib/sms/suggest";

interface LoadMapProps {
  branches: Gs25Branch[];
  loads: BranchLoad[];
  suggestions: Suggestion[];
  selectedBizplCd: string | null;
  onSelect: (bizplCd: string) => void;
}

const UB_CENTER: [number, number] = [47.918, 106.917];

function loadColor(score: number): string {
  if (score >= 70) return "#dc2626";
  if (score >= 40) return "#d97706";
  return "#059669";
}

function codeKey(code: string): string {
  return code.trim().replace(/^[Vv]/, "").replace(/^0+/, "");
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function analyzedIcon(score: number, selected: boolean, name: string, dailyTx: number): L.DivIcon {
  const color = loadColor(score);
  const size = selected ? 44 : 36;
  const border = selected ? "3px solid #0f172a" : "3px solid #fff";
  const short =
    name.length > 10 ? name.slice(0, 9) + "…" : name;
  const label = dailyTx > 0 ? String(Math.round(dailyTx)) : String(score);
  return L.divIcon({
    className: "gs25-load-marker",
    html: `<div style="
      display:flex;flex-direction:column;align-items:center;gap:2px;
      transform:translateY(-4px);pointer-events:auto;
    ">
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};color:#fff;font-size:12px;font-weight:700;
        border:${border};box-shadow:0 2px 8px rgba(0,0,0,.45);
        font-family:ui-sans-serif,system-ui,sans-serif;
      ">${label}</div>
      <div style="
        max-width:92px;padding:1px 5px;border-radius:4px;
        background:rgba(15,23,42,.88);color:#fff;font-size:10px;
        font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        box-shadow:0 1px 3px rgba(0,0,0,.35);
        font-family:ui-sans-serif,system-ui,sans-serif;
      ">${short}</div>
    </div>`,
    iconSize: [size, size + 18],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

const suggestionIcon = L.divIcon({
  className: "gs25-suggest-marker",
  html: `<div style="
    display:flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:9999px;
    background:#2563eb;color:#fff;font-size:16px;
    border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);
  ">★</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Танигдсан салбар + санал руу зургийг автоматаар томруулна */
function FitAnalyzed({
  loads,
  suggestions,
}: {
  loads: BranchLoad[];
  suggestions: Suggestion[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    for (const l of loads) {
      if (l.branch?.lat != null && l.branch?.lng != null) {
        points.push([l.branch.lat, l.branch.lng]);
      }
    }
    for (const s of suggestions) {
      points.push([s.lat, s.lng]);
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds.pad(0.35), { animate: true, maxZoom: 15 });
  }, [map, loads, suggestions]);

  return null;
}

export default function LoadMap({
  branches,
  loads,
  suggestions,
  selectedBizplCd,
  onSelect,
}: LoadMapProps) {
  const locatedLoads = useMemo(
    () =>
      loads.filter(
        (l) => l.branch && l.branch.lat !== null && l.branch.lng !== null,
      ),
    [loads],
  );

  const unmatchedLoads = useMemo(
    () => loads.filter((l) => !l.branch),
    [loads],
  );

  const analyzedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const l of locatedLoads) {
      set.add(codeKey(l.branch!.code));
      set.add(codeKey(l.code));
    }
    return set;
  }, [locatedLoads]);

  const unanalyzed = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.lat !== null &&
          b.lng !== null &&
          !analyzedKeys.has(codeKey(b.code)),
      ),
    [branches, analyzedKeys],
  );

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-stone-200">
        <MapContainer
          center={UB_CENTER}
          zoom={12}
          scrollWheelZoom
          className="h-[520px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitAnalyzed loads={locatedLoads} suggestions={suggestions} />

          {/* Бусад салбарууд — маш бүдэг, танигдсаныг дарахгүй */}
          {unanalyzed.map((b) => (
            <CircleMarker
              key={b.id}
              center={[b.lat!, b.lng!]}
              radius={3}
              pathOptions={{
                color: "#a8a29e",
                fillColor: "#d6d3d1",
                fillOpacity: locatedLoads.length > 0 ? 0.25 : 0.55,
                weight: 1,
                opacity: locatedLoads.length > 0 ? 0.3 : 0.6,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-stone-500">Код: {b.code}</div>
                  <div className="text-xs text-stone-400">Шинжлэгдээгүй</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Танигдсан салбарууд — том оноотой маркер + нэр */}
          {locatedLoads.map((l) => {
            const selected = l.bizplCd === selectedBizplCd;
            const name = l.branch!.name || l.bizplCd;
            return (
              <Marker
                key={l.bizplCd}
                position={[l.branch!.lat!, l.branch!.lng!]}
                icon={analyzedIcon(l.score, selected, name, l.avgDailyTx)}
                zIndexOffset={selected ? 1000 : 500 + l.score}
                eventHandlers={{ click: () => onSelect(l.bizplCd) }}
              >
                <Popup>
                  <div className="min-w-52 text-sm">
                    <div className="font-semibold">
                      {name}{" "}
                      <span className="font-mono text-xs text-stone-400">
                        {l.bizplCd}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-stone-400">
                      {l.ips.join(", ")}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-stone-600">
                      <div className="flex justify-between gap-3">
                        <span>Өдрийн гүйлгээ</span>
                        <b className="tabular-nums text-stone-800">
                          {Math.round(l.avgDailyTx).toLocaleString("mn-MN")}
                        </b>
                      </div>
                      <div className="-mt-0.5 text-right text-[10px] text-stone-400">
                        сүүлийн 1 сарын дундаж
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Сарын нийт гүйлгээ</span>
                        <b className="tabular-nums text-stone-800">
                          {l.totalTx.toLocaleString("mn-MN")}
                        </b>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Нэг цагийн хамгийн их</span>
                        <b className="tabular-nums text-stone-800">
                          {l.peakHourMaxTx > 0
                            ? l.peakHourMaxTx.toLocaleString("mn-MN")
                            : "—"}
                        </b>
                      </div>
                      {l.peakHourMaxDate != null && l.peakHourMaxHour != null && (
                        <div className="-mt-0.5 text-right text-[10px] text-stone-400">
                          {ymdToIso(l.peakHourMaxDate)} {fmtHour(l.peakHourMaxHour)}
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span>Өдрийн хамгийн их</span>
                        <b className="tabular-nums text-stone-800">
                          {l.peakDayTx > 0
                            ? l.peakDayTx.toLocaleString("mn-MN")
                            : "—"}
                        </b>
                      </div>
                      {l.peakDayDate && (
                        <div className="-mt-0.5 text-right text-[10px] text-stone-400">
                          {ymdToIso(l.peakDayDate)}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {suggestions.map((s, i) => (
            <Marker
              key={`s-${i}`}
              position={[s.lat, s.lng]}
              icon={suggestionIcon}
              zIndexOffset={800}
            >
              <Popup>
                <div className="min-w-44 text-sm">
                  <div className="font-semibold text-blue-700">
                    Шинэ салбар нээх санал #{i + 1}
                  </div>
                  <div className="mt-1 text-xs text-stone-600">{s.reason}</div>
                  <div className="mt-1 font-mono text-xs text-stone-400">
                    {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Домог */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-md">
          <div className="mb-1 font-semibold text-stone-700">Домог</div>
          <div className="flex flex-col gap-1 text-stone-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-red-600" />{" "}
              Өндөр ачаалал · тоо = өдрийн гүйлгээ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-600" />{" "}
              Дунд (40–69)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />{" "}
              Бага (&lt;40)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">
                ★
              </span>{" "}
              Шинэ салбарын санал
            </span>
            <span className="flex items-center gap-1.5 text-stone-400">
              <span className="inline-block h-2 w-2 rounded-full bg-stone-300" />{" "}
              Шинжлэгдээгүй
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-stone-500">
        <span>
          Зураг дээр:{" "}
          <b className="text-teal-700">{locatedLoads.length}</b> танигдсан салбар
        </span>
        {unmatchedLoads.length > 0 && (
          <span className="text-amber-700">
            <b>{unmatchedLoads.length}</b> салбар gs25.mn-тэй тулгагдаагүй (
            {unmatchedLoads.map((l) => l.bizplCd).join(", ")}) — координат байхгүй
            тул зурагт харагдахгүй
          </span>
        )}
      </div>
    </div>
  );
}
