/**
 * 画像ファイルの取り扱いユーティリティ
 * - 御朱印写真・プロフィール画像のクライアント側バリデーション
 * - デモモード用の data URL 変換（長辺 1000px / JPEG 品質 0.72 に縮小）
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function validateImage(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "画像ファイル（JPEG / PNG / WebP）を選択してください。";
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
    return "対応していない画像形式です。";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "画像サイズが大きすぎます（8MBまで）。";
  }
  return null;
}

/** ファイルを data URL へ変換する（デモモード・プレビュー用） */
export function fileToDataUrl(file: File, maxSize = 1000, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.onload = () => {
      const raw = String(reader.result);
      const img = new Image();
      img.onerror = () => resolve(raw); // 縮小できなければ元画像をそのまま使う
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(raw);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

/** 画像のファイル名を衝突しない形で生成する */
export function buildFileName(prefix: string, file: File): string {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${rand}.${ext || "jpg"}`;
}

/** data URL を File に変換する（デモデータを Storage へ移行する際に使用） */
export function dataUrlToFile(dataUrl: string, fileName = "image.jpg"): File {
  const [meta, base64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}
