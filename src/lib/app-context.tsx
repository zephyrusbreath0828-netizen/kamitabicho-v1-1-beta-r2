"use client";

/**
 * アプリ全体の状態管理
 *
 * - 認証（Firebase / デモ）の切り替えと自動ログイン
 * - 神社マスタ・参拝記録・御朱印・お気に入りの保持
 * - 初回 Google ログイン時の localStorage 移行（冪等）
 * - 実績の解放判定と保存
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getBackend, resolveInitialMode } from "@/lib/backend";
import { computeAchievements, computeStats, newlyUnlocked, type AchievementProgress, type AchievementStats } from "@/lib/achievements";
import { isSilentError, toUserMessage } from "@/lib/errors";
import { isFirebaseConfigured } from "@/lib/firebase";
import { isLocallyMigrated, readLegacyLocalData, storeMode } from "@/lib/legacy";
import type {
  Backend,
  BackendMode,
  Goshuin,
  MigrationResult,
  NewGoshuinInput,
  SessionUser,
  Shrine,
  UserProfile,
  Visit,
} from "@/lib/types";
import { SHRINES } from "@/data/shrines";

function rethrow(e: unknown): never {
  throw new Error(toUserMessage(e));
}

type AppContextValue = {
  backend: Backend;
  mode: BackendMode;
  ready: boolean;
  user: SessionUser | null;
  profile: UserProfile | null;
  shrines: Shrine[];
  visits: Visit[];
  goshuin: Goshuin[];
  favorites: string[];
  stats: AchievementStats;
  achievements: AchievementProgress[];
  unlockedAchievements: number;
  shrineSource: "firestore" | "bundled";
  error: string | null;
  clearError: () => void;
  migration: MigrationResult | null;
  dismissMigration: () => void;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: { nickname?: string; photo_url?: string | null }) => Promise<void>;
  uploadImage: (kind: "goshuin" | "avatar", file: File) => Promise<string>;
  checkIn: (shrine: Shrine, position: { latitude: number; longitude: number; distance_m: number }) => Promise<Visit>;
  removeVisit: (visitId: string) => Promise<void>;
  registerGoshuin: (input: Omit<NewGoshuinInput, "user_id">) => Promise<Goshuin>;
  removeGoshuin: (id: string) => Promise<void>;
  toggleFavorite: (shrineId: string) => Promise<void>;
  isFavorite: (shrineId: string) => boolean;
  shrineById: (id: string) => Shrine | undefined;
  visitCountOf: (shrineId: string) => number;
  visitedShrineIds: string[];
  recentVisits: Visit[];
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<BackendMode>(() => resolveInitialMode());
  const [backend, setBackend] = useState<Backend>(() => getBackend(resolveInitialMode()));
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shrines, setShrines] = useState<Shrine[]>(SHRINES);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [goshuin, setGoshuin] = useState<Goshuin[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shrineSource, setShrineSource] = useState<"firestore" | "bundled">("bundled");
  const [error, setError] = useState<string | null>(null);
  const [migration, setMigration] = useState<MigrationResult | null>(null);
  const savedAchievementsKey = useRef<string>("");

  /** 神社マスタの読み込み */
  useEffect(() => {
    let alive = true;
    backend
      .listShrines()
      .then((list) => {
        if (!alive) return;
        setShrines(list);
        setShrineSource(backend.shrineSource ?? "bundled");
      })
      .catch((e) => {
        if (alive) setError(toUserMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [backend]);

  /** アカウントデータの取得（移行処理を含む） */
  const hydrate = useCallback(
    async (target: Backend, uid: string) => {
      const loadAll = async () => {
        const [p, v, g, f] = await Promise.all([
          target.getUserProfile(uid),
          target.listVisits(uid),
          target.listGoshuin(uid),
          target.listFavorites(uid),
        ]);
        setProfile(p);
        setVisits(v);
        setGoshuin(g);
        setFavorites(f);
        return { p, v, g };
      };

      let loaded = await loadAll();

      // --- 初回 Google ログイン時のデータ移行 ---
      if (target.mode === "firebase" && !isLocallyMigrated(uid)) {
        const scan = readLegacyLocalData();
        if (scan.found) {
          try {
            const result = await target.migrateLocalData(uid, scan.payload);
            if (result.performed) {
              loaded = await loadAll();
              setMigration(result);
            }
          } catch (e) {
            console.warn("[神旅帳] localStorage データの移行に失敗しました", e);
          }
        }
      }

      // --- v1.0 の visit_history からのコピー移行（非破壊） ---
      if (target.mode === "firebase" && target.migrateLegacyVisitHistory) {
        try {
          const copied = await target.migrateLegacyVisitHistory(uid);
          if (copied > 0) loaded = await loadAll();
        } catch (e) {
          console.warn("[神旅帳] 旧コレクションの移行に失敗しました", e);
        }
      }

      return loaded;
    },
    [],
  );

  /** 認証状態の購読 */
  useEffect(() => {
    let alive = true;
    const unsub = backend.onAuthChange(async (u) => {
      if (!alive) return;
      setUser(u);
      if (!u) {
        setProfile(null);
        setVisits([]);
        setGoshuin([]);
        setFavorites([]);
        setReady(true);
        return;
      }
      try {
        await hydrate(backend, u.uid);
      } catch (e) {
        if (alive) setError(toUserMessage(e));
      } finally {
        if (alive) setReady(true);
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [backend, hydrate]);

  const switchBackend = useCallback((next: BackendMode) => {
    storeMode(next);
    setMode(next);
    setBackend(getBackend(next));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      // デモモードから Google ログインへ切り替える（Firebase 設定時のみ）
      const target = mode === "demo" && isFirebaseConfigured ? getBackend("firebase") : backend;
      if (target !== backend) switchBackend("firebase");
      const u = await target.signInWithGoogle();
      if (!u.uid) return; // リダイレクト中
      setUser(u);
      await hydrate(target, u.uid);
    } catch (e) {
      if (!isSilentError(e)) setError(toUserMessage(e, "ログインに失敗しました。"));
    } finally {
      setReady(true);
    }
  }, [backend, hydrate, mode, switchBackend]);

  const signInAsDemo = useCallback(async () => {
    setError(null);
    try {
      const target = getBackend("demo");
      if (target !== backend) switchBackend("demo");
      const u = await target.signInAsDemo();
      setUser(u);
      await hydrate(target, u.uid);
    } catch (e) {
      setError(toUserMessage(e, "デモモードを開始できませんでした。"));
    } finally {
      setReady(true);
    }
  }, [backend, hydrate, switchBackend]);

  const signOut = useCallback(async () => {
    try {
      await backend.signOut();
    } catch (e) {
      setError(toUserMessage(e, "ログアウトに失敗しました。"));
    } finally {
      setUser(null);
      setProfile(null);
      setVisits([]);
      setGoshuin([]);
      setFavorites([]);
      setMigration(null);
      savedAchievementsKey.current = "";
      // Firebase 設定時は次回 Google ログインを既定にする
      if (isFirebaseConfigured && mode === "demo") {
        storeMode("firebase");
        setMode("firebase");
        setBackend(getBackend("firebase"));
      }
    }
  }, [backend, mode]);

  const updateProfile = useCallback(
    async (patch: { nickname?: string; photo_url?: string | null }) => {
      if (!user) return;
      const base: UserProfile =
        profile ?? {
          uid: user.uid,
          nickname: user.displayName ?? "参拝者",
          photo_url: user.photoURL ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      const next: UserProfile = { ...base, ...patch };
      try {
        await backend.saveUserProfile(next);
      } catch (e) {
        rethrow(e);
      }
      setProfile(next);
      setUser((u) => (u ? { ...u, displayName: next.nickname, photoURL: next.photo_url } : u));
    },
    [backend, profile, user],
  );

  const uploadImage = useCallback(
    async (kind: "goshuin" | "avatar", file: File) => {
      if (!user) throw new Error("ログインが必要です。");
      try {
        return await backend.uploadImage(user.uid, kind, file);
      } catch (e) {
        rethrow(e);
      }
    },
    [backend, user],
  );

  const checkIn = useCallback(
    async (shrine: Shrine, position: { latitude: number; longitude: number; distance_m: number }) => {
      if (!user) throw new Error("ログインが必要です。");
      let visit: Visit;
      try {
        visit = await backend.addVisit({
          user_id: user.uid,
          shrine_id: shrine.id,
          latitude: position.latitude,
          longitude: position.longitude,
          distance_m: position.distance_m,
        });
      } catch (e) {
        rethrow(e);
      }
      setVisits((prev) => [visit, ...prev]);
      setShrines((prev) =>
        prev.map((s) => (s.id === shrine.id ? { ...s, visit_count: s.visit_count + 1 } : s)),
      );
      return visit;
    },
    [backend, user],
  );

  const removeVisit = useCallback(
    async (visitId: string) => {
      try {
        await backend.deleteVisit(visitId);
      } catch (e) {
        rethrow(e);
      }
      setVisits((prev) => prev.filter((v) => v.id !== visitId));
    },
    [backend],
  );

  const registerGoshuin = useCallback(
    async (input: Omit<NewGoshuinInput, "user_id">) => {
      if (!user) throw new Error("ログインが必要です。");
      let created: Goshuin;
      try {
        created = await backend.addGoshuin({ ...input, user_id: user.uid });
      } catch (e) {
        rethrow(e);
      }
      setGoshuin((prev) => [created, ...prev]);
      return created;
    },
    [backend, user],
  );

  const removeGoshuin = useCallback(
    async (id: string) => {
      try {
        await backend.deleteGoshuin(id);
      } catch (e) {
        rethrow(e);
      }
      setGoshuin((prev) => prev.filter((g) => g.id !== id));
    },
    [backend],
  );

  const toggleFavorite = useCallback(
    async (shrineId: string) => {
      if (!user) throw new Error("ログインが必要です。");
      const on = !favorites.includes(shrineId);
      setFavorites((prev) => (on ? [...prev, shrineId] : prev.filter((id) => id !== shrineId)));
      try {
        await backend.setFavorite(user.uid, shrineId, on);
      } catch (e) {
        // 失敗したら元に戻す
        setFavorites((prev) => (on ? prev.filter((id) => id !== shrineId) : [...prev, shrineId]));
        rethrow(e);
      }
    },
    [backend, favorites, user],
  );

  const shrineMap = useMemo(() => new Map(shrines.map((s) => [s.id, s])), [shrines]);
  const visitCountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of visits) m.set(v.shrine_id, (m.get(v.shrine_id) ?? 0) + 1);
    return m;
  }, [visits]);

  const stats = useMemo(() => computeStats(shrines, visits, goshuin), [shrines, visits, goshuin]);
  const achievements = useMemo(
    () => computeAchievements(stats, profile?.achievements ?? {}),
    [stats, profile?.achievements],
  );
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;

  /** 新規解放された実績を Firestore に保存する（同じ内容は再送しない） */
  const unlockedIdsKey = achievements
    .filter((a) => a.unlocked)
    .map((a) => a.id)
    .join(",");
  useEffect(() => {
    if (!user || !profile) return;
    const current = profile.achievements ?? {};
    const merged = newlyUnlocked(achievements, current);
    const nextKey = `${user.uid}:${Object.keys(merged).sort().join(",")}`;
    if (savedAchievementsKey.current === nextKey) return;
    if (Object.keys(merged).length === Object.keys(current).length) return;
    savedAchievementsKey.current = nextKey;
    setProfile((p) => (p ? { ...p, achievements: merged } : p));
    backend.saveAchievements(user.uid, merged).catch((e) => {
      console.warn("[神旅帳] 実績の保存に失敗しました", e);
    });
    // unlockedIdsKey は実績の集合が変わった時だけ再評価するための依存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedIdsKey, user?.uid, profile?.uid]);

  const value: AppContextValue = {
    backend,
    mode,
    ready,
    user,
    profile,
    shrines,
    visits,
    goshuin,
    favorites,
    stats,
    achievements,
    unlockedAchievements,
    shrineSource,
    error,
    clearError: () => setError(null),
    migration,
    dismissMigration: () => setMigration(null),
    signInWithGoogle,
    signInAsDemo,
    signOut,
    updateProfile,
    uploadImage,
    checkIn,
    removeVisit,
    registerGoshuin,
    removeGoshuin,
    toggleFavorite,
    isFavorite: (shrineId: string) => favorites.includes(shrineId),
    shrineById: (id: string) => shrineMap.get(id),
    visitCountOf: (shrineId: string) => visitCountMap.get(shrineId) ?? 0,
    visitedShrineIds: Array.from(visitCountMap.keys()),
    recentVisits: visits.slice(0, 5),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp は AppProvider の内側で使用してください。");
  return ctx;
}
