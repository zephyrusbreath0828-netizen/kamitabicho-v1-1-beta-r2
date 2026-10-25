"use client";

/** 参拝実績：達成状況と進捗の一覧 */
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { AchievementBadge, ProgressRing } from "@/components/ui";
import { useApp } from "@/lib/app-context";

export default function AchievementsPage() {
  const { achievements, stats, unlockedAchievements } = useApp();
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const list = achievements.filter((a) =>
    filter === "all" ? true : filter === "unlocked" ? a.unlocked : !a.unlocked,
  );

  return (
    <div>
      <PageHeader title="参拝実績" subtitle="巡礼の歩みを実績として記録します" eyebrow="ACHIEVEMENTS" />

      <div className="space-y-4 px-4 py-4">
        <section className="wa-card flex items-center gap-4 p-4">
          <ProgressRing value={stats.rate} size={112} stroke={9} label="全国達成率" />
          <div className="min-w-0 flex-1">
            <p className="font-mincho text-[1.05rem] font-semibold">
              {unlockedAchievements} / {achievements.length} 達成
            </p>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-sumi-mute">
              参拝した神社・御朱印・都道府県の数に応じて実績が解放されます。
            </p>
            <div className="mt-2 flex gap-3 text-[0.72rem] text-sumi-soft">
              <span>神社 {stats.shrines}</span>
              <span>御朱印 {stats.goshuin}</span>
              <span>都道府県 {stats.prefectures}</span>
            </div>
          </div>
        </section>

        <div className="flex gap-2">
          {([
            ["all", "すべて"],
            ["unlocked", "達成済み"],
            ["locked", "未達成"],
          ] as Array<["all" | "unlocked" | "locked", string]>).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`chip chip-btn ${filter === key ? "chip-active" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5 stagger">
          {list.map((a) => (
            <div key={a.id} className="wa-card flex items-center gap-3 p-3">
              <div className="w-[68px] shrink-0">
                <AchievementBadge achievement={a} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mincho text-[0.98rem] font-semibold">{a.name}</p>
                  <span className={`text-[0.68rem] font-bold ${a.unlocked ? "text-mori" : "text-sumi-mute"}`}>
                    {a.unlocked ? "達成" : `あと ${a.remaining}`}
                  </span>
                </div>
                <p className="mt-0.5 text-[0.76rem] leading-snug text-sumi-mute">{a.description}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-washi-deep">
                  <div
                    className={`h-full rounded-full ${a.unlocked ? "bg-gradient-to-r from-shu to-kin" : "bg-kin/50"}`}
                    style={{ width: `${Math.max(3, Math.min(100, a.value === 0 && !a.unlocked ? 3 : (a.value / a.target) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-[0.66rem] text-sumi-mute">
                  {Math.min(a.value, a.target)} / {a.target}
                  {a.unlockedAt ? `・${new Date(a.unlockedAt).toLocaleDateString("ja-JP")} 達成` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="pb-2 text-center text-[0.68rem] leading-relaxed text-sumi-mute">
          今後、御祭神図鑑・神様カード・巡拝印などの実績を追加予定です。
        </p>
      </div>
    </div>
  );
}
