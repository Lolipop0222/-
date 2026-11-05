"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import { kstToday } from "@/lib/dday";
import { SUBJECT_COLOR } from "@/lib/subjects";
import { usePlanner } from "@/lib/usePlanner";

/** 홈의 오늘 플래너 요약 — 완료 개수와 다음 과제 */
export default function HomePlanner() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setToday(kstToday()), 0);
    return () => clearTimeout(id);
  }, []);
  const p = usePlanner(today);
  const done = p.tasks.filter((t) => t.done).length;
  const next = p.tasks.find((t) => !t.done);

  return (
    <Link href="/planner" className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
        <ClipboardList size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">
          오늘의 플래너
          {p.tasks.length > 0 && (
            <span className="num ml-1.5 font-semibold text-text">
              {done}/{p.tasks.length} 완료
            </span>
          )}
        </p>
        {next ? (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[16px] font-bold">
            {next.subject && <span className="size-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[next.subject] }} />}
            <span className="truncate">{next.title}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-[16px] font-bold">{p.tasks.length > 0 ? "오늘 할 일 끝! 🎉" : "오늘 할 공부 적기"}</p>
        )}
      </div>
      <ChevronRight size={20} className="shrink-0 text-faint" />
    </Link>
  );
}
