"use client";

/** 神社一覧：名前検索・都道府県・参拝済み・お気に入りで絞り込み */
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ShrineCard from "@/components/ShrineCard";
import { EmptyState } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { distanceMeters } from "@/lib/geo";
import { usePosition } from "@/lib/use-position";

type Filter = "all" | "visited" | "favorite";

export default function ShrinesPage() {
  const { shrines, visitedShrineIds, favorites, visitCountOf } = useApp();
  const { position } = usePosition();
  const [query, setQuery] = useState("");
  const [pref, setPref] = useState<string>("すべて");
  const [filter, setFilter] = useState<Filter>("all");

  // ?q= を初期値として受け取る（useSearchParams は静的生成時に Suspense が必要なため）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  const prefectures = useMemo(() => ["すべて", ...Array.from(new Set(shrines.map((s) => s.prefecture)))], [shrines]);

  const list = useMemo(() => {
    const q = query.trim();
    return shrines
      .filter((s) => (pref === "すべて" ? true : s.prefecture === pref))
      .filter((s) => (filter === "visited" ? visitedShrineIds.includes(s.id) : filter === "favorite" ? favorites.includes(s.id) : true))
      .filter((s) => (q ? s.name.includes(q) || s.prefecture.includes(q) || s.main_deity.includes(q) || s.address.includes(q) : true))
      .map((s) => ({
        shrine: s,
        distance: position
          ? distanceMeters(
              { latitude: position.latitude, longitude: position.longitude },
              { latitude: s.latitude, longitude: s.longitude },
            )
          : null,
      }))
      .sort((a, b) => {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        return a.shrine.id.localeCompare(b.shrine.id);
      });
  }, [shrines, pref, filter, query, visitedShrineIds, favorites, position]);

  return (
    <div>
      <PageHeader
        title="神社をさがす"
        subtitle={`${shrines.length}社・${prefectures.length - 1}都道府県を収録`}
        eyebrow="SHRINES"
      />

      <div className="sticky top-0 z-20 space-y-2.5 border-b border-washi-line bg-washi/95 px-4 py-3 backdrop-blur">
        <input
          className="field"
          placeholder="神社名・都道府県・ご祭神で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="神社を検索"
        />
        <div className="flex gap-2">
          {([
            ["all", "すべて"],
            ["visited", "参拝済み"],
            ["favorite", "お気に入り"],
          ] as Array<[Filter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`chip chip-btn ${filter === key ? "chip-active" : ""}`}
              aria-pressed={filter === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar -mt-px flex gap-2 overflow-x-auto border-b border-washi-line bg-paper/60 px-4 py-2">
        {prefectures.map((p) => (
          <button
            key={p}
            onClick={() => setPref(p)}
            className={`chip chip-btn shrink-0 ${pref === p ? "chip-active" : ""}`}
            aria-pressed={pref === p}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="space-y-2.5 px-4 py-4">
        <p className="text-[0.76rem] text-sumi-mute">{list.length}件</p>
        {list.length === 0 ? (
          <EmptyState
            title="該当する神社がありません"
            description="検索条件を変更するか、絞り込みを解除してお試しください。"
            mark="無"
          />
        ) : (
          <div className="stagger space-y-2.5">
            {list.map(({ shrine, distance }) => (
              <ShrineCard
                key={shrine.id}
                shrine={shrine}
                distance={distance}
                visited={visitedShrineIds.includes(shrine.id)}
                visitCount={visitCountOf(shrine.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
