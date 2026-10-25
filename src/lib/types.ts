/**
 * 神旅帳 v1.1 ドメイン型定義
 *
 * Firestore コレクション（仕様準拠）
 *   users/{uid}        uid / nickname / photo_url / created_at (+ 拡張フィールド)
 *   visits/{visitId}   user_id / shrine_id / visit_datetime / latitude / longitude
 *   goshuin/{id}       user_id / shrine_id / image_url / memo / created_at
 *   favorites/{id}     user_id / shrine_id / created_at
 *   shrines/{id}       神社マスタ（管理用・読み取り専用）
 *
 * v1.0（MVP）との互換:
 *   - visits は旧 visit_history コレクションの visited_at も読み取り可能
 *   - goshuin は旧 photo_url も読み取り可能
 *   - 旧バージョンのフィールド名は *Legacy 型として定義し、正規化関数で吸収する
 */

/** users/{uid} */
export type UserProfile = {
  uid: string;
  /** 表示名（ニックネーム） */
  nickname: string;
  /** Firebase Storage のダウンロードURL / Google の photoURL / デモは data URL */
  photo_url: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  /** デモユーザーかどうか（Firestore には保存しない） */
  is_demo?: boolean;
  /** 実績の解放履歴 { achievementId: ISO } — v1.3 のランキング集計に利用 */
  achievements?: Record<string, string>;
  /** データ移行の実行履歴（二重移行防止） */
  migration?: MigrationState;
  /** ドキュメント構造のバージョン（将来のマイグレーション用） */
  schema_version?: number;
};

export type MigrationState = {
  /** localStorage からの移行完了日時 */
  local_storage_at?: string;
  /** 旧 visit_history コレクションからの移行完了日時 */
  from_visit_history_at?: string;
  /** 移行した件数（記録用） */
  counts?: { visits?: number; goshuin?: number; profile?: boolean };
};

/** shrines/{shrineId} */
export type Shrine = {
  id: string;
  name: string;
  prefecture: string;
  address: string;
  latitude: number;
  longitude: number;
  /** ご祭神 */
  main_deity: string;
  /** 由緒・説明 */
  description: string;
  image_url: string;
  /** 訪問記録数（集計値） */
  visit_count: number;
  /** 電話番号（未登録の場合は null） */
  phone?: string | null;
  /** 公式サイトURL（未登録の場合は null） */
  url?: string | null;
};

/** visits/{visitId} — GPS 参拝記録 */
export type Visit = {
  id: string;
  user_id: string;
  shrine_id: string;
  /** 参拝日時 ISO 8601（仕様の visit_datetime） */
  visit_datetime: string;
  /** チェックイン時の端末位置 */
  latitude: number;
  longitude: number;
  /** 神社からの距離(m)。300m 以内のみ登録可能 */
  distance_m: number;
  created_at?: string;
};

/** 旧 visit_history の形（読み取り互換用） */
export type LegacyVisitRecord = Partial<Visit> & {
  visited_at?: string;
  shrine_name?: string;
  shrine_prefecture?: string;
};

/** goshuin/{id} — 御朱印帳 */
export type Goshuin = {
  id: string;
  user_id: string;
  shrine_id: string;
  /** 御朱印写真のURL（Storage / デモは data URL） */
  image_url: string;
  memo: string;
  created_at: string;
  /** 授与日 YYYY-MM-DD（御朱印帳の並び替え・表示用） */
  visited_date?: string;
};

/** 旧 goshuin の形（photo_url 互換） */
export type LegacyGoshuinRecord = Partial<Goshuin> & {
  photo_url?: string;
  shrine_name?: string;
  visited_date?: string;
};

/** favorites/{uid_shrineId} */
export type Favorite = {
  user_id: string;
  shrine_id: string;
  created_at: string;
};

/** ログイン中のセッションユーザー */
export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo: boolean;
};

/** 新規訪問記録の入力 */
export type NewVisitInput = {
  user_id: string;
  shrine_id: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  visit_datetime?: string;
};

/** 新規御朱印の入力 */
export type NewGoshuinInput = {
  user_id: string;
  shrine_id: string;
  visited_date: string;
  memo: string;
  file?: File | null;
  image_url?: string;
};

/** localStorage から移行するデータ */
export type MigrationPayload = {
  profile: { nickname?: string; photo_url?: string | null } | null;
  visits: Array<{
    shrine_id: string;
    visit_datetime: string;
    latitude: number;
    longitude: number;
    distance_m: number;
  }>;
  goshuin: Array<{
    shrine_id: string;
    image_url: string;
    memo: string;
    created_at: string;
    visited_date?: string;
  }>;
};

export type MigrationResult = {
  performed: boolean;
  visits: number;
  goshuin: number;
  profile: boolean;
  skippedReason?: string;
};

/** バックエンド共通インターフェース（Firebase / デモ） */
export type BackendMode = "firebase" | "demo";

export interface Backend {
  mode: BackendMode;
  /** 直近の listShrines() の取得元 */
  shrineSource: "firestore" | "bundled";
  describe(): string;
  onAuthChange(cb: (user: SessionUser | null) => void): () => void;
  signInWithGoogle(): Promise<SessionUser>;
  signInAsDemo(nickname?: string): Promise<SessionUser>;
  signOut(): Promise<void>;
  getUserProfile(uid: string): Promise<UserProfile | null>;
  saveUserProfile(profile: UserProfile): Promise<void>;
  listShrines(): Promise<Shrine[]>;
  getShrine(id: string): Promise<Shrine | null>;
  listVisits(uid: string): Promise<Visit[]>;
  addVisit(input: NewVisitInput): Promise<Visit>;
  deleteVisit(visitId: string): Promise<void>;
  listGoshuin(uid: string): Promise<Goshuin[]>;
  addGoshuin(input: NewGoshuinInput): Promise<Goshuin>;
  deleteGoshuin(goshuinId: string): Promise<void>;
  listFavorites(uid: string): Promise<string[]>;
  setFavorite(uid: string, shrineId: string, on: boolean): Promise<void>;
  uploadImage(uid: string, kind: "goshuin" | "avatar", file: File): Promise<string>;
  /** 初回ログイン時のデータ移行（冪等） */
  migrateLocalData(uid: string, payload: MigrationPayload): Promise<MigrationResult>;
  /** 実績の解放を保存する */
  saveAchievements(uid: string, unlocked: Record<string, string>): Promise<void>;
  /** v1.0 の visit_history を visits へコピー移行（Firebase のみ） */
  migrateLegacyVisitHistory?(uid: string): Promise<number>;
}
