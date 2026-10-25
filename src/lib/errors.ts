/**
 * エラーメッセージ変換ユーティリティ
 *
 * Firebase（Auth / Firestore / Storage）のエラーコードを、利用者に伝わる日本語へ変換する。
 * 画面側は例外を捕まえたら必ず toUserMessage() を通して表示すること。
 */

/** 表示する必要のない（利用者の意図的な操作による）エラーコード */
const SILENT_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

const MESSAGES: Record<string, string> = {
  // --- Authentication ---
  "auth/popup-blocked": "ログイン用のウィンドウがブロックされました。ブラウザのポップアップ設定を許可してください。",
  "auth/unauthorized-domain": "このドメインは Firebase の「承認済みドメイン」に登録されていません。管理者にご連絡ください。",
  "auth/operation-not-allowed": "Google ログインが Firebase Authentication で有効になっていません。",
  "auth/network-request-failed": "通信に失敗しました。電波の良い場所でもう一度お試しください。",
  "auth/too-many-requests": "試行回数が多すぎます。しばらく時間をおいてからお試しください。",
  "auth/internal-error": "認証処理でエラーが発生しました。もう一度お試しください。",

  // --- Firestore ---
  "permission-denied": "この操作を行う権限がありません。ログイン状態をご確認ください。",
  "unauthenticated": "ログインの有効期限が切れました。もう一度ログインしてください。",
  "unavailable": "サーバーに接続できませんでした。通信環境をご確認ください。",
  "deadline-exceeded": "通信がタイムアウトしました。もう一度お試しください。",
  "failed-precondition": "データベースの準備が完了していません。しばらくしてからお試しください（インデックス作成中の場合があります）。",
  "resource-exhausted": "利用上限に達しました。しばらくしてからお試しください。",
  "not-found": "対象のデータが見つかりませんでした。",
  "cancelled": "処理が中断されました。",

  // --- Storage ---
  "storage/unauthorized": "写真をアップロードする権限がありません。ログイン状態をご確認ください。",
  "storage/retry-limit-exceeded": "写真のアップロードがタイムアウトしました。通信環境をご確認ください。",
  "storage/canceled": "写真のアップロードが中断されました。",
  "storage/quota-exceeded": "ストレージの容量上限に達しました。",
  "storage/unknown": "写真の保存に失敗しました。もう一度お試しください。",
};

const DEFAULT_MESSAGE = "処理に失敗しました。通信環境をご確認のうえ、もう一度お試しください。";

export function errorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

/** 利用者の操作ミスによる静かなエラー（何も表示しない）かどうか */
export function isSilentError(e: unknown): boolean {
  return SILENT_CODES.has(errorCode(e));
}

/**
 * 例外を利用者向けメッセージへ変換する。
 * - Firebase のエラーコードはマッピング表から日本語へ
 * - アプリ内で throw した日本語メッセージ（デモモード等）はそのまま返す
 */
export function toUserMessage(e: unknown, fallback = DEFAULT_MESSAGE): string {
  if (!e) return fallback;

  const code = errorCode(e);
  if (code && MESSAGES[code]) return MESSAGES[code];

  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";

  // アプリ独自の日本語メッセージはそのまま表示する（デモモードの容量超過など）
  if (/[ぁ-んァ-ヶ一-龠]/.test(raw) && !/^(Firebase|Firestore|Missing or insufficient)/i.test(raw)) {
    return raw;
  }

  // オフライン時に原因が分かりにくいエラーは、通信を疑うメッセージへ寄せる
  if (/network|offline|fetch/i.test(raw) || code === "unavailable") {
    return MESSAGES.unavailable;
  }

  return fallback;
}

/** 現在オフラインかどうか（SSR では false） */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
