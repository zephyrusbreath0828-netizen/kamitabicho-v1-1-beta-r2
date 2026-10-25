"use client";

/**
 * ログイン画面
 *
 * v1.1 の修正点:
 *  - この画面からは遷移しない（遷移は AppShell 内の AuthGate が一元管理）
 *    v1.0 はログイン画面とシェルの双方が router.replace を呼び、遷移が競合していた。
 *  - デモログインは「セッション確定 → 画面更新 → データ保存」の順で行うため、
 *    保存容量不足でもボタンを押したまま止まらない。
 */
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { isFirebaseConfigured } from "@/lib/firebase";

const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO !== "false";

export default function LoginPage() {
  const { signInWithGoogle, signInAsDemo, error } = useApp();
  const [busy, setBusy] = useState<"google" | "demo" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const run = async (kind: "google" | "demo") => {
    if (busy) return;
    setBusy(kind);
    setLocalError(null);
    try {
      if (kind === "google") await signInWithGoogle();
      else await signInAsDemo();
      // 遷移は AuthGate が user 状態の変化を受けて実行する
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "ログインに失敗しました。");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-washi-texture flex min-h-dvh flex-col">
      <div className="relative overflow-hidden px-6 pt-safe">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-kin/15" />
        <div className="pointer-events-none absolute -right-6 -top-10 h-44 w-44 rounded-full border border-kin/20" />
        <div className="relative flex items-start justify-between pt-10">
          <div>
            <p className="eyebrow">KAMITABICHO</p>
            <h1 className="font-mincho mt-1 text-[2.32rem] leading-[1.15] font-semibold tracking-[0.16em]">
              神旅帳
            </h1>
            <div className="wa-rule mt-4 w-28" />
            <p className="mt-4 text-[0.92rem] leading-relaxed text-sumi-soft">
              全国47都道府県の神社をめぐり、
              <br />
              参拝の記録と御朱印をこの一冊に。
            </p>
          </div>
          <div className="seal-stamp relative mt-2 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-shu/70 text-shu">
            <div className="absolute inset-1 rounded-full border border-shu/30" />
            <span className="font-mincho text-[1.55rem] leading-none tracking-[0.1em]">参拝</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end px-6 pb-safe">
        <ul className="wa-card mt-8 space-y-3.5 p-5">
          {[
            ["神社をさがす", "現在地から近い神社、都道府県・名前で検索"],
            ["参拝を記録する", "神社に到着したらGPSでワンタップ。実績も貯まります"],
            ["御朱印を残す", "写真・参拝日・メモを御朱印帳に。端末を変えても同期"],
          ].map(([title, desc]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-[3px] text-shu" aria-hidden>
                ◆
              </span>
              <div>
                <p className="text-[0.95rem] font-semibold">{title}</p>
                <p className="text-[0.8rem] leading-snug text-sumi-mute">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {(error || localError) && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-shu/30 bg-[#fdf1ef] px-3 py-2 text-[0.82rem] leading-snug text-shu-deep"
          >
            {localError ?? error}
          </p>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            className="btn btn-primary w-full"
            onClick={() => void run("google")}
            disabled={busy !== null || !isFirebaseConfigured}
          >
            {busy === "google" ? "接続しています…" : "Google アカウントでログイン"}
          </button>

          {DEMO_ENABLED && (
            <button className="btn btn-outline w-full" onClick={() => void run("demo")} disabled={busy !== null}>
              {busy === "demo" ? "準備しています…" : "デモモードで試す（登録不要）"}
            </button>
          )}

          {!isFirebaseConfigured && (
            <p className="rounded-xl border border-kin/30 bg-[rgba(168,137,79,0.08)] px-3 py-2 text-[0.76rem] leading-relaxed text-[#7a5f2c]">
              Firebase が未設定のため、Google ログインは現在ご利用いただけません。
              デモモードですべての画面と操作をお試しいただけます（データはこの端末内に保存）。
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[0.72rem] leading-relaxed text-sumi-mute">
          ログインすると利用規約およびプライバシーポリシーに同意したものとみなします。
          <br />
          位置情報は参拝記録の登録判定にのみ使用します。
        </p>
        <p className="mt-2 pb-4 text-center text-[0.66rem] text-sumi-mute">神旅帳 v1.1 ベータ</p>
      </div>
    </div>
  );
}
