"use client";

/** 小さな共通 UI パーツ（見出し・空状態・統計・進捗リング・実績バッジ） */
import Link from "next/link";
import type { ReactNode } from "react";
import type { AchievementProgress } from "@/lib/achievements";

export function SectionTitle({
  title,
  actionLabel,
  actionHref,
  trailing,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {trailing}
      {actionLabel && actionHref && <Link href={actionHref}>{actionLabel}</Link>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  mark = "無",
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  mark?: string;
}) {
  return (
    <div className="wa-card flex flex-col items-center gap-2 px-5 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-washi-line text-kin font-mincho">
        {mark}
      </div>
      <p className="font-mincho text-[1rem]">{title}</p>
      <p className="max-w-[26rem] text-[0.84rem] leading-relaxed text-sumi-mute">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn btn-outline btn-sm mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="px-1 text-center">
      <p className="stat-label">{label}</p>
      <p className="stat-value">
        {value}
        {unit && <span className="ml-0.5 text-[0.68rem] font-normal text-sumi-mute">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[0.66rem] text-sumi-mute">{hint}</p>}
    </div>
  );
}

/** 参拝達成率のドーナツ表示 */
export function ProgressRing({
  value,
  size = 132,
  stroke = 10,
  label = "達成率",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ece4d3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c2453a" />
            <stop offset="60%" stopColor="#a8322a" />
            <stop offset="100%" stopColor="#a8894f" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mincho text-[1.55rem] font-semibold leading-none text-shu">
          {clamped.toFixed(1)}
          <span className="text-[0.7rem] font-normal">%</span>
        </span>
        <span className="mt-1 text-[0.66rem] tracking-wider text-sumi-mute">{label}</span>
      </div>
    </div>
  );
}

/** 実績バッジ */
export function AchievementBadge({
  achievement,
  compact = false,
}: {
  achievement: AchievementProgress;
  compact?: boolean;
}) {
  const unlocked = achievement.unlocked;
  return (
    <div
      className={`relative flex min-h-[104px] flex-col items-center justify-start gap-1.5 rounded-xl border px-1.5 py-3 text-center transition-colors ${
        unlocked
          ? achievement.premium
            ? "border-kin/50 bg-[linear-gradient(160deg,#fdf8ec,#f6ecd6)]"
            : "border-washi-line bg-paper"
          : "border-dashed border-washi-line bg-transparent"
      }`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] font-mincho text-[1.1rem] ${
          unlocked
            ? achievement.premium
              ? "border-kin bg-[radial-gradient(circle_at_30%_25%,#c2453a,#8f261f)] text-kin-soft"
              : "border-shu/70 bg-[radial-gradient(circle_at_30%_25%,#c2453a,#8f261f)] text-[#ffe9d8]"
            : "border-washi-line bg-washi-deep/40 text-sumi-mute"
        }`}
      >
        {achievement.mark}
      </div>
      <p
        className={`w-full text-[0.68rem] font-bold leading-[1.25] break-words ${unlocked ? "text-sumi" : "text-sumi-mute"}`}
      >
        {achievement.name}
      </p>
      {!compact && (
        <p className="text-[0.64rem] leading-tight text-sumi-mute">
          {unlocked ? "達成" : `あと${achievement.remaining}`}
        </p>
      )}
      {unlocked && (
        <span className="absolute right-1 top-1 text-[0.6rem] text-kin" aria-label="達成済み">
          ✓
        </span>
      )}
    </div>
  );
}
