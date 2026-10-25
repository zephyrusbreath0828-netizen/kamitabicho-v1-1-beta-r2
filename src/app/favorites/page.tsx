"use client";

/** お気に入りの神社 */
import PageHeader from "@/components/PageHeader";
import ShrineCard from "@/components/ShrineCard";
import { EmptyState } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { distanceMeters } from "@/lib/geo";
import { usePosition } from "@/lib/use-position";

export default function FavoritesPage() {
  const { favorites, shrineById, visitedShrineIds, visitCountOf } = useApp();
  const { position } = usePosition();
  const list = favorites.map((id) => shrineById(id)).filter((s) => s !== undefined);

  return (
    <div>
      <PageHeader title="お気に入り" subtitle={`${list.length}社を登録しています`} backHref="/mypage" eyebrow="FAVORITES" />
      <div className="space-y-2.5 px-4 py-4">
        {list.length === 0 ? (
          <EmptyState
            title="お気に入りはまだありません"
            description="神社カードの☆を押すと、ここにまとめて表示されます。"
            actionLabel="神社をさがす"
            actionHref="/shrines"
            mark="星"
          />
        ) : (
          <div className="stagger space-y-2.5">
            {list.map((s) => (
              <ShrineCard
                key={s.id}
                shrine={s}
                visited={visitedShrineIds.includes(s.id)}
                visitCount={visitCountOf(s.id)}
                distance={
                  position
                    ? distanceMeters(
                        { latitude: position.latitude, longitude: position.longitude },
                        { latitude: s.latitude, longitude: s.longitude },
                      )
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
