"use client";

/**
 * 位置情報の共有ストア
 * ホーム画面で取得した現在地を、神社詳細のチェックイン判定でも使い回す。
 * 動作確認用に「テスト位置」を設定して神社の座標を擬似現在地にできる。
 */
export type PositionSource = "gps" | "test";

export type StoredPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  source: PositionSource;
  label: string;
  updated_at: number;
};

const KEY = "kamitabicho:position";
const listeners = new Set<(p: StoredPosition | null) => void>();
let current: StoredPosition | null = null;

function emit() {
  listeners.forEach((cb) => cb(current));
}

export function readStoredPosition(): StoredPosition | null {
  if (current) return current;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as StoredPosition) : null;
  } catch {
    current = null;
  }
  return current;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (current) window.sessionStorage.setItem(KEY, JSON.stringify(current));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* ストレージ不可の環境ではメモリのみで動作 */
  }
  emit();
}

export function setPosition(pos: Omit<StoredPosition, "updated_at">) {
  current = { ...pos, updated_at: Date.now() };
  persist();
}

export function clearPosition() {
  current = null;
  persist();
}

export function subscribePosition(cb: (p: StoredPosition | null) => void) {
  listeners.add(cb);
  cb(readStoredPosition());
  return () => {
    listeners.delete(cb);
  };
}
