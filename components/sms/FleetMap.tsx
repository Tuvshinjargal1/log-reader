"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Gs25Branch } from "@/lib/load/types";
import type { FleetStore } from "@/lib/replenish/fleet";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/diagram/colors";

interface FleetMapProps {
  stores: FleetStore[];
  branches: Gs25Branch[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const UB_CENTER: [number, number] = [47.918, 106.917];

function codeKey(code: string): string {
  return code.trim().replace(/^[Vv]/, "").replace(/^0+/, "");
}

function storeIcon(s: FleetStore, selected: boolean): L.DivIcon {
  const color = STATUS_COLOR[s.status];
  const size = selected ? 40 : 32;
  const ring = s.mode === "auto" ? "#059669" : "#d97706";
  const short = s.name.length > 10 ? s.name.slice(0, 9) + "…" : s.name;
  return L.divIcon({
    className: "gs25-fleet-marker",
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:translateY(-4px)">
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};
        border:3px solid ${selected ? "#0f172a" : ring};box-shadow:0 2px 6px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;
        font-family:ui-sans-serif,system-ui,sans-serif;">
        ${s.mode === "auto" ? "A" : "M"}</div>
      <div style="max-width:88px;padding:1px 5px;border-radius:4px;background:rgba(15,23,42,.85);
        color:#fff;font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        font-family:ui-sans-serif,system-ui,sans-serif;">${short}</div>
    </div>`,
    iconSize: [size, size + 16],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 15 });
  }, [map, points]);
  return null;
}

export default function FleetMap({
  stores,
  branches,
  selectedId,
  onSelect,
}: FleetMapProps) {
  const branchByCode = useMemo(() => {
    const m = new Map<string, Gs25Branch>();
    for (const b of branches) m.set(codeKey(b.code), b);
    return m;
  }, [branches]);

  const located = useMemo(() => {
    return stores
      .map((s) => {
        let lat = s.lat;
        let lng = s.lng;
        if ((lat == null || lng == null) && s.code) {
          const b = branchByCode.get(codeKey(s.code));
          if (b) {
            lat = b.lat;
            lng = b.lng;
          }
        }
        return lat != null && lng != null ? { s, lat, lng } : null;
      })
      .filter((x): x is { s: FleetStore; lat: number; lng: number } => x != null);
  }, [stores, branchByCode]);

  const points = useMemo<[number, number][]>(
    () => located.map((l) => [l.lat, l.lng]),
    [located],
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200">
      <MapContainer center={UB_CENTER} zoom={12} scrollWheelZoom className="h-[480px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {located.map(({ s, lat, lng }) => (
          <Marker
            key={s.id}
            position={[lat, lng]}
            icon={storeIcon(s, s.id === selectedId)}
            zIndexOffset={s.id === selectedId ? 1000 : 500}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            <Popup>
              <div className="min-w-44 text-sm">
                <div className="font-semibold">{s.name}</div>
                <div className="mt-1 space-y-0.5 text-xs text-stone-600">
                  <div>Төлөв: {STATUS_LABEL[s.status]}</div>
                  <div>Горим: {s.mode === "auto" ? "Автомат" : "Гараар"}</div>
                  {s.order && (
                    <div>
                      Захиалга: {s.order.totalQty} ширхэг / {s.order.lineCount} бараа
                    </div>
                  )}
                  {(s.alerts.critical > 0 || s.alerts.warn > 0) && (
                    <div className="text-amber-700">
                      Дохио: {s.alerts.critical} ноцтой, {s.alerts.warn} анхаар
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-stone-200 bg-white/95 px-3 py-2 text-xs shadow-md">
        <div className="mb-1 font-semibold text-stone-700">Домог</div>
        <div className="flex flex-col gap-1 text-stone-600">
          {(["healthy", "stockout", "tuning", "offline"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: STATUS_COLOR[k] }}
              />
              {STATUS_LABEL[k]}
            </span>
          ))}
          <span className="mt-1 text-stone-400">A=Автомат · M=Гараар</span>
        </div>
      </div>
    </div>
  );
}
