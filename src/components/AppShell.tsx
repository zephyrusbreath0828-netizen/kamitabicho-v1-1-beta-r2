"use client";

/**
 * アプリ全体のシェル
 *
 * 認証ガード（未ログイン → /login、ログイン済みで /login → 元の画面 or ホーム）を
 * **ここ一箇所**で行う。v1.0 はログイン画面とシェルの両方が router.replace を呼び、
 * さらに ?autologin=1 の判定が残って遷移が止まることがあったため、
 * v1.1 では遷移の起点を AuthGate に集約し、二重遷移を排除した。
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { useApp } from "@/lib/app-context";

const NAV = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/shrines", label: "神社", icon: "torii" },
  { href: "/goshuin", label: "御朱印帳", icon: "book" },
  { href: "/achievements", label: "実績", icon: "seal" },
  { href: "/mypage", label: "マイページ", icon: "user" },
] as const;

/** 遷移先として安全なパスか（オープンリダイレクト防止） */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "#a8322a" : "#8b8377";
  const common = {
    width: 23,
    height: 23,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home")
    return (
      <svg {...common}>
        <path d="M3 10.5 12 3.5l9 7" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  if (name === "torii")
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M4.5 6c0 2 .8 3 2 3.4h11c1.2-.4 2-1.4 2-3.4" />
        <path d="M6.5 10.5h11" />
        <path d="M7.5 10.5V20M16.5 10.5V20" />
        <path d="M12 10.5v4" />
      </svg>
    );
  if (name === "book")
    return (
      <svg {...common}>
        <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" />
        <path d="M9 4.5v15" />
        <path d="M12 9h3.5M12 12.5h3.5" />
      </svg>
    );
  if (name === "seal")
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 9h8M8 12.5h8M8 16h4" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c1.4-3.6 4.2-5.2 7.5-5.2S18.1 16.4 19.5 20" />
    </svg>
  );
}

function Splash({ message = "読み込んでいます…" }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-sumi-soft">
      <div className="seal-stamp flex h-16 w-16 items-center justify-center rounded-full border-2 border-shu text-shu">
        <span className="font-mincho text-2xl">神</span>
      </div>
      <p className="font-mincho text-[1rem] tracking-widest">{message}</p>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, mode, migration, dismissMigration, error, clearError } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [online, setOnline] = useState(true);
  const redirected = useRef<string | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  /**
   * 認証ガード（唯一の遷移起点）
   * - 未ログインで保護画面 → /login?next=...
   * - ログイン済みで /login → next またはホーム
   */
  useEffect(() => {
    if (!ready) return;
    if (!user && !isLogin) {
      const next = `${window.location.pathname}${window.location.search}`;
      const dest = `/login?next=${encodeURIComponent(next)}`;
      if (redirected.current === dest) return;
      redirected.current = dest;
      router.replace(dest);
      return;
    }
    if (user && isLogin) {
      const raw = new URLSearchParams(window.location.search).get("next");
      const dest = safeNextPath(raw);
      if (redirected.current === `home:${dest}`) return;
      redirected.current = `home:${dest}`;
      router.replace(dest);
      // 念のためのフォールバック（クライアント遷移が何らかの理由で止まった場合のみ発火）
      window.setTimeout(() => {
        if (window.location.pathname === "/login") window.location.replace(dest);
      }, 2500);
    }
  }, [ready, user, isLogin, router]);

  if (!ready) return <Splash />;
  if (!user && !isLogin) return <Splash message="ログイン画面へ移動しています…" />;
  if (user && isLogin) return <Splash message="ホームへ移動しています…" />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <ServiceWorkerRegister />
      <ChunkReloadGuard />
      <div className="print:hidden">
        {!online && (
          <div
            role="status"
            className="sticky top-0 z-40 mx-3 mt-2 rounded-xl border border-washi-line bg-washi-deep px-3 py-2 text-[0.85rem] leading-snug text-sumi-soft"
          >
            オフラインです。保存済みの御朱印帳はそのまま閲覧できます。
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="sticky top-0 z-40 mx-3 mt-2 flex items-start gap-2 rounded-xl border border-shu/30 bg-[#fdf1ef] px-3 py-2 text-[0.86rem] text-shu-deep anim-in"
          >
            <span className="mt-[2px]">⚠</span>
            <p className="flex-1 leading-snug">{error}</p>
            <button onClick={clearError} className="shrink-0 px-1 text-sumi-mute" aria-label="閉じる">
              ✕
            </button>
          </div>
        )}
        {migration?.performed && (
          <div className="sticky top-0 z-40 mx-3 mt-2 flex items-start gap-2 rounded-xl border border-mori/30 bg-[rgba(70,96,74,0.1)] px-3 py-2 text-[0.84rem] leading-snug text-mori anim-in">
            <span className="mt-[2px]">✓</span>
            <p className="flex-1">
              これまでの記録を引き継ぎました（参拝 {migration.visits}件・御朱印 {migration.goshuin}件）。
            </p>
            <button onClick={dismissMigration} className="shrink-0 px-1" aria-label="閉じる">
              ✕
            </button>
          </div>
        )}
      </div>

      <main className={isLogin ? "flex-1" : "flex-1 pb-28"}>{children}</main>

      {!isLogin && (
        <>
          <InstallPrompt />
          <nav aria-label="メインメニュー" className="tabbar">
            <ul className="grid grid-cols-5">
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="nav-item"
                    >
                      <NavIcon name={item.icon} active={active} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {mode === "demo" && (
              <div className="border-t border-kin-soft/40 bg-[rgba(168,137,79,0.08)] py-[3px] text-center text-[0.66rem] font-semibold tracking-wide text-[#7a5f2c]">
                デモモード（端末内保存）
              </div>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
