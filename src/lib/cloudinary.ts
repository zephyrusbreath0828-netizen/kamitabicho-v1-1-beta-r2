/**
 * Cloudinary への画像アップロード（署名なしアップロード / Unsigned）
 *
 * 方針:
 *  - Firebase Storage は使用しない。御朱印・プロフィール画像は Cloudinary に保存し、
 *    返却された `secure_url` だけを Firestore に保存する。
 *  - API Secret はブラウザに置かない（unsigned upload preset のみ使用）。
 *  - 失敗時は必ず日本語の ImageUploadError を投げ、画面でメッセージ表示できるようにする。
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME     クラウド名
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET  署名なしプリセット名
 *   NEXT_PUBLIC_CLOUDINARY_FOLDER         保存フォルダ（既定 kamitabicho）
 */
import { fileToDataUrl, validateImage } from "@/lib/photo";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";
const BASE_FOLDER = (process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER ?? "kamitabicho").replace(/^\/+|\/+$/g, "");

/** Cloudinary の設定が揃っているか */
export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/** アップロード失敗を表す例外（画面でそのまま表示できる日本語メッセージを持つ） */
export class ImageUploadError extends Error {
  code: string;
  constructor(message: string, code = "cloudinary/upload-failed") {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

export type UploadKind = "goshuin" | "avatar";

/** 種類ごとの保存先と縮小設定 */
const KIND_CONFIG: Record<UploadKind, { folder: string; maxSize: number; quality: number; tag: string }> = {
  goshuin: { folder: "goshuin", maxSize: 1600, quality: 0.85, tag: "goshuin" },
  avatar: { folder: "avatars", maxSize: 400, quality: 0.82, tag: "avatar" },
};

/**
 * Cloudinary のエラー応答を利用者向けメッセージへ変換する。
 * （HTTP ステータスだけでは原因が分からないため、本文の error.message も見る）
 */
export function mapCloudinaryError(status: number, body: unknown): ImageUploadError {
  const raw =
    typeof body === "object" && body !== null
      ? String((body as { error?: { message?: string } }).error?.message ?? "")
      : String(body ?? "");
  const lower = raw.toLowerCase();

  if (!isCloudinaryConfigured) {
    return new ImageUploadError(
      "画像アップロードの設定が完了していません。管理者にご連絡ください（Cloudinary の環境変数が未設定です）。",
      "cloudinary/not-configured",
    );
  }
  // Signed プリセットのエラーは "upload preset" も含むため、先に判定する
  if (lower.includes("unsigned") || lower.includes("signed upload") || lower.includes("whitelisted")) {
    return new ImageUploadError(
      "画像アップロードの設定に誤りがあります（プリセットが「Unsigned」になっていません）。管理者にご連絡ください。",
      "cloudinary/preset-signed",
    );
  }
  if (lower.includes("upload preset") || lower.includes("preset not found")) {
    return new ImageUploadError(
      "画像アップロードの設定に誤りがあります（アップロードプリセットが見つかりません）。管理者にご連絡ください。",
      "cloudinary/invalid-preset",
    );
  }
  if (status === 401 || status === 403) {
    return new ImageUploadError(
      "画像をアップロードする権限がありません。管理者にご連絡ください。",
      "cloudinary/unauthorized",
    );
  }
  if (status === 413 || lower.includes("too large") || lower.includes("file size")) {
    return new ImageUploadError("画像サイズが大きすぎます。8MB以下の画像を選択してください。", "cloudinary/too-large");
  }
  if (status === 429) {
    return new ImageUploadError(
      "画像のアップロードが集中しています。少し時間をおいて、もう一度お試しください。",
      "cloudinary/rate-limited",
    );
  }
  if (status >= 500) {
    return new ImageUploadError(
      "画像サーバーでエラーが発生しました。時間をおいて、もう一度お試しください。",
      "cloudinary/server-error",
    );
  }
  return new ImageUploadError(
    "画像のアップロードに失敗しました。通信環境をご確認のうえ、もう一度お試しください。",
    "cloudinary/upload-failed",
  );
}

/** File を Cloudinary へ送れる Blob に変換する（送信量を抑えるため縮小する） */
async function prepareBlob(file: File, maxSize: number, quality: number): Promise<Blob> {
  try {
    const dataUrl = await fileToDataUrl(file, maxSize, quality);
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    // 縮小に失敗してもアップロード自体は試す
    return file;
  }
}

/**
 * 画像を Cloudinary へアップロードし、`secure_url` を返す。
 * @throws ImageUploadError 画面表示用のメッセージを持つ
 */
export async function uploadToCloudinary(
  file: File,
  kind: UploadKind,
  uid: string,
): Promise<string> {
  if (!isCloudinaryConfigured) {
    throw mapCloudinaryError(0, null);
  }
  const invalid = validateImage(file);
  if (invalid) throw new ImageUploadError(invalid, "cloudinary/invalid-file");

  const config = KIND_CONFIG[kind];
  // uid をフォルダに含めて所有者を判別できるようにする（推測困難な連番ではない）
  const folder = [BASE_FOLDER, config.folder, uid].filter(Boolean).join("/");
  const blob = await prepareBlob(file, config.maxSize, config.quality);

  const form = new FormData();
  form.append("file", blob, file.name || `${kind}.jpg`);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);
  form.append("tags", `kamitabicho,${config.tag}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) throw mapCloudinaryError(res.status, body);
    const url = (body as { secure_url?: string } | null)?.secure_url;
    if (!url) {
      throw new ImageUploadError(
        "画像のアップロード結果を確認できませんでした。もう一度お試しください。",
        "cloudinary/no-url",
      );
    }
    return url;
  } catch (e) {
    if (e instanceof ImageUploadError) throw e;
    if ((e as Error)?.name === "AbortError") {
      throw new ImageUploadError(
        "画像のアップロードがタイムアウトしました。通信環境をご確認のうえ、もう一度お試しください。",
        "cloudinary/timeout",
      );
    }
    throw new ImageUploadError(
      "画像のアップロードに失敗しました。通信環境をご確認のうえ、もう一度お試しください。",
      "cloudinary/network",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cloudinary の URL から public_id を取り出す（将来の削除・管理用）。
 * 例: https://res.cloudinary.com/demo/image/upload/v123/kamitabicho/goshuin/uid/a.jpg
 *  → kamitabicho/goshuin/uid/a
 */
export function publicIdFromUrl(url: string): string | null {
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
}
