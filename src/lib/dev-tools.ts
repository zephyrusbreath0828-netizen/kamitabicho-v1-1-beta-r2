/**
 * 開発・動作確認用ツールの表示可否
 *
 * 対象:
 *   - 神社の座標を擬似現在地として設定する「テスト位置」（チェックインの流れを実機なしで確認）
 *   - ?autologin=1 によるデモユーザーの自動作成／サンプルデータ投入
 *
 * 既定:
 *   - Firebase 未接続（デモモード）では有効：すぐ試せることを優先
 *   - Firebase 接続時は無効：本番利用者に検証用UIを見せない
 *
 * 明示的に切り替えたい場合は NEXT_PUBLIC_ENABLE_DEMO_TOOLS=true / false を設定する。
 */
import { isFirebaseConfigured } from "@/lib/firebase";

export function devToolsEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_DEMO_TOOLS;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !isFirebaseConfigured;
}

/** ?demo=1 が指定されているか（Firebase 設定済みでもデモモードで起動する） */
export function isForceDemoRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}
