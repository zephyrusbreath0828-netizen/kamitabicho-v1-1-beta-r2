"use client";

/** 御朱印帳：撮影した御朱印をグリッド表示し、拡大・削除できる */
import Link from "next/link";
import { useMemo, useState } from "react";
import GoshuinViewer, { type ViewerItem } from "@/components/GoshuinViewer";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { toUserMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

export default function GoshuinPage() {
  const { goshuin, shrines, shrineById, removeGoshuin, error: appError } = useApp();
  const [selected, setSelected] = useState<ViewerItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "shrine">("new");

  const list = useMemo(() => {
    const copy = [...goshuin];
    if (sort === "shrine") copy.sort((a, b) => a.shrine_id.localeCompare(b.shrine_id));
    else copy.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return copy;
  }, [goshuin, sort]);

  const deleteOne = async (id: string) => {
    try {
      await removeGoshuin(id);
      setSelected(null);
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="御朱印帳"
        subtitle={`${goshuin.length}枚の御朱印を記録しています`}
        eyebrow="GOSHUIN"
        action={
          <Link href="/goshuin/new" className="mt-1 rounded-full bg-white/15 px-3 py-2 text-[0.8rem] font-semibold">
            ＋ 追加
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[0.76rem] text-sumi-mute">{shrines.length}社のうち {new Set(goshuin.map((g) => g.shrine_id)).size}社</p>
          <div className="flex gap-1.5">
            {([
              ["new", "新しい順"],
              ["shrine", "神社順"],
            ] as Array<["new" | "shrine", string]>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`chip chip-btn ${sort === key ? "chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(error || appError) && (
          <p className="rounded-xl border border-shu/30 bg-[#fdf1ef] px-3 py-2 text-[0.82rem] text-shu-deep">
            {error ?? appError}
          </p>
        )}

        {list.length === 0 ? (
          <EmptyState
            title="御朱印帳はまだ空です"
            description="授与所でいただいた御朱印を写真で残しましょう。参拝日とメモも一緒に保存できます。"
            actionLabel="御朱印を追加する"
            actionHref="/goshuin/new"
            mark="朱"
          />
        ) : (
          <div className="stagger grid grid-cols-2 gap-3">
            {list.map((g) => {
              const shrine = shrineById(g.shrine_id);
              return (
                <button
                  key={g.id}
                  className="text-left"
                  onClick={() =>
                    setSelected({
                      id: g.id,
                      image_url: g.image_url,
                      memo: g.memo,
                      visited_date: g.visited_date,
                      created_at: g.created_at,
                      shrine_id: g.shrine_id,
                    })
                  }
                >
                  <div className="goshuin-frame aspect-[3/4]">
                    <img src={g.image_url} alt={`${shrine?.name ?? ""}の御朱印`} />
                  </div>
                  <p className="font-mincho mt-1.5 truncate text-[0.86rem] font-semibold">
                    {shrine?.name ?? "神社"}
                  </p>
                  <p className="text-[0.7rem] text-sumi-mute">{formatDate(g.visited_date ?? g.created_at)}</p>
                </button>
              );
            })}
          </div>
        )}

        <Link href="/goshuin/new" className="btn btn-primary w-full">
          御朱印を追加する
        </Link>
      </div>

      <GoshuinViewer
        item={selected}
        shrine={selected ? shrineById(selected.shrine_id) : undefined}
        onClose={() => setSelected(null)}
        onDelete={(id) => void deleteOne(id)}
      />
    </div>
  );
}
