/**
 * 공부 통계 계산 (2026-11-22). 화면은 app/stats/page.tsx, 그래프는 components/stats/*.
 * 기준은 순위·레벨과 같다: 끝난 기록, 기타·인강 제외, 한 기록 1초~4시간. 날짜·요일·시각은 한국 시간, 기록은 시작한 날에 센다.
 * 모두 순수 함수 — 서버에 따로 저장하지 않는다(내 기록만 RLS로 읽어서 브라우저에서 계산).
 */

import { RANKED_SUBJECTS, type RankedSubject } from "@/lib/subjects";
import { isCounted, type StudySession } from "@/lib/study";

const KST = 9 * 3600_000;
const DAY = 24 * 3600_000;
const MAX_SEC = 4 * 3600;

/** 한국 날짜 번호 (1970-01-01부터 며칠째) */
export const kstDayNo = (t: number) => Math.floor((t + KST) / DAY);
/** 날짜 번호 → 그날 0시(한국)의 ms */
export const dayNoStart = (d: number) => d * DAY - KST;
/** 날짜 번호 → 요일 0=월 … 6=일 */
export const weekdayOf = (d: number) => (d + 3) % 7; // 1970-01-01은 목요일
export const dayLabel = (d: number) => {
  const x = new Date(d * DAY);
  return `${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
};
export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** manual = 직접 입력 (집중도 계산에서 뺀다 — 앱을 켜 두지 않았으니) */
export type Rec = { subject: RankedSubject; start: number; sec: number; day: number; away: number; manual: boolean };
export type LectureRec = { sec: number; day: number };

/** 통계에 쓰는 기록만 남긴다 (끝난 것, 순위 기준). 인강은 따로 (보조 표시용) */
export function toRecords(sessions: StudySession[]): { recs: Rec[]; lectures: LectureRec[] } {
  const recs: Rec[] = [];
  const lectures: LectureRec[] = [];
  for (const s of sessions) {
    if (!s.ended_at) continue;
    const sec = s.duration ?? 0;
    if (sec < 1 || sec > MAX_SEC) continue;
    const start = Date.parse(s.started_at);
    if (s.lecture && s.subject !== "기타") lectures.push({ sec, day: kstDayNo(start) });
    if (!isCounted(s)) continue;
    recs.push({ subject: s.subject as RankedSubject, start, sec, day: kstDayNo(start), away: s.away_count ?? 0, manual: !!s.manual });
  }
  return { recs, lectures };
}

export type BySubject = Record<RankedSubject, number>;
export const zeroSubjects = (): BySubject => Object.fromEntries(RANKED_SUBJECTS.map((s) => [s, 0])) as BySubject;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type DayStat = { day: number; total: number; by: BySubject };

/** 날짜별 합계 (from~to 날짜 번호, 빈 날도 0으로) */
export function dailySeries(recs: Rec[], from: number, to: number): DayStat[] {
  const map = new Map<number, DayStat>();
  for (let d = from; d <= to; d++) map.set(d, { day: d, total: 0, by: zeroSubjects() });
  for (const r of recs) {
    const x = map.get(r.day);
    if (!x) continue;
    x.total += r.sec;
    x.by[r.subject] += r.sec;
  }
  return [...map.values()];
}

/** 기록 방식별 날짜 합계 — 타이머 / 직접 입력 (2026-11-22, 전자기기 금지 야자용 직접 입력이 생겨서) */
export type SourceDay = { day: number; timer: number; manual: number };
export function sourceSeries(recs: Rec[], from: number, to: number): SourceDay[] {
  const map = new Map<number, SourceDay>();
  for (let d = from; d <= to; d++) map.set(d, { day: d, timer: 0, manual: 0 });
  for (const r of recs) {
    const x = map.get(r.day);
    if (x) x[r.manual ? "manual" : "timer"] += r.sec;
  }
  return [...map.values()];
}

/** 연속 공부(하루 30분 이상) — 최장, 지금(오늘 또는 어제까지 이어진) */
export function streaks(days: DayStat[], today: number): { best: number; current: number } {
  const ok = new Set(days.filter((d) => d.total >= 1800).map((d) => d.day));
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = ok.has(d.day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let current = 0;
  let d = ok.has(today) ? today : today - 1;
  while (ok.has(d)) {
    current++;
    d--;
  }
  return { best, current };
}

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = sum(xs) / xs.length;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / xs.length);
};

export type Summary = {
  total: number;
  prevTotal: number;
  /** 지난 기간 대비 % (지난 기간이 0이면 null) */
  change: number | null;
  avgPerDay: number;
  activeDays: number;
  periodDays: number;
  best: DayStat | null;
  medianActive: number;
  /** 꾸준함 0~100 — 공부한 날의 하루 시간 변동계수(표준편차/평균)가 작을수록, 공부한 날이 많을수록 높다 */
  consistency: number;
  sessions: number;
  avgSession: number;
  longest: Rec | null;
  /** 한 번도 앱을 벗어나지 않은 기록 비율 0~1 (타이머 기록만) */
  focusRate: number;
  /** 그중 직접 입력한 시간·개수 */
  manualSec: number;
  manualCount: number;
  streak: { best: number; current: number };
  lectureSec: number;
};

export function summarize(recs: Rec[], prevRecs: Rec[], days: DayStat[], today: number, lectures: LectureRec[]): Summary {
  const total = sum(recs.map((r) => r.sec));
  const timer = recs.filter((r) => !r.manual);
  const prevTotal = sum(prevRecs.map((r) => r.sec));
  const active = days.filter((d) => d.total > 0);
  const activeSecs = active.map((d) => d.total);
  const mean = activeSecs.length ? sum(activeSecs) / activeSecs.length : 0;
  const cv = mean > 0 ? stdev(activeSecs) / mean : 1;
  const coverage = days.length ? active.length / days.length : 0;
  const consistency = active.length ? Math.round(100 * (0.6 * coverage + 0.4 * Math.max(0, 1 - cv))) : 0;
  return {
    total,
    prevTotal,
    change: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
    avgPerDay: days.length ? total / days.length : 0,
    activeDays: active.length,
    periodDays: days.length,
    best: active.length ? active.reduce((a, b) => (b.total > a.total ? b : a)) : null,
    medianActive: median(activeSecs),
    consistency,
    sessions: recs.length,
    avgSession: recs.length ? total / recs.length : 0,
    longest: recs.length ? recs.reduce((a, b) => (b.sec > a.sec ? b : a)) : null,
    focusRate: timer.length ? timer.filter((r) => r.away === 0).length / timer.length : 0,
    manualSec: sum(recs.filter((r) => r.manual).map((r) => r.sec)),
    manualCount: recs.length - timer.length,
    streak: streaks(days, today),
    lectureSec: sum(lectures.map((l) => l.sec)),
  };
}

export function subjectTotals(recs: Rec[]): BySubject {
  const by = zeroSubjects();
  for (const r of recs) by[r.subject] += r.sec;
  return by;
}

/** 요일별 평균 (그 요일이 기간에 몇 번 있었는지로 나눔) */
export function weekdayAverages(days: DayStat[]): number[] {
  const tot = [0, 0, 0, 0, 0, 0, 0];
  const cnt = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) {
    const w = weekdayOf(d.day);
    tot[w] += d.total;
    cnt[w]++;
  }
  return tot.map((t, i) => (cnt[i] ? t / cnt[i] : 0));
}

/** 시간대별 합계 0~23시 (한 기록이 여러 시간에 걸치면 나눠 담는다) */
export function hourly(recs: Rec[]): number[] {
  const h = new Array<number>(24).fill(0);
  for (const r of recs) {
    let t = r.start;
    const end = r.start + r.sec * 1000;
    while (t < end) {
      const k = t + KST;
      const hour = Math.floor((k % DAY) / 3600_000);
      const next = Math.min(end, t + (3600_000 - (k % 3600_000)));
      h[hour] += (next - t) / 1000;
      t = next;
    }
  }
  return h;
}

/** 주별 합계 (월요일 시작), 최근 n주 + 4주 이동 평균 */
export function weeklyTrend(recs: Rec[], today: number, n: number): { week: number; total: number; avg4: number | null }[] {
  const thisMonday = today - weekdayOf(today);
  const weeks = Array.from({ length: n }, (_, i) => thisMonday - (n - 1 - i) * 7);
  const tot = new Map(weeks.map((w) => [w, 0]));
  for (const r of recs) {
    const w = r.day - weekdayOf(r.day);
    if (tot.has(w)) tot.set(w, tot.get(w)! + r.sec);
  }
  const vals = weeks.map((w) => tot.get(w)!);
  return weeks.map((w, i) => ({ week: w, total: vals[i], avg4: i >= 3 ? sum(vals.slice(i - 3, i + 1)) / 4 : null }));
}

export const LENGTH_BINS = [
  { label: "~15분", max: 15 * 60 },
  { label: "15~30", max: 30 * 60 },
  { label: "30~60", max: 60 * 60 },
  { label: "1~1.5시간", max: 90 * 60 },
  { label: "1.5~2", max: 120 * 60 },
  { label: "2~3", max: 180 * 60 },
  { label: "3~4", max: 240 * 60 },
] as const;

/** 한 번에 공부한 길이 분포 */
export function lengthHistogram(recs: Rec[]): number[] {
  const out = LENGTH_BINS.map(() => 0);
  for (const r of recs) {
    const i = LENGTH_BINS.findIndex((b) => r.sec <= b.max);
    out[i < 0 ? out.length - 1 : i]++;
  }
  return out;
}

/** 시간대 성향 한 마디 */
export function chronotype(h: number[]): string {
  const part = (a: number, b: number) => sum(h.slice(a, b));
  const parts: [string, number][] = [
    ["새벽형 (0~6시)", part(0, 6)],
    ["아침형 (6~12시)", part(6, 12)],
    ["오후형 (12~18시)", part(12, 18)],
    ["저녁형 (18~24시)", part(18, 24)],
  ];
  const total = sum(h);
  if (!total) return "-";
  return parts.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/** 처음 시작한 시각의 평균 (공부한 날마다 첫 기록, 분 단위 0~1439) */
export function avgFirstStart(recs: Rec[]): number | null {
  const first = new Map<number, number>();
  for (const r of recs) {
    const m = Math.floor(((r.start + KST) % DAY) / 60_000);
    if (!first.has(r.day) || m < first.get(r.day)!) first.set(r.day, m);
  }
  const xs = [...first.values()];
  return xs.length ? sum(xs) / xs.length : null;
}

/** 초 → "3시간 12분" / "45분" */
export function hmText(sec: number): string {
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  if (!h) return `${m}분`;
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}
/** 초 → "3.2h" (그래프 눈금용) */
export const hShort = (sec: number) => {
  const h = sec / 3600;
  return h >= 10 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`;
};
