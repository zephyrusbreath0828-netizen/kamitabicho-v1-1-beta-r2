/**
 * バックエンドの選択
 *
 * - NEXT_PUBLIC_FIREBASE_* が揃っていれば FirebaseBackend
 * - 未設定なら DemoBackend（localStorage）
 * - Firebase 設定済みでも「デモモードで試す」を選べる（テストユーザー向け）
 *   → 選択は localStorage に保存され、次回起動時も維持される
 */
import { DemoBackend } from "@/lib/backend-demo";
import { FirebaseBackend } from "@/lib/backend-firebase";
import { isFirebaseConfigured } from "@/lib/firebase";
import { readStoredMode } from "@/lib/legacy";
import type { Backend, BackendMode } from "@/lib/types";

const instances = new Map<BackendMode, Backend>();

/** 起動時に使うモードを決める（Firebase 未設定なら必ずデモ） */
export function resolveInitialMode(): BackendMode {
  if (!isFirebaseConfigured) return "demo";
  return readStoredMode() === "demo" ? "demo" : "firebase";
}

/** モードごとのシングルトンを返す（認証購読の二重登録を避ける） */
export function getBackend(mode: BackendMode = resolveInitialMode()): Backend {
  if (!isFirebaseConfigured && mode === "firebase") return getBackend("demo");
  const cached = instances.get(mode);
  if (cached) return cached;
  const created: Backend = mode === "firebase" ? new FirebaseBackend() : new DemoBackend();
  instances.set(mode, created);
  return created;
}

/** 設定画面・動作確認用 */
export function backendInfo() {
  const backend = getBackend();
  return {
    configured: isFirebaseConfigured,
    using: backend.mode,
    description: backend.describe(),
  };
}
