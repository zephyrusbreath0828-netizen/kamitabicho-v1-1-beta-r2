"use client";

import Link from "next/link";
import FavoriteButton from "@/components/FavoriteButton";
import { formatDistance } from "@/lib/geo";
import type { Shrine } from "@/lib/types";

export default function ShrineCard({
  shrine,
  distance,
  visited,
  visitCount,
  variant = "row",
}: {
  shrine: Shrine;
  distance?: number | null;
  visited?: boolean;
  visitCount?: number;
  variant?: "row" | "tile";
}) {
  if (variant === "tile") {
    return (
      <div className="wa-card press relative w-[186px]">
        <Link href={`/shrines/${shrine.id}`} className="block" aria-label={`${shrine.name}の詳細`}>
          <div
            className="h-[104px] w-full bg-washi-deep bg-cover bg-center"
            style={{ backgroundImage: `url(${shrine.image_url})` }}
            aria-hidden
          />
          <div className="px-3 py-2.5">
            <p className="font-mincho truncate text-[0.98rem] font-semibold">{shrine.name}</p>
            <p className="truncate text-[0.74rem] text-sumi-mute">
              {shrine.prefecture}・{shrine.main_deity.split("・")[0]}
            </p>
            {typeof distance === "number" && (
              <p className="mt-1 text-[0.74rem] font-semibold text-shu">{formatDistance(distance)}</p>
            )}
          </div>
        </Link>
        <div className="absolute right-2 top-2">
          <FavoriteButton shrineId={shrine.id} shrineName={shrine.name} />
        </div>
        {visited && (
          <span className="badge-visited absolute left-2 top-2 bg-paper/90">✓ 参拝済</span>
        )}
      </div>
    );
  }

  return (
    <div className="wa-card press relative flex items-stretch gap-3 p-3">
      <Link href={`/shrines/${shrine.id}`} className="absolute inset-0 z-0" aria-label={`${shrine.name}の詳細`} />
      <div
        className="h-[74px] w-[68px] shrink-0 rounded-[10px] bg-washi-deep bg-cover bg-center"
        style={{ backgroundImage: `url(${shrine.image_url})` }}
        aria-hidden
      />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-start gap-2 pr-8">
          <p className="font-mincho flex-1 text-[1.02rem] leading-snug font-semibold">{shrine.name}</p>
          {visited && <span className="badge-visited shrink-0">✓ 参拝済</span>}
        </div>
        <p className="mt-0.5 truncate text-[0.78rem] text-sumi-mute">
          {shrine.prefecture}・{shrine.main_deity.split("・")[0]}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.74rem] text-sumi-soft">
          {typeof distance === "number" && (
            <span className="font-semibold text-shu">現在地から {formatDistance(distance)}</span>
          )}
          {typeof visitCount === "number" && visitCount > 0 && <span>参拝 {visitCount}回</span>}
          <span>記録 {shrine.visit_count.toLocaleString("ja-JP")}件</span>
        </div>
      </div>
      <div className="absolute right-2 top-2">
        <FavoriteButton shrineId={shrine.id} shrineName={shrine.name} />
      </div>
    </div>
  );
}
