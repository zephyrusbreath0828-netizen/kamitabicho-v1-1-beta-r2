"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { toUserMessage } from "@/lib/errors";

/** お気に入り登録ボタン（楽観更新・失敗時はロールバック） */
export default function FavoriteButton({
  shrineId,
  shrineName,
  variant = "icon",
}: {
  shrineId: string;
  shrineName?: string;
  variant?: "icon" | "full";
}) {
  const { isFavorite, toggleFavorite, user } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = isFavorite(shrineId);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      await toggleFavorite(shrineId);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (variant === "full") {
    return (
      <div>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-pressed={active}
          className={`btn w-full ${active ? "btn-primary" : "btn-outline"}`}
        >
          <span aria-hidden>{active ? "★" : "☆"}</span>
          {active ? "お気に入り登録済み" : "お気に入りに登録"}
        </button>
        {error && <p className="mt-1 text-center text-[0.76rem] text-shu-deep">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={`${shrineName ?? "この神社"}をお気に入り${active ? "から解除" : "に登録"}`}
      className={`z-10 flex h-9 w-9 items-center justify-center rounded-full border text-[1rem] transition-colors ${
        active ? "border-kin/60 bg-[#fdf6e6] text-kin" : "border-washi-line bg-paper/90 text-sumi-mute"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
