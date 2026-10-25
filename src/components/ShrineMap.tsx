"use client";

/**
 * 地図表示
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY があれば Google Maps、未設定なら OpenStreetMap の
 * 埋め込み地図を表示する（APIキーなしでも全機能を確認できる）。
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type MapMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind?: "shrine" | "current" | "visited";
};

type Props = {
  markers: MapMarker[];
  center?: { latitude: number; longitude: number } | null;
  height?: number;
  zoom?: number;
  className?: string;
  /** 外部地図アプリで開くリンクを出すか */
  showLinks?: boolean;
};

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

declare global {
  interface Window {
    google?: any;
    __kamitabichoMapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__kamitabichoMapsPromise) return window.__kamitabichoMapsPromise;
  window.__kamitabichoMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=ja&region=JP`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps の読み込みに失敗しました。"));
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return window.__kamitabichoMapsPromise;
}

function osmUrl(markers: MapMarker[], center: { latitude: number; longitude: number }, zoomHint: number) {
  const lats = markers.map((m) => m.latitude).concat(center.latitude);
  const lngs = markers.map((m) => m.longitude).concat(center.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.006) * 1.6 + zoomHint * 0.0015;
  const bbox = [minLng - span, minLat - span, maxLng + span, maxLat + span].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.latitude},${center.longitude}`;
}

export default function ShrineMap({
  markers,
  center,
  height = 240,
  zoom = 14,
  className = "",
  showLinks = false,
}: Props) {
  const containerId = useId().replace(/[:]/g, "_");
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [failed, setFailed] = useState(false);

  const focus = center ?? (markers[0] ? { latitude: markers[0].latitude, longitude: markers[0].longitude } : null);
  const markersKey = useMemo(
    () => JSON.stringify(markers.map((m) => [m.id, m.latitude, m.longitude, m.kind])),
    [markers],
  );
  const latestMarkers = useRef(markers);
  latestMarkers.current = markers;

  useEffect(() => {
    if (!MAPS_KEY || !focus) return;
    let cancelled = false;
    loadGoogleMaps(MAPS_KEY)
      .then(() => {
        if (cancelled || !window.google?.maps) return;
        const g = window.google.maps;
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!mapRef.current) {
          mapRef.current = new g.Map(el, {
            center: { lat: focus.latitude, lng: focus.longitude },
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "cooperative",
          });
        } else {
          mapRef.current.setCenter({ lat: focus.latitude, lng: focus.longitude });
        }
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = latestMarkers.current.map(
          (m) =>
            new g.Marker({
              map: mapRef.current,
              position: { lat: m.latitude, lng: m.longitude },
              title: m.name,
              ...(m.kind === "current"
                ? {
                    icon: {
                      path: g.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: "#2f4058",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    },
                  }
                : {}),
            }),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [containerId, focus?.latitude, focus?.longitude, markersKey, zoom]);

  const externalLinks = showLinks && focus && (
    <div className="flex items-center justify-between gap-2 bg-washi-deep/70 px-3 py-2">
      <p className="text-[0.7rem] text-sumi-mute">
        {MAPS_KEY && !failed ? "Google マップ" : "簡易地図（OpenStreetMap）"}
      </p>
      <div className="flex gap-3 text-[0.74rem] font-semibold">
        <a
          className="text-shu underline"
          href={`https://www.google.com/maps/search/?api=1&query=${focus.latitude},${focus.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Googleマップで開く
        </a>
        <a
          className="text-shu underline"
          href={`https://www.google.com/maps/dir/?api=1&destination=${focus.latitude},${focus.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          経路
        </a>
      </div>
    </div>
  );

  if (!MAPS_KEY || failed) {
    if (!focus) {
      return (
        <div
          className={`wa-card flex items-center justify-center text-[0.84rem] text-sumi-mute ${className}`}
          style={{ height }}
        >
          位置情報を取得すると地図が表示されます
        </div>
      );
    }
    return (
      <div className={`wa-card overflow-hidden ${className}`}>
        <div className="relative" style={{ height }}>
          {/* 地図が読み込めない環境でも「壊れて見えない」ための下地 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[linear-gradient(0deg,rgba(221,210,186,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(221,210,186,.35)_1px,transparent_1px)] bg-[size:28px_28px] bg-paper"
            aria-hidden
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-shu/40 text-shu">⛩</span>
            <p className="font-mincho text-[0.84rem] font-semibold">{markers[0]?.name ?? "神社"}</p>
            <p className="text-[0.68rem] text-sumi-mute">地図を読み込んでいます…</p>
          </div>
          <iframe
            title="地図"
            src={osmUrl(markers, focus, zoom)}
            className="relative h-full w-full border-0"
            loading="lazy"
          />
        </div>
        {externalLinks}
      </div>
    );
  }

  return (
    <div className={`wa-card overflow-hidden ${className}`}>
      <div id={containerId} style={{ height, width: "100%" }} />
      {externalLinks}
    </div>
  );
}
