"use client";

/**
 * 神社詳細
 * 所在地 / 電話番号 / 公式サイト / ご祭神 / 由緒 / 地図 を表示し、
 * GPS 参拝記録・お気に入り・御朱印登録へ導線を張る。
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import CheckInPanel from "@/components/CheckInPanel";
import FavoriteButton from "@/components/FavoriteButton";
import ShrineMap from "@/components/ShrineMap";
import { useApp } from "@/lib/app-context";
import { formatDateTime } from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import { usePosition } from "@/lib/use-position";

export default function ShrineDetailPage() {
  const params = useParams<{ id: string }>();
  const { shrines, shrineById, visits, goshuin, visitedShrineIds } = useApp();
  const { position } = usePosition();
  const shrine = useMemo(
    () => (params?.id ? shrineById(params.id) ?? shrines.find((s) => s.id === params.id) : undefined),
    [params, shrineById, shrines],
  );

  if (!shrine) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-mincho text-[1.1rem]">神社が見つかりませんでした</p>
        <Link href="/shrines" className="btn btn-outline mt-4">
          神社一覧へ
        </Link>
      </div>
    );
  }

  const visited = visitedShrineIds.includes(shrine.id);
  const shrineVisits = visits.filter((v) => v.shrine_id === shrine.id);
  const shrineGoshuin = goshuin.filter((g) => g.shrine_id === shrine.id);
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${shrine.name} ${shrine.prefecture} 公式サイト`)}`;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "所在地", value: `${shrine.prefecture}${shrine.address}` },
    {
      label: "電話番号",
      value: shrine.phone ? (
        <a href={`tel:${shrine.phone.replace(/[^0-9]/g, "")}`} className="text-shu underline">
          {shrine.phone}
        </a>
      ) : (
        <span className="text-sumi-mute">未登録</span>
      ),
    },
    {
      label: "公式サイト",
      value: shrine.url ? (
        <a href={shrine.url} target="_blank" rel="noopener noreferrer" className="break-all text-shu underline">
          {shrine.url.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="text-shu underline">
          「{shrine.name} 公式サイト」を検索
        </a>
      ),
    },
    { label: "ご祭神", value: shrine.main_deity },
    { label: "由緒", value: <span className="whitespace-pre-wrap">{shrine.description}</span> },
    {
      label: "参拝記録",
      value: (
        <span>
          {shrine.visit_count.toLocaleString("ja-JP")}件
          {visited && <span className="badge-visited ml-2">✓ 参拝済</span>}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* ヒーロー */}
      <div className="relative h-[248px] w-full overflow-hidden bg-washi-deep">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${shrine.image_url})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1713]/90 via-[#1c1713]/35 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-safe">
          <Link
            href="/shrines"
            className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-xl text-white backdrop-blur"
            aria-label="戻る"
          >
            ‹
          </Link>
          <div className="mt-3">
            <FavoriteButton shrineId={shrine.id} shrineName={shrine.name} />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
          <p className="text-[0.68rem] tracking-[0.24em] text-kin-soft">{shrine.prefecture}</p>
          <h1 className="font-mincho text-[1.62rem] leading-tight font-semibold tracking-[0.08em] drop-shadow">
            {shrine.name}
          </h1>
          <p className="mt-1 text-[0.78rem] text-white/80">ご祭神：{shrine.main_deity.split("・")[0]}</p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* クイックアクション */}
        <div className="grid grid-cols-2 gap-2">
          <a href="#checkin" className="btn btn-primary">
            参拝を記録
          </a>
          <Link href={`/goshuin/new?shrine=${shrine.id}`} className="btn btn-outline">
            御朱印を追加
          </Link>
        </div>

        <section className="wa-card p-4">
          <h2 className="font-mincho mb-2 text-[1.02rem] font-semibold">由緒・基本情報</h2>
          <dl className="divide-y divide-washi-line">
            {rows.map((row) => (
              <div key={row.label} className="flex gap-3 py-2.5">
                <dt className="w-[5.4rem] shrink-0 text-[0.78rem] text-sumi-mute">{row.label}</dt>
                <dd className="min-w-0 flex-1 text-[0.88rem] leading-relaxed">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="font-mincho mb-2 text-[1.02rem] font-semibold">地図</h2>
          <ShrineMap
            markers={[
              { id: shrine.id, name: shrine.name, latitude: shrine.latitude, longitude: shrine.longitude, kind: "shrine" },
              ...(position
                ? [
                    {
                      id: "current",
                      name: "現在地",
                      latitude: position.latitude,
                      longitude: position.longitude,
                      kind: "current" as const,
                    },
                  ]
                : []),
            ]}
            center={{ latitude: shrine.latitude, longitude: shrine.longitude }}
            height={230}
            zoom={15}
            showLinks
          />
        </section>

        <div id="checkin" className="scroll-mt-4">
          <CheckInPanel shrine={shrine} />
        </div>

        {shrineGoshuin.length > 0 && (
          <section>
            <div className="section-title">
              <h2>この神社の御朱印</h2>
              <Link href="/goshuin">御朱印帳</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {shrineGoshuin.map((g) => (
                <div key={g.id} className="goshuin-frame aspect-[3/4]">
                  <img src={g.image_url} alt="御朱印" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-mincho mb-2 text-[1.02rem] font-semibold">あなたの参拝履歴</h2>
          {shrineVisits.length === 0 ? (
            <p className="wa-card p-4 text-[0.84rem] text-sumi-mute">
              まだ参拝記録がありません。神社に到着したら上のボタンから登録できます。
            </p>
          ) : (
            <ul className="wa-card divide-y divide-washi-line">
              {shrineVisits.slice(0, 8).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-[0.86rem] font-medium">{formatDateTime(v.visit_datetime)}</p>
                    <p className="text-[0.72rem] text-sumi-mute">神社から {formatDistance(v.distance_m)}</p>
                  </div>
                  <span className="badge-visited">参拝</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pb-2 text-center text-[0.68rem] text-sumi-mute">
          神社情報は変更される場合があります。お出かけ前に公式サイトをご確認ください。
        </p>
      </div>
    </div>
  );
}
