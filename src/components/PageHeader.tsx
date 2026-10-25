"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  backHref,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="bg-mokume relative overflow-hidden pt-safe text-washi">
      {/* 金箔の筋と御朱印風の円 */}
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-2 -top-4 h-24 w-24 rounded-full border border-white/10" />
      <div className="relative flex items-start gap-3 px-4 pt-4 pb-4">
        {backHref && (
          <Link
            href={backHref}
            className="mt-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl backdrop-blur"
            aria-label="戻る"
          >
            ‹
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-[0.62rem] tracking-[0.3em] text-kin-soft">{eyebrow}</p>}
          <h1 className="font-mincho text-[1.28rem] leading-tight font-semibold tracking-[0.06em]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-[0.8rem] leading-snug text-washi/80">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="relative h-[3px] bg-gradient-to-r from-shu-soft via-kin to-transparent" />
    </header>
  );
}
