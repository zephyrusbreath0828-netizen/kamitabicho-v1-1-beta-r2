/**
 * デモバックエンド（localStorage）
 *
 * 目的: Firebase を設定していないテストユーザーでも、すべての画面と操作を
 * その場で確認できるようにする。API は FirebaseBackend と完全に同一。
 *
 * v1.1 の変更点（不具合修正）
 *  1. セッションをデータ本体とは**別のキー**に保存する。
 *     写真付きデータで localStorage が容量超過しても、ログイン自体は成功する。
 *  2. 状態通知（emit）を保存より先に行い、保存失敗で画面遷移が止まらないようにする。
 *  3. 旧キー（kamitabicho:demo:v1）が存在する場合は引き継いで表示する。
 */
import { SHRINES } from "@/data/shrines";
import { devToolsEnabled } from "@/lib/dev-tools";
import { normalizeGoshuin, normalizeVisit } from "@/lib/legacy";
import { fileToDataUrl } from "@/lib/photo";
import type {
  Backend,
  BackendMode,
  Goshuin,
  LegacyGoshuinRecord,
  LegacyVisitRecord,
  MigrationPayload,
  MigrationResult,
  NewGoshuinInput,
  NewVisitInput,
  SessionUser,
  Shrine,
  UserProfile,
  Visit,
} from "@/lib/types";

const DATA_KEY = "kamitabicho:demo:v2";
const SESSION_KEY = "kamitabicho:demo:session:v2";
const LEGACY_DATA_KEY = "kamitabicho:demo:v1";

type DemoStore = {
  profiles: Record<string, UserProfile>;
  visits: Visit[];
  goshuin: Goshuin[];
  favorites: Array<{ user_id: string; shrine_id: string; created_at: string }>;
};

const emptyStore = (): DemoStore => ({ profiles: {}, visits: [], goshuin: [], favorites: [] });
const iso = () => new Date().toISOString();

function loadStore(): DemoStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(DATA_KEY) ?? window.localStorage.getItem(LEGACY_DATA_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<DemoStore>;
    const visits = (Array.isArray(parsed.visits) ? parsed.visits : [])
      .map((v) => normalizeVisit(v as LegacyVisitRecord))
      .filter((v): v is Visit => v !== null);
    const goshuin = (Array.isArray(parsed.goshuin) ? parsed.goshuin : [])
      .map((g) => normalizeGoshuin(g as LegacyGoshuinRecord))
      .filter((g): g is Goshuin => g !== null);
    return {
      profiles: parsed.profiles ?? {},
      visits,
      goshuin,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    };
  } catch {
    return emptyStore();
  }
}

function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      // 旧バージョンのセッションを引き継ぐ
      const legacy = window.localStorage.getItem(LEGACY_DATA_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as { session?: SessionUser | null };
        return parsed.session ?? null;
      }
      return null;
    }
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function persistSession(session: SessionUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* セッション保存に失敗してもメモリ上で動作を継続する */
  }
}

/** サンプルデータ（動作確認用 ?sample=1） */
function daysAgoIso(days: number, hour = 9, minute = 12): string {
  const t = new Date();
  t.setDate(t.getDate() - days);
  t.setHours(hour, minute, 0, 0);
  return t.toISOString();
}
function ymdDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class DemoBackend implements Backend {
  mode: BackendMode = "demo";
  shrineSource: "firestore" | "bundled" = "bundled";
  private listeners = new Set<(u: SessionUser | null) => void>();
  private store: DemoStore = emptyStore();
  private session: SessionUser | null = null;
  /** 容量超過などで保存できなかった場合の警告（画面側で表示） */
  lastWarning: string | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    this.store = loadStore();
    this.session = loadSession();
    const params = new URLSearchParams(window.location.search);
    // 検証用の自動ログイン（開発ツール有効時のみ）
    if (devToolsEnabled() && params.get("autologin") === "1") {
      this.ensureSampleSession(params.get("sample") === "1");
    }
    setTimeout(() => this.emit(), 0);
  }

  describe() {
    return "デモモード（端末内保存）: データはこのブラウザにのみ保存され、他の端末とは同期されません。";
  }

  private emit() {
    this.listeners.forEach((cb) => cb(this.session));
  }

  /** 保存に失敗しても例外を投げない（ログインや画面遷移を止めない） */
  private persist(): boolean {
    if (typeof window === "undefined") return true;
    try {
      window.localStorage.setItem(DATA_KEY, JSON.stringify(this.store));
      this.lastWarning = null;
      return true;
    } catch {
      this.lastWarning =
        "端末の保存容量が不足しています。デモモードの写真は端末内に保存されるため、不要な御朱印を削除するか Google ログインでお試しください。";
      return false;
    }
  }

  private ensureSampleSession(sample: boolean) {
    const DEMO_UID = "demo-local-user";
    if (!this.session || this.session.uid !== DEMO_UID) {
      this.session = {
        uid: DEMO_UID,
        email: null,
        displayName: "参拝 花子",
        photoURL: null,
        isDemo: true,
      };
      persistSession(this.session);
    }
    if (!this.store.profiles[DEMO_UID]) {
      this.store.profiles[DEMO_UID] = {
        uid: DEMO_UID,
        nickname: "参拝 花子",
        photo_url: null,
        is_demo: true,
        created_at: iso(),
        updated_at: iso(),
        schema_version: 2,
      };
    }
    if (sample && !this.store.visits.some((v) => v.user_id === DEMO_UID)) {
      const rows: Array<[string, number, number]> = [
        ["伊勢神宮（内宮）", 42, 3],
        ["熱田神宮", 88, 12],
        ["出雲大社", 128, 40],
        ["明治神宮", 265, 120],
      ];
      for (const [name, distance, days] of rows) {
        const s = SHRINES.find((x) => x.name === name);
        if (!s) continue;
        this.store.visits.push({
          id: `visit_sample_${s.id}`,
          user_id: DEMO_UID,
          shrine_id: s.id,
          visit_datetime: daysAgoIso(days),
          latitude: Number((s.latitude + 0.0003).toFixed(6)),
          longitude: Number((s.longitude - 0.0003).toFixed(6)),
          distance_m: distance,
          created_at: daysAgoIso(days),
        });
      }
      const gs: Array<[string, string, number, string]> = [
        ["伊勢神宮（内宮）", "/sample/goshuin-1.png", 3, "早朝参拝。五十鈴川で手を清めてから正宮へ。御朱印は神楽殿でいただきました。"],
        ["出雲大社", "/sample/goshuin-2.png", 40, "大注連縄の下で参拝。縁結びの御神徳をいただきました。"],
      ];
      for (const [name, photo, days, memo] of gs) {
        const s = SHRINES.find((x) => x.name === name);
        if (!s) continue;
        this.store.goshuin.push({
          id: `goshuin_sample_${s.id}`,
          user_id: DEMO_UID,
          shrine_id: s.id,
          image_url: photo,
          visited_date: ymdDaysAgo(days),
          memo,
          created_at: daysAgoIso(days, 10, 30),
        });
      }
      this.store.favorites.push({
        user_id: DEMO_UID,
        shrine_id: SHRINES[0].id,
        created_at: daysAgoIso(20),
      });
    }
    this.persist();
  }

  onAuthChange(cb: (user: SessionUser | null) => void) {
    this.listeners.add(cb);
    if (typeof window !== "undefined") cb(this.session);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async signInWithGoogle(): Promise<SessionUser> {
    throw new Error(
      "Google ログインは Firebase 接続時のみ利用できます。デモモードでは「デモモードで試す」からお進みください。",
    );
  }

  async signInAsDemo(nickname = "ゲスト参拝者"): Promise<SessionUser> {
    const id = this.session?.uid ?? `demo_${Math.random().toString(36).slice(2, 10)}`;
    const user: SessionUser = {
      uid: id,
      email: null,
      displayName: nickname,
      photoURL: null,
      isDemo: true,
    };
    this.session = user;
    // 1) セッションを先に確定・保存（容量超過でもログインは成立させる）
    persistSession(user);
    // 2) 画面へ通知 → 3) データ保存
    this.emit();
    if (!this.store.profiles[id]) {
      this.store.profiles[id] = {
        uid: id,
        nickname,
        photo_url: null,
        is_demo: true,
        created_at: iso(),
        updated_at: iso(),
        schema_version: 2,
      };
    }
    this.persist();
    return user;
  }

  async signOut(): Promise<void> {
    this.session = null;
    persistSession(null);
    this.emit();
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    return this.store.profiles[uid] ?? null;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    this.store.profiles[profile.uid] = { ...profile, updated_at: iso() };
    if (this.session?.uid === profile.uid) {
      this.session = { ...this.session, displayName: profile.nickname, photoURL: profile.photo_url };
      persistSession(this.session);
      this.emit();
    }
    if (!this.persist() && this.lastWarning) {
      throw new Error(this.lastWarning);
    }
  }

  async saveAchievements(uid: string, unlocked: Record<string, string>): Promise<void> {
    const profile = this.store.profiles[uid];
    if (!profile) return;
    this.store.profiles[uid] = { ...profile, achievements: unlocked, updated_at: iso() };
    this.persist();
  }

  async listShrines(): Promise<Shrine[]> {
    this.shrineSource = "bundled";
    const counts = new Map<string, number>();
    for (const v of this.store.visits) counts.set(v.shrine_id, (counts.get(v.shrine_id) ?? 0) + 1);
    return SHRINES.map((s) => ({ ...s, visit_count: s.visit_count + (counts.get(s.id) ?? 0) }));
  }

  async getShrine(id: string): Promise<Shrine | null> {
    const all = await this.listShrines();
    return all.find((s) => s.id === id) ?? null;
  }

  async listVisits(uid: string): Promise<Visit[]> {
    return this.store.visits
      .filter((v) => v.user_id === uid)
      .sort((a, b) => (a.visit_datetime < b.visit_datetime ? 1 : -1));
  }

  async addVisit(input: NewVisitInput): Promise<Visit> {
    const shrine = SHRINES.find((s) => s.id === input.shrine_id);
    if (!shrine) throw new Error("神社が見つかりません。");
    const visit: Visit = {
      id: `visit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: input.user_id,
      shrine_id: input.shrine_id,
      visit_datetime: input.visit_datetime ?? iso(),
      latitude: input.latitude,
      longitude: input.longitude,
      distance_m: Math.round(input.distance_m),
      created_at: iso(),
    };
    this.store.visits.unshift(visit);
    this.persist();
    return visit;
  }

  async deleteVisit(visitId: string): Promise<void> {
    this.store.visits = this.store.visits.filter((v) => v.id !== visitId);
    this.persist();
  }

  async listGoshuin(uid: string): Promise<Goshuin[]> {
    return this.store.goshuin
      .filter((g) => g.user_id === uid)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async addGoshuin(input: NewGoshuinInput): Promise<Goshuin> {
    const shrine = SHRINES.find((s) => s.id === input.shrine_id);
    if (!shrine) throw new Error("神社が見つかりません。");
    let image = input.image_url ?? "";
    if (input.file) image = await fileToDataUrl(input.file, 900, 0.7);
    if (!image) throw new Error("御朱印の写真を選択してください。");
    const goshuin: Goshuin = {
      id: `goshuin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: input.user_id,
      shrine_id: input.shrine_id,
      image_url: image,
      memo: input.memo ?? "",
      visited_date: input.visited_date,
      created_at: iso(),
    };
    this.store.goshuin.unshift(goshuin);
    if (!this.persist()) {
      // 保存できなかった場合は状態を戻して利用者へ伝える
      this.store.goshuin = this.store.goshuin.filter((g) => g.id !== goshuin.id);
      throw new Error(this.lastWarning ?? "端末の保存容量が不足しています。");
    }
    return goshuin;
  }

  async deleteGoshuin(goshuinId: string): Promise<void> {
    this.store.goshuin = this.store.goshuin.filter((g) => g.id !== goshuinId);
    this.persist();
  }

  async listFavorites(uid: string): Promise<string[]> {
    return this.store.favorites.filter((f) => f.user_id === uid).map((f) => f.shrine_id);
  }

  async setFavorite(uid: string, shrineId: string, on: boolean): Promise<void> {
    const exists = this.store.favorites.some((f) => f.user_id === uid && f.shrine_id === shrineId);
    if (on && !exists) {
      this.store.favorites.push({ user_id: uid, shrine_id: shrineId, created_at: iso() });
    } else if (!on) {
      this.store.favorites = this.store.favorites.filter((f) => !(f.user_id === uid && f.shrine_id === shrineId));
    }
    this.persist();
  }

  async uploadImage(_uid: string, kind: "goshuin" | "avatar", file: File): Promise<string> {
    return fileToDataUrl(file, kind === "avatar" ? 400 : 900, kind === "avatar" ? 0.8 : 0.7);
  }

  async migrateLocalData(): Promise<MigrationResult> {
    return { performed: false, visits: 0, goshuin: 0, profile: false, skippedReason: "デモモードでは移行不要" };
  }

  /** デモデータを移行用に書き出す（Google ログインへ切り替える際に使用） */
  exportLegacyPayload(): MigrationPayload {
    return {
      profile: null,
      visits: this.store.visits.map((v) => ({
        shrine_id: v.shrine_id,
        visit_datetime: v.visit_datetime,
        latitude: v.latitude,
        longitude: v.longitude,
        distance_m: v.distance_m,
      })),
      goshuin: this.store.goshuin.map((g) => ({
        shrine_id: g.shrine_id,
        image_url: g.image_url,
        memo: g.memo,
        created_at: g.created_at,
        visited_date: g.visited_date,
      })),
    };
  }
}
