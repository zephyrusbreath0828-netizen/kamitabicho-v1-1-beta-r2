/**
 * v1.0（MVP）の localStorage データ読み出し
 *
 * 初回 Google ログイン時に Firestore へ移行するための取り込み処理。
 * 旧バージョンは `kamitabicho:demo:v1`、v1.1 のデモは `kamitabicho:demo:v2` に
 * データを保存しているため、両方の形を読み取れるようにしている。
 *
 * 破壊的な操作は一切行わない（読み取りのみ）。
 */
import type { Goshuin, LegacyGoshuinRecord, LegacyVisitRecord, MigrationPayload, UserProfile, Visit } from "@/lib/types";

export const LEGACY_DATA_KEYS = ["kamitabicho:demo:v2", "kamitabicho:demo:v1"] as const;
/** 二重移行防止フラグ（localStorage 側の第一の防壁） */
export const MIGRATION_FLAG_KEY = "kamitabicho:migration:v1";
/** デモモードを選択したことを記憶するキー */
export const MODE_KEY = "kamitabicho:mode";

type UnknownRecord = Record<string, unknown>;

function parse(raw: string | null): UnknownRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as UnknownRecord) : null;
  } catch {
    return null;
  }
}

/** 旧 visit（visited_at）→ visit（visit_datetime） */
export function normalizeVisit(raw: LegacyVisitRecord, fallbackUser = ""): Visit | null {
  const shrineId = String(raw.shrine_id ?? "");
  if (!shrineId) return null;
  const when = raw.visit_datetime ?? raw.visited_at ?? new Date().toISOString();
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  return {
    id: String(raw.id ?? `legacy_${shrineId}`),
    user_id: String(raw.user_id ?? fallbackUser),
    shrine_id: shrineId,
    visit_datetime: String(when),
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
    distance_m: Number.isFinite(Number(raw.distance_m)) ? Number(raw.distance_m) : 0,
    created_at: String(raw.created_at ?? when),
  };
}

/** 旧 goshuin（photo_url）→ goshuin（image_url） */
export function normalizeGoshuin(raw: LegacyGoshuinRecord, fallbackUser = ""): Goshuin | null {
  const shrineId = String(raw.shrine_id ?? "");
  const image = String(raw.image_url ?? raw.photo_url ?? "");
  if (!shrineId || !image) return null;
  const created = String(raw.created_at ?? new Date().toISOString());
  return {
    id: String(raw.id ?? `legacy_${shrineId}`),
    user_id: String(raw.user_id ?? fallbackUser),
    shrine_id: shrineId,
    image_url: image,
    memo: String(raw.memo ?? ""),
    created_at: created,
    visited_date: raw.visited_date ? String(raw.visited_date) : created.slice(0, 10),
  };
}

export type LegacyScanResult = {
  /** 移行対象が存在するか */
  found: boolean;
  payload: MigrationPayload;
  /** 読み取った localStorage キー */
  sources: string[];
};

/**
 * localStorage に残っている旧データを走査する。
 * 複数のプロフィールがある場合は「直近のセッションのユーザー」を優先する。
 */
export function readLegacyLocalData(): LegacyScanResult {
  const empty: MigrationPayload = { profile: null, visits: [], goshuin: [] };
  if (typeof window === "undefined") return { found: false, payload: empty, sources: [] };

  const sources: string[] = [];
  const visits: MigrationPayload["visits"] = [];
  const goshuin: MigrationPayload["goshuin"] = [];
  let profile: MigrationPayload["profile"] = null;

  for (const key of LEGACY_DATA_KEYS) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    const data = parse(raw);
    if (!data) continue;
    sources.push(key);

    const session = data.session as { uid?: string } | null | undefined;
    const profiles = (data.profiles ?? {}) as Record<string, UserProfile>;
    const preferredUid = session?.uid && profiles[session.uid] ? session.uid : Object.keys(profiles)[0];
    const p = preferredUid ? profiles[preferredUid] : undefined;
    if (p && !profile) {
      profile = { nickname: p.nickname, photo_url: p.photo_url ?? null };
    }

    const rawVisits = Array.isArray(data.visits) ? (data.visits as LegacyVisitRecord[]) : [];
    for (const v of rawVisits) {
      const n = normalizeVisit(v);
      if (!n) continue;
      // 同一神社・同一日時の重複を排除
      const dedupeKey = `${n.shrine_id}|${n.visit_datetime}`;
      if (!visits.some((x) => `${x.shrine_id}|${x.visit_datetime}` === dedupeKey)) {
        visits.push({
          shrine_id: n.shrine_id,
          visit_datetime: n.visit_datetime,
          latitude: n.latitude,
          longitude: n.longitude,
          distance_m: n.distance_m,
        });
      }
    }

    const rawGoshuin = Array.isArray(data.goshuin) ? (data.goshuin as LegacyGoshuinRecord[]) : [];
    for (const g of rawGoshuin) {
      const n = normalizeGoshuin(g);
      if (!n) continue;
      const dedupeKey = `${n.shrine_id}|${n.created_at}`;
      if (!goshuin.some((x) => `${x.shrine_id}|${x.created_at}` === dedupeKey)) {
        goshuin.push({
          shrine_id: n.shrine_id,
          image_url: n.image_url,
          memo: n.memo,
          created_at: n.created_at,
          visited_date: n.visited_date,
        });
      }
    }
  }

  return {
    found: visits.length > 0 || goshuin.length > 0 || Boolean(profile?.nickname),
    payload: { profile, visits, goshuin },
    sources,
  };
}

/** このユーザーに対して移行済みか（localStorage 側のフラグ） */
export function isLocallyMigrated(uid: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MIGRATION_FLAG_KEY) === uid;
  } catch {
    return false;
  }
}

export function markLocallyMigrated(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATION_FLAG_KEY, uid);
  } catch {
    /* ストレージ不可の環境では Firestore 側のフラグのみで判定する */
  }
}

/** モード選択の保存 / 読み出し */
export function readStoredMode(): "firebase" | "demo" | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    return value === "demo" || value === "firebase" ? value : null;
  } catch {
    return null;
  }
}

export function storeMode(mode: "firebase" | "demo"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* noop */
  }
}

/** 文字列から決定的なドキュメントIDを作る（移行の冪等性担保） */
export function deterministicId(prefix: string, key: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i += 1) {
    const c = key.charCodeAt(i);
    h1 = (h1 ^ c) * 0x01000193;
    h2 = (h2 + c * (i + 7)) * 0x85ebca6b;
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `${prefix}_${a}${b}`.slice(0, 60);
}
