/**
 * 位置情報ユーティリティ
 * GPS チェックインの「神社から300m以内」判定をここに集約する。
 */

/** チェックインを許可する半径（メートル）。仕様で 300m 固定。 */
export const CHECKIN_RADIUS_M = 300;

/** 地球の平均半径（メートル） */
const EARTH_RADIUS_M = 6371000;

export type LatLng = { latitude: number; longitude: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * 2点間の距離をヘヴァサイン公式で求める（メートル）。
 * 誤差は実用上無視できる範囲（数百mスケールで数cm以内）。
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 300m 以内かどうか */
export function isWithinCheckinRadius(from: LatLng, shrine: LatLng): boolean {
  return distanceMeters(from, shrine) <= CHECKIN_RADIUS_M;
}

/** 「120m」「1.4km」のような表示用フォーマット */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "-";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** 現在地を1回取得する（Promise ラッパー） */
export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("この端末では位置情報を利用できません。"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const messages: Record<number, string> = {
        1: "位置情報の利用が許可されていません。端末の設定から許可してください。",
        2: "現在地を取得できませんでした。電波の良い場所で再度お試しください。",
        3: "位置情報の取得がタイムアウトしました。もう一度お試しください。",
      };
      reject(new Error(messages[err.code] ?? "位置情報の取得に失敗しました。"));
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    });
  });
}

/** 座標を日本式の度分秒表記にする（例: 34°27'18"N 136°43'32"E） */
export function formatLatLng(lat: number, lng: number): string {
  const fmt = (v: number, pos: string, neg: string) => {
    const dir = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = Math.round(((abs - d) * 60 - m) * 60);
    return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"${dir}`;
  };
  return `${fmt(lat, "N", "S")} ${fmt(lng, "E", "W")}`;
}
