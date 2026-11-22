"use client";

/**
 * 공부 통계 본문 (숫자 10개 + 그래프 8개). 내 통계(app/stats)와 관리자 학생 관리(app/me/admin/students)가 같이 쓴다.
 * 기록(StudySession[])만 주면 lib/stats.ts로 계산한다.
 */

import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { BalanceRadar, DailyStack, Heatmap, HourClock, LengthHistogram, SubjectDonut, WeekdayBars, WeeklyTrend } from "@/components/stats/Charts";
import { useChartTheme } from "@/lib/chartTheme";
import {
  WEEKDAYS,
  avgFirstStart,
  chronotype,
  dailySeries,
  dayLabel,
  hourly,
  hmText,
  lengthHistogram,
  subjectTotals,
  summarize,
  toRecords,
  weekdayAverages,
  weekdayOf,
  weeklyTrend,
  type Rec,
} from "@/lib/stats";
import type { StudySession } from "@/lib/study";
import { RANKED_SUBJECTS, SUBJECT_COLOR } from "@/lib/subjects";

/** 잔디 그림은 기간이 짧아도 최소 16주를 보여 준다 */
export const HEATMAP_MIN_DAYS = 16 * 7;

/** 기간 n일(오늘까지)의 통계 한 벌 */
export function buildView(today: number, sessions: StudySession[], n: number) {
  const from = today - n + 1;
  const { recs, lectures } = toRecords(sessions);
  const inP = (r: { day: number }) => r.day >= from && r.day <= today;
  const cur: Rec[] = recs.filter(inP);
  const prev = recs.filter((r) => r.day >= from - n && r.day < from);
  const days = dailySeries(recs, from, today);
  const hours = hourly(cur);
  return {
    n,
    days,
    heat: dailySeries(recs, Math.min(from, today - HEATMAP_MIN_DAYS + 1), today),
    sum: summarize(cur, prev, days, today, lectures.filter(inP)),
    by: subjectTotals(cur),
    wd: weekdayAverages(days),
    hours,
    chrono: chronotype(hours),
    firstStart: avgFirstStart(cur),
    trend: weeklyTrend(recs, today, n >= 365 ? 26 : 12),
    hist: lengthHistogram(cur),
  };
}
export type StatsViewData = ReturnType<typeof buildView>;

export function StatsBody({ v }: { v: StatsViewData }) {
  const t = useChartTheme();
  const s = v.sum;
  const bestWd = v.wd.indexOf(Math.max(...v.wd));
  const ranked = RANKED_SUBJECTS.filter((x) => v.by[x] > 0).sort((a, b) => v.by[b] - v.by[a]);
  const least = RANKED_SUBJECTS.slice().sort((a, b) => v.by[a] - v.by[b])[0];
  const fs = v.firstStart;
  return (
    <>
      {/* 숫자로 보기 */}
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label="총 공부" value={hmText(s.total)} hint={s.change === null ? "지난 기간 기록 없음" : `지난 ${v.n}일보다 ${s.change >= 0 ? "+" : ""}${Math.round(s.change)}%`} tone={s.change === null ? undefined : s.change >= 0 ? "up" : "down"} />
        <Kpi label="하루 평균" value={hmText(s.avgPerDay)} hint={`공부한 날만 보면 중앙값 ${hmText(s.medianActive)}`} />
        <Kpi label="공부한 날" value={`${s.activeDays}일`} hint={`${s.periodDays}일 중 ${Math.round((s.activeDays / s.periodDays) * 100)}%`} bar={s.activeDays / s.periodDays} />
        <Kpi label="꾸준함 점수" value={`${s.consistency}점`} hint="공부한 날 비율 + 하루 시간의 고른 정도" bar={s.consistency / 100} />
        <Kpi label="연속 공부" value={`${s.streak.current}일째`} hint={`이 기간 최장 ${s.streak.best}일 (하루 30분 이상)`} />
        <Kpi label="집중도" value={`${Math.round(s.focusRate * 100)}%`} hint="앱을 한 번도 안 벗어난 기록 비율" bar={s.focusRate} />
        <Kpi label="한 번 평균" value={hmText(s.avgSession)} hint={`기록 ${s.sessions}번`} />
        <Kpi label="최장 기록" value={s.longest ? hmText(s.longest.sec) : "-"} hint={s.longest ? `${dayLabel(s.longest.day)} · ${s.longest.subject}` : ""} />
        <Kpi label="최고의 날" value={s.best ? hmText(s.best.total) : "-"} hint={s.best ? `${dayLabel(s.best.day)} (${WEEKDAYS[weekdayOf(s.best.day)]})` : ""} />
        <Kpi label="평균 시작 시각" value={fs === null ? "-" : `${Math.floor(fs / 60)}:${String(Math.round(fs % 60)).padStart(2, "0")}`} hint={v.chrono} />
      </div>
      {s.lectureSec > 0 && <p className="px-1 text-[12px] text-faint">참고: 이 기간 인강 {hmText(s.lectureSec)} (위 통계에는 빠져 있어요)</p>}

      <ChartCard title={v.n > 62 ? "주별 공부 시간" : "날짜별 공부 시간"} note="막대는 과목별로 쌓았어요 · 점선은 평균">
        <DailyStack days={v.days} t={t} />
        <SubjectLegend />
      </ChartCard>

      <ChartCard title="과목 비율" note={ranked.length ? `가장 많이 한 과목은 ${ranked[0]} (${hmText(v.by[ranked[0]])})` : ""}>
        <SubjectDonut by={v.by} t={t} />
      </ChartCard>

      <ChartCard title="과목 균형" note={`가장 많이 한 과목을 바깥 끝(100%)으로 봐요 · 가장 적은 과목: ${least}`}>
        <BalanceRadar by={v.by} t={t} />
      </ChartCard>

      <ChartCard title="요일별 평균" note={v.wd[bestWd] > 0 ? `${WEEKDAYS[bestWd]}요일에 가장 많이 해요 (평균 ${hmText(v.wd[bestWd])})` : ""}>
        <WeekdayBars avgs={v.wd} t={t} />
      </ChartCard>

      <ChartCard title="하루 중 공부한 시간대" note="24시간 시계 · 바깥으로 길수록 그 시간에 많이 했어요">
        <HourClock hours={v.hours} t={t} center={v.chrono} />
      </ChartCard>

      <ChartCard title="공부 잔디" note="칸이 진할수록 많이 한 날 (공부한 날을 4등분)">
        <Heatmap days={v.heat} t={t} />
      </ChartCard>

      <ChartCard title="주별 추세" note="막대 = 그 주 합계 · 선 = 최근 4주 평균 (이동 평균)">
        <WeeklyTrend weeks={v.trend} t={t} />
      </ChartCard>

      <ChartCard title="한 번에 얼마나 공부하나요" note={`기록 ${s.sessions}번의 길이 분포 · 평균 ${hmText(s.avgSession)}`}>
        <LengthHistogram bins={v.hist} t={t} />
      </ChartCard>
    </>
  );
}

function Kpi({ label, value, hint, bar, tone }: { label: string; value: string; hint?: string; bar?: number; tone?: "up" | "down" }) {
  return (
    <Card flush className="min-w-0 p-3.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num mt-0.5 truncate text-[19px] font-bold">{value}</p>
      {bar !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.min(100, bar * 100))}%` }} />
        </div>
      )}
      {hint && <p className={`mt-1 line-clamp-2 text-[11px] leading-snug ${tone === "up" ? "text-live" : tone === "down" ? "text-danger" : "text-faint"}`}>{hint}</p>}
    </Card>
  );
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-[15px] font-bold">{title}</h2>
      {note && <p className="mb-2 mt-0.5 text-[12px] text-muted">{note}</p>}
      {children}
    </Card>
  );
}

function SubjectLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {RANKED_SUBJECTS.map((s) => (
        <span key={s} className="flex items-center gap-1 text-[11px] text-muted">
          <span className="size-2 rounded-sm" style={{ background: SUBJECT_COLOR[s] }} />
          {s}
        </span>
      ))}
    </div>
  );
}
