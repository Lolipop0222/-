"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, Trophy } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { Badge, Card } from "@/components/ui";
import { hm, hms } from "@/lib/format";
import { getRanking, type RankRow } from "@/lib/study";
import { SUBJECTS, SUBJECT_COLOR } from "@/lib/subjects";

const DAILY_GOAL_SEC = 5 * 3600;

/** 홈의 공부 카드들 — 오늘 공부 시간(과목별), 이번 주 합계, 전교 순위 */
export default function HomeStudy() {
  const study = useStudy();
  const { todaySec, todayBySubject, weekSec, weekDays } = study.summary;
  const goalPct = Math.min(100, Math.round((todaySec / DAILY_GOAL_SEC) * 100));
  const studied = SUBJECTS.filter((s) => todayBySubject[s] >= 60);

  // 전교 순위 — 기록이 저장될 때마다 다시 읽는다
  const [rank, setRank] = useState<{ me: RankRow; ahead?: RankRow; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    getRanking("school", null).then(
      (rows) => {
        const i = rows.findIndex((r) => r.is_me);
        if (alive && i >= 0) setRank({ me: rows[i], ahead: rows.slice(0, i).reverse().find((r) => r.total_sec > rows[i].total_sec), total: rows.length });
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [study.version]);

  return (
    <>
      {/* 오늘 공부 */}
      <Card flush className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-muted">오늘 공부한 시간</p>
            <p className="num mt-1 text-[34px] font-bold leading-tight">{study.ready ? hm(todaySec) : "–"}</p>
          </div>
          <Badge tone="accent">목표 {goalPct}%</Badge>
        </div>

        {/* 과목별 비율 막대 (목표 5시간 기준) */}
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
          {SUBJECTS.map((s) => (
            <div key={s} style={{ width: `${(todayBySubject[s] / DAILY_GOAL_SEC) * 100}%`, background: SUBJECT_COLOR[s] }} />
          ))}
        </div>
        {studied.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {studied.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: SUBJECT_COLOR[s] }} />
                {s} <span className="num text-text">{hm(todayBySubject[s])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12px] text-faint">오늘은 아직 기록이 없어요</p>
        )}

        <Link
          href="/timer"
          className={`mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl text-[16px] font-bold active:scale-[0.98] ${
            study.running ? "bg-live-soft text-live" : "bg-accent text-bg"
          }`}
        >
          {study.running ? (
            <>
              <span className="live-dot size-2 rounded-full bg-live" />
              {study.running.subject} 공부 중 · <span className="num">{hms(study.elapsed)}</span>
            </>
          ) : (
            <>
              <Play size={18} fill="currentColor" />
              공부 시작
            </>
          )}
        </Link>
      </Card>

      {/* 이번 주 / 내 순위 */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[13px] text-muted">이번 주 합계</p>
          <p className="num mt-1 text-[20px] font-bold">{study.ready ? hm(weekSec) : "–"}</p>
          <WeekBars days={weekDays} />
        </Card>
        <Link href="/timer#ranking">
          <Card className="h-full">
            <p className="flex items-center gap-1 text-[13px] text-muted">
              <Trophy size={14} className="text-warn" /> 전교 순위
            </p>
            {rank ? (
              <>
                <p className="num mt-1 text-[20px] font-bold">
                  {rank.me.rank}
                  <span className="text-[14px] font-medium text-muted">위 / {rank.total}명</span>
                </p>
                <p className="mt-3 text-[12px] leading-snug text-muted">
                  {rank.ahead ? (
                    <>
                      앞사람과 <span className="font-semibold text-accent">{hm(rank.ahead.total_sec - rank.me.total_sec)}</span> 차이
                    </>
                  ) : rank.me.total_sec > 0 ? (
                    "지금 1등이에요!"
                  ) : (
                    "공부를 시작하면 순위에 올라가요"
                  )}
                </p>
              </>
            ) : (
              <p className="num mt-1 text-[20px] font-bold text-faint">–</p>
            )}
          </Card>
        </Link>
      </div>
    </>
  );
}

function WeekBars({ days }: { days: number[] }) {
  const max = Math.max(...days, 1);
  return (
    <div className="mt-3 flex h-8 items-end gap-1">
      {days.map((sec, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end">
          <div
            className={`w-full rounded-sm ${sec > 0 ? "bg-accent" : "bg-surface-2"}`}
            style={{ height: `${Math.max(8, (sec / max) * 100)}%`, opacity: sec > 0 ? 0.4 + (sec / max) * 0.6 : 1 }}
          />
        </div>
      ))}
    </div>
  );
}
