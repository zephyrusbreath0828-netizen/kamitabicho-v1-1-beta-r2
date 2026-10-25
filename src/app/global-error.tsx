"use client";

/** ルートレイアウトで発生した致命的エラー */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f1e6", color: "#26221e", margin: 0 }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>神旅帳を起動できませんでした</h1>
          <p style={{ fontSize: 14, color: "#57504a", maxWidth: 360, lineHeight: 1.8 }}>
            アプリの読み込みに失敗しました。ページを再読み込みしてください。
          </p>
          {error.digest && <p style={{ fontSize: 11, color: "#8b8377" }}>code: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ marginTop: 8, padding: "12px 24px", borderRadius: 12, background: "#a8322a", color: "#fffdf7", border: 0, fontSize: 15, fontWeight: 700 }}
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
