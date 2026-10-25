"use client";

/** 御朱印の拡大表示（ボトムシート） */
import { useEffect } from "react";
import { formatDate } from "@/lib/format";
import type { Shrine } from "@/lib/types";

export type ViewerItem = {
  id: string;
  image_url: string;
  memo: string;
  visited_date?: string;
  created_at: string;
  shrine_id: string;
};

export default function GoshuinViewer({
  item,
  shrine,
  onClose,
  onDelete,
}: {
  item: ViewerItem | null;
  shrine?: Shrine;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="御朱印の詳細"
      className="fixed inset-0 z-50 flex items-end justify-center bg-sumi/50 anim-fade backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-sheet w-full max-w-[560px] rounded-t-2xl bg-paper px-4 pb-safe pt-3 anim-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-11 rounded-full bg-washi-line" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">GOSHUIN</p>
            <h2 className="font-mincho text-[1.15rem] font-semibold">{shrine?.name ?? "御朱印"}</h2>
            <p className="text-[0.76rem] text-sumi-mute">
              {formatDate(item.visited_date ?? item.created_at)}
              {shrine ? `・${shrine.prefecture}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost min-h-[40px] px-2" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="goshuin-frame mt-3">
          <img src={item.image_url} alt={`${shrine?.name ?? ""}の御朱印`} className="max-h-[52dvh] w-full object-contain" />
        </div>

        {item.memo && (
          <div className="mt-3 rounded-xl border border-washi-line bg-washi-deep/40 px-3 py-2">
            <p className="text-[0.72rem] text-sumi-mute">参拝の記録</p>
            <p className="mt-1 whitespace-pre-wrap text-[0.88rem] leading-relaxed">{item.memo}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2 pb-4">
          {onDelete && (
            <button
              className="btn btn-outline flex-1 border-shu/30 text-shu"
              onClick={() => {
                if (window.confirm("この御朱印を削除しますか？この操作は取り消せません。")) onDelete(item.id);
              }}
            >
              削除
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
