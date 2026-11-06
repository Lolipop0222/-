"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { useProfile } from "@/components/AuthProvider";
import { Card } from "@/components/ui";
import { dayStats, dueIds, nextDay, useWordStore } from "@/lib/wordProgress";

/** 홈 → 워마: 오늘 복습할 단어 수 (없으면 다음에 외울 DAY) */
export default function HomeWords() {
  const profile = useProfile();
  const store = useWordStore(profile.id);
  const ready = store.status === "ready";
  const due = ready ? dueIds(store).length : 0;
  const day = ready ? nextDay(dayStats(store)) : 1;
  const href = due ? "/words/review" : ready ? `/words/day/${day}` : "/words";
  return (
    <Link href={href} className="block">
      <Card className="flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-live-soft text-live">
          <BookOpen size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">워마 · 쉬는 시간 10분이면 끝</p>
          <p className="text-[17px] font-bold">
            {!ready ? (
              "오늘 복습할 단어"
            ) : due ? (
              <>
                오늘 복습할 단어 <span className="num text-live">{due}개</span>
              </>
            ) : store.progress.size ? (
              <>
                오늘 복습 끝 · <span className="text-accent">DAY {day} 외우기</span>
              </>
            ) : (
              <>
                첫 단어 외우기 · <span className="text-accent">DAY {day}</span>
              </>
            )}
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-faint" />
      </Card>
    </Link>
  );
}
