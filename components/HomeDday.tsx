"use client";

import Link from "next/link";
import { ChevronRight, Flag } from "lucide-react";
import { daysUntil, ddayLabel } from "@/lib/dday";
import { useDdays } from "@/lib/useDdays";

/** 홈 상단 디데이 — 가장 가까운 두 개 */
export default function HomeDday() {
  const d = useDdays();
  const next = d.items.filter((i) => i.kind === "exam" || daysUntil(i.date, d.today) >= 0).slice(0, 2);

  return (
    <Link href="/dday" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 active:bg-surface-2">
      <Flag size={18} className="shrink-0 text-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {!d.ready ? (
          <span className="text-[14px] text-faint">디데이</span>
        ) : next.length === 0 ? (
          <span className="text-[14px] text-muted">디데이를 추가해 보세요</span>
        ) : (
          next.map((i) => {
            const days = daysUntil(i.date, d.today);
            return (
              <span key={i.key} className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="truncate text-[14px]">{i.title}</span>
                <span className={`num shrink-0 text-[15px] font-bold ${days <= 0 ? "text-danger" : days <= 7 ? "text-warn" : "text-accent"}`}>
                  {days < 0 ? "시험 중" : ddayLabel(days)}
                </span>
              </span>
            );
          })
        )}
      </div>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </Link>
  );
}
