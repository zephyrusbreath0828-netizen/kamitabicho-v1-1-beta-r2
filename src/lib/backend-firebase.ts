/**
 * Firebase バックエンド実装（v1.1）
 *
 *   Authentication : Google ログイン（ポップアップ → 失敗時リダイレクト）
 *   Firestore      : users / visits / goshuin / favorites / shrines
 *   画像           : Cloudinary（Firebase Storage は使用しない）
 *
 * 設計上のポイント
 *  - 認証の永続化は browserLocalPersistence（自動ログイン維持）
 *  - 一覧取得は orderBy を使わず複合インデックス不要（MVP の運用負荷を下げる）
 *  - データ移行は決定的なドキュメントIDで冪等に実行（二重移行しない）
 *  - v1.0 の visit_history / photo_url も読み取り・移行できる
 */
import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { SHRINES } from "@/data/shrines";
import { COLLECTIONS, getDb, getFbAuth } from "@/lib/firebase";
import { deterministicId, isLocallyMigrated, markLocallyMigrated } from "@/lib/legacy";
import { dataUrlToFile } from "@/lib/photo";
import { uploadToCloudinary } from "@/lib/cloudinary";
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

const iso = () => new Date().toISOString();

/** ポップアップが使えない環境（iOS の一部 / ポップアップブロック）はリダイレクトへ切り替える */
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

/** 旧 visit_history を読むための型 */
type LegacyVisitDoc = LegacyVisitRecord & { id?: string };

export class FirebaseBackend implements Backend {
  mode: BackendMode = "firebase";
  shrineSource: "firestore" | "bundled" = "firestore";
  private redirectChecked = false;

  describe() {
    return "Firebase モード: Google アカウントでログインし、Firestore と Storage に保存します。";
  }

  onAuthChange(cb: (user: SessionUser | null) => void) {
    // 1) リダイレクトログインの結果を一度だけ回収する（iOS Safari 等）
    if (!this.redirectChecked && typeof window !== "undefined") {
      this.redirectChecked = true;
      getRedirectResult(getFbAuth()).catch((e) => {
        console.warn("[神旅帳] リダイレクトログインの結果取得に失敗しました", e);
      });
    }
    return onAuthStateChanged(getFbAuth(), async (fbUser: User | null) => {
      if (!fbUser) {
        cb(null);
        return;
      }
      try {
        await this.ensureProfile(fbUser);
      } catch (e) {
        console.error("[神旅帳] プロフィールの初期化に失敗しました", e);
      }
      cb({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        isDemo: false,
      });
    });
  }

  async signInWithGoogle(): Promise<SessionUser> {
    const auth = getFbAuth();
    // 自動ログイン維持（タブを閉じてもログイン状態を保持）
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const cred = await signInWithPopup(auth, provider);
      await this.ensureProfile(cred.user);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName,
        photoURL: cred.user.photoURL,
        isDemo: false,
      };
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      if (POPUP_FALLBACK_CODES.has(code)) {
        await signInWithRedirect(auth, provider);
        // リダイレクト中はここに戻らない（戻った場合は onAuthChange が処理する）
        return {
          uid: "",
          email: null,
          displayName: null,
          photoURL: null,
          isDemo: false,
        };
      }
      throw e;
    }
  }

  async signInAsDemo(): Promise<SessionUser> {
    throw new Error("Firebase 接続中はデモログインを利用できません。ログイン画面の「デモモードで試す」からお試しください。");
  }

  async signOut(): Promise<void> {
    await fbSignOut(getFbAuth());
  }

  /** users/{uid} が無ければ Google アカウント情報から作成する */
  private async ensureProfile(fbUser: User): Promise<void> {
    const ref = doc(getDb(), COLLECTIONS.users, fbUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    const profile: UserProfile = {
      uid: fbUser.uid,
      nickname: fbUser.displayName ?? "参拝者",
      photo_url: fbUser.photoURL ?? null,
      created_at: iso(),
      updated_at: iso(),
      schema_version: 2,
      achievements: {},
    };
    await setDoc(ref, profile);
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(getDb(), COLLECTIONS.users, uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(
      doc(getDb(), COLLECTIONS.users, profile.uid),
      { ...profile, updated_at: iso(), schema_version: 2 },
      { merge: true },
    );
  }

  async saveAchievements(uid: string, unlocked: Record<string, string>): Promise<void> {
    await setDoc(doc(getDb(), COLLECTIONS.users, uid), { achievements: unlocked, updated_at: iso() }, { merge: true });
  }

  async listShrines(): Promise<Shrine[]> {
    try {
      const snap = await getDocs(collection(getDb(), COLLECTIONS.shrines));
      if (snap.empty) {
        console.warn("[神旅帳] Firestore の shrines が空です。同梱データを表示します（npm run seed を実行してください）。");
        this.shrineSource = "bundled";
        return SHRINES;
      }
      // 同梱データを既定値とし、Firestore の値を上書きする（電話番号・URLの追記ができる）
      const overrides = new Map(snap.docs.map((d) => [d.id, d.data() as Partial<Shrine>]));
      const merged: Shrine[] = SHRINES.map((s) => ({ ...s, ...(overrides.get(s.id) ?? {}) }));
      // 同梱に無い神社（将来の追加分）も表示する
      for (const [id, data] of overrides) {
        if (!merged.some((m) => m.id === id) && data.name) {
          merged.push({ ...(data as Shrine), id });
        }
      }
      this.shrineSource = "firestore";
      return merged;
    } catch (e) {
      console.warn("[神旅帳] shrines の取得に失敗したため同梱データを使用します", e);
      this.shrineSource = "bundled";
      return SHRINES;
    }
  }

  async getShrine(id: string): Promise<Shrine | null> {
    try {
      const snap = await getDoc(doc(getDb(), COLLECTIONS.shrines, id));
      if (snap.exists()) {
        const bundled = SHRINES.find((s) => s.id === id);
        return { ...(bundled ?? ({} as Shrine)), ...(snap.data() as Shrine), id: snap.id };
      }
    } catch {
      /* 同梱データへフォールバック */
    }
    return SHRINES.find((s) => s.id === id) ?? null;
  }

  async listVisits(uid: string): Promise<Visit[]> {
    // 複合インデックス不要のため orderBy は使わず、クライアント側で並べ替える
    const snap = await getDocs(query(collection(getDb(), COLLECTIONS.visits), where("user_id", "==", uid)));
    return snap.docs
      .map((d) => {
        const raw = d.data() as Visit & { visited_at?: string };
        return {
          ...raw,
          id: d.id,
          visit_datetime: raw.visit_datetime ?? raw.visited_at ?? raw.created_at ?? iso(),
        } as Visit;
      })
      .sort((a, b) => (a.visit_datetime < b.visit_datetime ? 1 : -1));
  }

  async addVisit(input: NewVisitInput): Promise<Visit> {
    const shrine = (await this.getShrine(input.shrine_id)) ?? SHRINES.find((s) => s.id === input.shrine_id);
    if (!shrine) throw new Error("神社が見つかりません。");
    const when = input.visit_datetime ?? iso();
    const payload = {
      user_id: input.user_id,
      shrine_id: input.shrine_id,
      visit_datetime: when,
      latitude: input.latitude,
      longitude: input.longitude,
      distance_m: Math.round(input.distance_m),
      created_at: iso(),
    };
    const created = await addDoc(collection(getDb(), COLLECTIONS.visits), payload);
    // 神社の参拝数はベストエフォートで更新（失敗しても記録は成立）
    try {
      await updateDoc(doc(getDb(), COLLECTIONS.shrines, input.shrine_id), { visit_count: increment(1) });
    } catch {
      /* ルール未整備・マスタ未投入の場合は無視 */
    }
    return { id: created.id, ...payload };
  }

  async deleteVisit(visitId: string): Promise<void> {
    const ref = doc(getDb(), COLLECTIONS.visits, visitId);
    let shrineId: string | null = null;
    try {
      const snap = await getDoc(ref);
      shrineId = snap.exists() ? ((snap.data() as Visit).shrine_id ?? null) : null;
    } catch {
      /* 取得できなくても削除は続行 */
    }
    await deleteDoc(ref);
    if (shrineId) {
      try {
        await updateDoc(doc(getDb(), COLLECTIONS.shrines, shrineId), { visit_count: increment(-1) });
      } catch {
        /* 集計のみ */
      }
    }
  }

  async listGoshuin(uid: string): Promise<Goshuin[]> {
    const snap = await getDocs(query(collection(getDb(), COLLECTIONS.goshuin), where("user_id", "==", uid)));
    return snap.docs
      .map((d) => {
        const raw = d.data() as Goshuin & { photo_url?: string };
        return {
          ...raw,
          id: d.id,
          image_url: raw.image_url ?? raw.photo_url ?? "",
          memo: raw.memo ?? "",
          created_at: raw.created_at ?? iso(),
          visited_date: raw.visited_date ?? (raw.created_at ?? iso()).slice(0, 10),
        } as Goshuin;
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async addGoshuin(input: NewGoshuinInput): Promise<Goshuin> {
    const shrine = (await this.getShrine(input.shrine_id)) ?? SHRINES.find((s) => s.id === input.shrine_id);
    if (!shrine) throw new Error("神社が見つかりません。");
    let imageUrl = input.image_url ?? "";
    if (input.file) imageUrl = await this.uploadImage(input.user_id, "goshuin", input.file);
    if (!imageUrl) throw new Error("御朱印の写真を選択してください。");
    const payload = {
      user_id: input.user_id,
      shrine_id: input.shrine_id,
      image_url: imageUrl,
      memo: (input.memo ?? "").slice(0, 300),
      visited_date: input.visited_date,
      created_at: iso(),
    };
    const created = await addDoc(collection(getDb(), COLLECTIONS.goshuin), payload);
    return { id: created.id, ...payload };
  }

  /**
   * 御朱印レコードを削除する。
   * Cloudinary 側の画像は残る（クライアントからは削除できないため）。
   * 孤立画像の整理は Cloudinary ダッシュボードまたは将来の管理ジョブで行う。
   */
  async deleteGoshuin(goshuinId: string): Promise<void> {
    await deleteDoc(doc(getDb(), COLLECTIONS.goshuin, goshuinId));
  }

  async listFavorites(uid: string): Promise<string[]> {
    const snap = await getDocs(query(collection(getDb(), COLLECTIONS.favorites), where("user_id", "==", uid)));
    return snap.docs.map((d) => String((d.data() as { shrine_id?: string }).shrine_id ?? ""));
  }

  async setFavorite(uid: string, shrineId: string, on: boolean): Promise<void> {
    // ドキュメントIDを uid_shrineId にして重複登録を防ぐ
    const ref = doc(getDb(), COLLECTIONS.favorites, `${uid}_${shrineId}`);
    if (on) {
      await setDoc(ref, { user_id: uid, shrine_id: shrineId, created_at: iso() }, { merge: true });
    } else {
      await deleteDoc(ref);
    }
  }

  /**
   * 画像を Cloudinary へアップロードし、返却された URL を返す。
   * 失敗時は ImageUploadError（日本語メッセージ）を投げ、画面で表示する。
   */
  async uploadImage(uid: string, kind: "goshuin" | "avatar", file: File): Promise<string> {
    return uploadToCloudinary(file, kind, uid);
  }

  /**
   * localStorage（v1.0 / v1.1 デモ）からの移行。
   * 決定的IDで書き込むため、通信エラー後に再実行しても重複しない。
   */
  async migrateLocalData(uid: string, payload: MigrationPayload): Promise<MigrationResult> {
    if (isLocallyMigrated(uid)) {
      return { performed: false, visits: 0, goshuin: 0, profile: false, skippedReason: "移行済み（端末）" };
    }
    const userRef = doc(getDb(), COLLECTIONS.users, uid);
    const userSnap = await getDoc(userRef);
    const profile = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

    const already = profile?.migration?.local_storage_at;
    if (already) {
      markLocallyMigrated(uid);
      return { performed: false, visits: 0, goshuin: 0, profile: false, skippedReason: "移行済み（アカウント）" };
    }
    if (!payload.visits.length && !payload.goshuin.length && !payload.profile?.nickname) {
      return { performed: false, visits: 0, goshuin: 0, profile: false, skippedReason: "移行対象なし" };
    }

    let visitCount = 0;
    for (const v of payload.visits) {
      const id = deterministicId("mig", `visit|${uid}|${v.shrine_id}|${v.visit_datetime}`);
      await setDoc(
        doc(getDb(), COLLECTIONS.visits, id),
        {
          user_id: uid,
          shrine_id: v.shrine_id,
          visit_datetime: v.visit_datetime,
          latitude: v.latitude,
          longitude: v.longitude,
          distance_m: v.distance_m,
          created_at: iso(),
          migrated_from: "local_storage",
        },
        { merge: true },
      );
      visitCount += 1;
    }

    let goshuinCount = 0;
    for (const g of payload.goshuin) {
      const id = deterministicId("mig", `goshuin|${uid}|${g.shrine_id}|${g.created_at}`);
      // デモモードの写真（data URL）は Storage へアップロードして URL に置き換える
      let imageUrl = g.image_url;
      if (imageUrl.startsWith("data:")) {
        try {
          imageUrl = await this.uploadImage(uid, "goshuin", dataUrlToFile(imageUrl, `migrated_${id}.jpg`));
        } catch (e) {
          // Cloudinary へ移送できなかった場合は data URL のまま保存する（記録を失わない）
          console.warn("[神旅帳] 移行画像の Cloudinary アップロードに失敗しました（data URL のまま保存します）", e);
        }
      }
      await setDoc(
        doc(getDb(), COLLECTIONS.goshuin, id),
        {
          user_id: uid,
          shrine_id: g.shrine_id,
          image_url: imageUrl,
          memo: g.memo.slice(0, 300),
          visited_date: g.visited_date ?? g.created_at.slice(0, 10),
          created_at: g.created_at,
          migrated_from: "local_storage",
        },
        { merge: true },
      );
      goshuinCount += 1;
    }

    let profileMigrated = false;
    const nickname = payload.profile?.nickname?.trim();
    // 既存プロフィールが初期値（Google の表示名）のままの場合のみ上書きする
    if (nickname && profile && (profile.nickname === "参拝者" || !profile.nickname)) {
      await setDoc(userRef, { nickname, updated_at: iso() }, { merge: true });
      profileMigrated = true;
    }

    await setDoc(
      userRef,
      {
        migration: {
          ...(profile?.migration ?? {}),
          local_storage_at: iso(),
          counts: { visits: visitCount, goshuin: goshuinCount, profile: profileMigrated },
        },
        schema_version: 2,
        updated_at: iso(),
      },
      { merge: true },
    );
    markLocallyMigrated(uid);

    return { performed: true, visits: visitCount, goshuin: goshuinCount, profile: profileMigrated };
  }

  /**
   * v1.0 の visit_history → visits へのコピー移行（非破壊）。
   * 旧データは削除せず残すため、切り戻しも可能。
   */
  async migrateLegacyVisitHistory(uid: string): Promise<number> {
    const userRef = doc(getDb(), COLLECTIONS.users, uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return 0;
    const profile = userSnap.data() as UserProfile;
    if (profile.migration?.from_visit_history_at) return 0;

    let copied = 0;
    try {
      const snap = await getDocs(
        query(collection(getDb(), COLLECTIONS.legacyVisitHistory), where("user_id", "==", uid)),
      );
      for (const d of snap.docs) {
        const raw = d.data() as LegacyVisitDoc;
        if (!raw.shrine_id) continue;
        // 旧ドキュメントIDをそのまま使う（冪等）
        await setDoc(
          doc(getDb(), COLLECTIONS.visits, d.id),
          {
            user_id: uid,
            shrine_id: raw.shrine_id,
            visit_datetime: raw.visit_datetime ?? raw.visited_at ?? raw.created_at ?? iso(),
            latitude: Number(raw.latitude ?? 0),
            longitude: Number(raw.longitude ?? 0),
            distance_m: Number(raw.distance_m ?? 0),
            created_at: raw.created_at ?? iso(),
            migrated_from: "visit_history",
          },
          { merge: true },
        );
        copied += 1;
      }
      // 旧 goshuin（photo_url）→ image_url の補完
      const gsnap = await getDocs(query(collection(getDb(), COLLECTIONS.goshuin), where("user_id", "==", uid)));
      for (const d of gsnap.docs) {
        const raw = d.data() as LegacyGoshuinRecord & { image_url?: string };
        if (!raw.image_url && (raw as LegacyGoshuinRecord).photo_url) {
          await updateDoc(d.ref, { image_url: (raw as LegacyGoshuinRecord).photo_url });
        }
      }
    } catch (e) {
      console.warn("[神旅帳] 旧 visit_history の移行に失敗しました（権限または未作成の可能性）", e);
      return copied;
    }

    await setDoc(
      userRef,
      { migration: { ...(profile.migration ?? {}), from_visit_history_at: iso() }, updated_at: iso() },
      { merge: true },
    );
    return copied;
  }
}
