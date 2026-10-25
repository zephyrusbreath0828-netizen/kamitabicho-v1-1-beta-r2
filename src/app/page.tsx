"use client";

/**
 * ホーム画面
 * 挨拶 / 統計 / 検索 / 最近参拝した神社 / お気に入り / 近くの神社 / 地図
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ShrineCard from "@/components/ShrineCard";
import ShrineMap, { type MapMarker } from "@/components/ShrineMap";
import { EmptyState, SectionTitle } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { devToolsEnabled } from "@/lib/dev-tools";
import { CHECKIN_RADIUS_M, distanceMeters, formatDistance, formatLatLng } from "@/lib/geo";
import { formatRelative } from "@/lib/format";
import { usePosition, useTestPosition } from "@/lib/use-position";

export default function HomePage() {
  const {
    user,
    profile,
    shrines,
    visits,
    goshuin,
    favorites,
    stats,
    visitedShrineIds,
    visitCountOf,
    shrineById,
    achievements,
  } = useApp();
  const { position, loading, error, locate } = usePosition();
  const { setTest } = useTestPosition();
  const [query, setQuery] = useState("");
  const [showTest, setShowTest] = useState(false);
  const [showDevTools] = useState(() => devToolsEnabled());
  const router = useRouter();

  useEffect(() => {
    if (!position) void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearby = useMemo(() => {
    if (!position) return [];
    return shrines
      .map((s) => ({
        shrine: s,
        distance: distanceMeters(
          { latitude: position.latitude, longitude: position.longitude },
          { latitude: s.latitude, longitude: s.longitude },
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [position, shrines]);

  const within300 = nearby.filter((n) => n.distance <= CHECKIN_RADIUS_M).length;
  const favoriteShrines = favorites.map((id) => shrineById(id)).filter((s) => s !== undefined);
  const recent = visits.slice(0, 6);
  const nextAchievement = achievements.find((a) => !a.unlocked);

  const markers: MapMarker[] = [
    ...nearby.slice(0, 4).map((n) => ({
      id: n.shrine.id,
      name: n.shrine.name,
      latitude: n.shrine.latitude,
      longitude: n.shrine.longitude,
      kind: (visitedShrineIds.includes(n.shrine.id) ? "visited" : "shrine") as MapMarker["kind"],
    })),
  ];
  if (position) {
    markers.push({
      id: "current",
      name: "現在地",
      latitude: position.latitude,
      longitude: position.longitude,
      kind: "current",
    });
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(query.trim() ? `/shrines?q=${encodeURIComponent(query.trim())}` : "/shrines");
  };

  return (
    <div className="min-h-dvh">
      <header className="bg-mokume relative overflow-hidden pt-safe text-washi">
        <div className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full border border-white/10" />
        <div className="relative flex items-end justify-between px-4 pt-4 pb-3">
          <div>
            <p className="text-[0.62rem] tracking-[0.34em] text-kin-soft">KAMITABICHO</p>
            <h1 className="font-mincho text-[1.52rem] leading-tight font-semibold tracking-[0.14em]">神旅帳</h1>
          </div>
          <Link
            href="/profile"
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/15 text-lg"
            aria-label="プロフィール"
          >
            {profile?.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{(profile?.nickname ?? user?.displayName ?? "参").slice(0, 1)}</span>
            )}
          </Link>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-shu-soft via-kin to-transparent" />
      </header>

      <div className="space-y-5 px-4 py-4">
        <section className="anim-in">
          <p className="font-mincho text-[1.04rem]">
            ようこそ、{profile?.nickname ?? user?.displayName ?? "参拝者"} さま
          </p>
          <p className="text-[0.78rem] text-sumi-mute">今日も、よい巡礼を。</p>
        </section>

        {/* 統計 */}
        <section className="wa-card anim-in px-2 py-3">
          <div className="grid grid-cols-3 divide-x divide-washi-line">
            {[
              { label: "参拝した神社", value: stats.shrines, unit: `/ ${stats.totalShrines}社` },
              { label: "総参拝回数", value: stats.visits, unit: "回" },
              { label: "御朱印", value: stats.goshuin, unit: "枚" },
            ].map((s) => (
              <div key={s.label} className="px-1 text-center">
                <p className="stat-label">{s.label}</p>
                <p className="stat-value">
                  {s.value}
                  <span className="ml-0.5 text-[0.66rem] font-normal text-sumi-mute">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 px-4">
            <div className="flex items-center justify-between text-[0.7rem] text-sumi-mute">
              <span>参拝達成率</span>
              <span className="font-semibold text-shu">{stats.rate.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-washi-deep">
              <div
                className="h-full rounded-full bg-gradient-to-r from-shu to-kin transition-[width] duration-700"
                style={{ width: `${Math.min(100, stats.rate)}%` }}
              />
            </div>
          </div>
        </section>

        {/* 検索 */}
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            className="field flex-1"
            placeholder="神社名・都道府県で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="神社名で検索"
          />
          <button type="submit" className="btn btn-primary px-5">
            検索
          </button>
        </form>

        {/* 最近参拝した神社 */}
        <section>
          <SectionTitle title="最近参拝した神社" actionLabel="履歴" actionHref="/mypage" />
          {recent.length === 0 ? (
            <EmptyState
              title="まだ参拝記録がありません"
              description="神社の詳細画面で現在地を取得すると、参拝記録を登録できます。"
              actionLabel="神社をさがす"
              actionHref="/shrines"
              mark="参"
            />
          ) : (
            <div className="h-scroll no-scrollbar stagger">
              {recent.map((v) => {
                const s = shrineById(v.shrine_id);
                if (!s) return null;
                return (
                  <Link key={v.id} href={`/shrines/${s.id}`} className="wa-card press relative w-[172px] overflow-hidden">
                    <div
                      className="h-[92px] w-full bg-washi-deep bg-cover bg-center"
                      style={{ backgroundImage: `url(${s.image_url})` }}
                      aria-hidden
                    />
                    <div className="px-2.5 py-2">
                      <p className="font-mincho truncate text-[0.92rem] font-semibold">{s.name}</p>
                      <p className="text-[0.7rem] text-sumi-mute">
                        {formatRelative(v.visit_datetime)}・{s.prefecture}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* お気に入り */}
        {favoriteShrines.length > 0 && (
          <section>
            <SectionTitle title="お気に入りの神社" actionLabel="すべて" actionHref="/favorites" />
            <div className="h-scroll no-scrollbar">
              {favoriteShrines.map((s) => (
                <ShrineCard
                  key={s.id}
                  shrine={s}
                  variant="tile"
                  visited={visitedShrineIds.includes(s.id)}
                  visitCount={visitCountOf(s.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 次の実績 */}
        {nextAchievement && (
          <section className="wa-card wa-card-accent flex items-center gap-3 px-4 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-kin/60 font-mincho text-[1.05rem] text-kin">
              {nextAchievement.mark}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] text-sumi-mute">次の実績</p>
              <p className="text-[0.9rem] font-bold">
                {nextAchievement.name}
                <span className="ml-2 text-[0.74rem] font-normal text-sumi-mute">
                  あと{nextAchievement.remaining}
                </span>
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-washi-deep">
                <div
                  className="h-full rounded-full bg-kin"
                  style={{ width: `${Math.max(4, nextAchievement.progress * 100)}%` }}
                />
              </div>
            </div>
            <Link href="/achievements" className="shrink-0 text-[0.76rem] font-semibold text-shu underline">
              実績
            </Link>
          </section>
        )}

        {/* 現在地 */}
        <section className="wa-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mincho text-[1.02rem] font-semibold">現在地</h2>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => void locate()}
              disabled={loading}
            >
              {loading ? "取得中…" : "位置情報を更新"}
            </button>
          </div>
          {position ? (
            <div className="mt-2 text-[0.84rem] text-sumi-soft">
              <p className="font-medium text-sumi">{position.label}</p>
              <p className="text-[0.74rem] text-sumi-mute">
                {formatLatLng(position.latitude, position.longitude)}
                {position.accuracy ? `・精度 約${Math.round(position.accuracy)}m` : ""}
              </p>
              {within300 > 0 && (
                <p className="mt-2 rounded-xl bg-[rgba(70,96,74,0.1)] px-3 py-2 text-[0.82rem] text-mori">
                  すぐ近くに {within300}社 あります。神社詳細から参拝記録を登録できます。
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[0.84rem] leading-relaxed text-sumi-mute">
              {error ?? "位置情報を取得すると、近くの神社と参拝記録の登録ができます。"}
            </p>
          )}

          {showDevTools && (
            <>
              <button
                className="mt-3 text-[0.8rem] font-semibold text-mokume underline"
                onClick={() => setShowTest((v) => !v)}
              >
                動作確認用の位置情報を設定する
              </button>
              {showTest && (
                <div className="mt-2 rounded-xl border border-washi-line bg-washi-deep/60 p-3">
                  <p className="text-[0.76rem] leading-snug text-sumi-soft">
                    境内にいなくてもチェックインを試せるように、任意の神社を「現在地」に設定できます（検証用）。
                  </p>
                  <select
                    className="field mt-2"
                    defaultValue=""
                    onChange={(e) => {
                      const s = shrines.find((x) => x.id === e.target.value);
                      if (s) setTest(s.latitude, s.longitude, `${s.name}（テスト位置）`);
                    }}
                  >
                    <option value="">神社を選択してください</option>
                    {shrines.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.prefecture}｜{s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </section>

        <ShrineMap markers={markers} center={position} height={200} zoom={position ? 13 : 5} />

        {/* 近くの神社 */}
        <section>
          <SectionTitle title="近くの神社" actionLabel="すべて見る" actionHref="/shrines" />
          {position ? (
            <div className="space-y-2.5 stagger">
              {nearby.map((n) => (
                <ShrineCard
                  key={n.shrine.id}
                  shrine={n.shrine}
                  distance={n.distance}
                  visited={visitedShrineIds.includes(n.shrine.id)}
                  visitCount={visitCountOf(n.shrine.id)}
                />
              ))}
            </div>
          ) : (
            <p className="wa-card p-4 text-[0.86rem] text-sumi-mute">
              位置情報を取得すると、現在地から近い順に神社を表示します。
            </p>
          )}
        </section>

        {visits.length > 0 && goshuin.length === 0 && (
          <Link href="/goshuin/new" className="wa-card flex items-center gap-3 px-4 py-3">
            <span className="text-shu" aria-hidden>
              ✦
            </span>
            <div className="flex-1">
              <p className="text-[0.9rem] font-semibold">御朱印を記録しませんか</p>
              <p className="text-[0.74rem] text-sumi-mute">参拝の証を写真で残しておきましょう</p>
            </div>
            <span className="text-sumi-mute" aria-hidden>
              ›
            </span>
          </Link>
        )}

        <p className="pb-2 text-center text-[0.68rem] leading-relaxed text-sumi-mute">
          {formatDistance(CHECKIN_RADIUS_M)} 以内で参拝記録を登録できます
        </p>
      </div>
    </div>
  );
}
