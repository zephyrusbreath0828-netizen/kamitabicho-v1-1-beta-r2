"use client";

/**
 * PWA: Service Worker の登録
 *
 * - 本番ビルドでのみ登録（開発時はキャッシュ事故を避ける）
 * - 更新が見つかったら新しい SW を有効化し、1回だけ通知する
 */
import { useEffect, useState } from "react";

export default function ServiceWorkerRegister() {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // 新しい SW が見つかった場合のハンドリング
        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              if (!cancelled) setUpdated(true);
            }
          });
        });
        // 24時間ごとに更新確認（PWA の陳腐化防止）
        window.setInterval(() => void reg.update(), 24 * 60 * 60 * 1000);
      } catch (e) {
        console.warn("[神旅帳] Service Worker の登録に失敗しました", e);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register);
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  if (!updated) return null;
  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-[520px] rounded-xl border border-kin-soft/60 bg-paper px-3 py-2 text-[0.82rem] shadow-lg">
      <div className="flex items-center gap-2">
        <p className="flex-1 leading-snug">新しいバージョンがあります。</p>
        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
          更新
        </button>
      </div>
    </div>
  );
}
