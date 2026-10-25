"use client";

/**
 * デプロイ直後の ChunkLoadError 自動復帰
 *
 * PWA（Service Worker）やブラウザキャッシュに旧バージョンの HTML が残っていると、
 * 新しいビルドで削除された JS チャンクを参照して「画面を表示できません」になります。
 * その場合に限り、セッション内で1回だけ自動再読み込みして最新のチャンクを取り直します。
 */
import { useEffect } from "react";

const KEY = "kamitabicho:chunk-reloaded";

export default function ChunkReloadGuard() {
  useEffect(() => {
    const isChunkError = (text: string) =>
      /ChunkLoadError|Loading chunk|Loading CSS chunk|Importing a module script failed|Failed to fetch dynamically imported module/i.test(
        text,
      );

    const reloadOnce = () => {
      try {
        if (window.sessionStorage.getItem(KEY) === "1") return;
        window.sessionStorage.setItem(KEY, "1");
      } catch {
        return;
      }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(`${e.message ?? ""}`)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string; message?: string } | string | undefined;
      const text = typeof reason === "string" ? reason : `${reason?.name ?? ""} ${reason?.message ?? ""}`;
      if (isChunkError(text)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // 正常に描画できたらフラグを解除し、次回のデプロイでも復帰できるようにする
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(KEY);
      } catch {
        /* noop */
      }
    }, 8000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
