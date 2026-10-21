import Link from "next/link";
import { BookOpen, ChevronRight, Play, Trophy, Utensils } from "lucide-react";
import EventBanner from "@/components/EventBanner";
import TodayLabel from "@/components/TodayLabel";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { hm } from "@/lib/format";
import {
  SUBJECT_COLOR,
  assessments,
  myGroup,
  rankingAround,
  reviewToday,
  todayMeal,
  todayStudy,
  weekStudy,
} from "@/lib/mock";

export default function HomePage() {
  const { around } = rankingAround("전교");
  const myIdx = around.findIndex((r) => r.me);
  const mine = around[myIdx];
  const ahead = around[myIdx - 1];
  const goalPct = Math.min(100, Math.round((todayStudy.totalSec / todayStudy.goalSec) * 100));
  const studyingNow = myGroup.members.filter((m) => m.studying).length;

  return (
    <>
      <PageHeader title="대고 일품타" sub={<TodayLabel />} />

      <div className="space-y-4 px-5">
        {/* 오늘 급식 한 줄 */}
        <Link href="/calendar" className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <Utensils size={18} className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1 truncate text-[14px]">
            <span className="mr-2 font-semibold text-muted">점심</span>
            {todayMeal.lunch.slice(1, 4).join(" · ")}
          </p>
          <ChevronRight size={16} className="shrink-0 text-faint" />
        </Link>

        <EventBanner />

        {/* 오늘 공부 */}
        <Card flush className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-muted">오늘 공부한 시간</p>
              <p className="num mt-1 text-[34px] font-bold leading-tight">{hm(todayStudy.totalSec)}</p>
            </div>
            <Badge tone="accent">목표 {goalPct}%</Badge>
          </div>

          {/* 과목별 비율 막대 */}
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            {todayStudy.bySubject.map((s) => (
              <div
                key={s.subject}
                style={{ width: `${(s.sec / todayStudy.goalSec) * 100}%`, background: SUBJECT_COLOR[s.subject] }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {todayStudy.bySubject.map((s) => (
              <li key={s.subject} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: SUBJECT_COLOR[s.subject] }} />
                {s.subject} <span className="num text-text">{hm(s.sec)}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/timer"
            className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-bold text-bg active:scale-[0.98]"
          >
            <Play size={18} fill="currentColor" />
            공부 시작
          </Link>
        </Card>

        {/* 이번 주 / 내 순위 */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-[13px] text-muted">이번 주 합계</p>
            <p className="num mt-1 text-[20px] font-bold">{hm(weekStudy.totalSec)}</p>
            <WeekBars days={weekStudy.days} />
          </Card>
          <Link href="/timer#ranking">
            <Card className="h-full">
              <p className="flex items-center gap-1 text-[13px] text-muted">
                <Trophy size={14} className="text-warn" /> 전교 순위
              </p>
              <p className="num mt-1 text-[20px] font-bold">
                {mine.rank}
                <span className="text-[14px] font-medium text-muted">위</span>
              </p>
              {ahead && (
                <p className="mt-3 text-[12px] leading-snug text-muted">
                  앞사람과 <span className="font-semibold text-accent">{hm(ahead.totalSec - mine.totalSec)}</span> 차이
                </p>
              )}
            </Card>
          </Link>
        </div>

        {/* 오늘 복습할 단어 */}
        <Link href="/words/review" className="block">
          <Card className="flex items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-live-soft text-live">
              <BookOpen size={22} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-muted">워마 · 쉬는 시간 10분이면 끝</p>
              <p className="text-[17px] font-bold">
                오늘 복습할 단어 <span className="num text-live">{reviewToday}개</span>
              </p>
            </div>
            <ChevronRight size={20} className="text-faint" />
          </Card>
        </Link>

        {/* 스터디그룹 */}
        <Card>
          <SectionTitle href="/me" action="그룹">
            {myGroup.name}
          </SectionTitle>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {myGroup.members.slice(0, 5).map((m) => (
                <span
                  key={m.nickname}
                  className="relative grid size-8 place-items-center rounded-full border-2 border-surface bg-surface-2 text-[12px] font-semibold"
                >
                  {m.nickname[0]}
                  {m.studying && <span className="live-dot absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-live" />}
                </span>
              ))}
            </div>
            <p className="text-[13px] text-muted">
              지금 <span className="font-semibold text-live">{studyingNow}명</span> 공부 중
            </p>
          </div>
        </Card>

        {/* 수행평가 */}
        <Card>
          <SectionTitle href="/calendar">다가오는 수행평가</SectionTitle>
          <ul className="space-y-3">
            {assessments.slice(0, 2).map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <span className="size-2 rounded-full" style={{ background: SUBJECT_COLOR[a.subject] }} />
                <span className="flex-1 text-[14px]">
                  <span className="text-muted">{a.subject}</span> {a.title}
                </span>
                <span className="num text-[13px] text-muted">{a.date.slice(5).replace("-", "/")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function WeekBars({ days }: { days: number[] }) {
  const max = Math.max(...days, 1);
  return (
    <div className="mt-3 flex h-8 items-end gap-1">
      {days.map((h, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end">
          <div
            className={`w-full rounded-sm ${h > 0 ? "bg-accent" : "bg-surface-2"}`}
            style={{ height: `${Math.max(8, (h / max) * 100)}%`, opacity: h > 0 ? 0.4 + (h / max) * 0.6 : 1 }}
          />
        </div>
      ))}
    </div>
  );
}
