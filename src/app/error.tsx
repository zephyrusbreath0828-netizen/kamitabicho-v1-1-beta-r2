"use client";

import Link from "next/link";

/** 画面単位のエラー境界 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-shu/40 font-mincho text-xl text-shu">
        誤
      </div>
      <h1 className="font-mincho text-[1.2rem] font-semibold">画面を表示できませんでした</h1>
      <p className="max-w-[24rem] text-[0.84rem] leading-relaxed text-sumi-mute">
        通信環境をご確認のうえ、もう一度お試しください。改善しない場合はアプリを再読み込みしてください。
      </p>
      {error.digest && <p className="font-mono text-[0.66rem] text-sumi-mute">code: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <button className="btn btn-primary" onClick={reset}>
          再試行
        </button>
        <Link className="btn btn-outline" href="/">
          ホームへ
      </Link>
      </div>
    </div>
  );
}
