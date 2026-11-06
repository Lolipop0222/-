"use client";

import { supabase } from "@/lib/supabase";
import { ETC, SUBJECTS, normalizeSubject, type RankedSubject, type Subject } from "@/lib/subjects";

/** sessions 테이블 한 행 (supabase/schema.sql) */
export type StudySession = {
  id: string;
  subject: Subject;
  started_at: string;
  ended_at: string | null;
  away_count: number;
  duration: number | null;
  /** 플래너 과제와 연결된 기록이면 그 과제 id */
  task_id: string | null;
  /** 기타 기록 이름 (예: 독서) */
  label: string | null;
  /** 세부 항목 (예: 미적분Ⅰ) */
  detail: string | null;
  /** 인강 — TIMETABLE에는 보이지만 공부 합계·순위에서 빠진다 */
  lecture: boolean;
};

/** 공부 합계·순위에 들어가는 기록인지 (기타·인강 제외 — 서버 규칙과 같게) */
export const isCounted = (s: Pick<StudySession, "subject" | "lecture">) => s.subject !== ETC && !s.lecture;

// supabase/schema.sql을 다시 실행하기 전 DB에는 뒤쪽 열이 없을 수 있다 → 앞에서부터 차례로 시도한다
const COLUMN_SETS = [
  "id, subject, started_at, ended_at, away_count, duration, task_id, label, detail, lecture",
  "id, subject, started_at, ended_at, away_count, duration, task_id, label",
  "id, subject, started_at, ended_at, away_count, duration, task_id",
  "id, subject, started_at, ended_at, away_count, duration",
];

type PgError = { code?: string } | null;
const isMissingColumn = (e: PgError) => e?.code === "42703";
const isMissingFunction = (e: PgError) => e?.code === "PGRST202";

/** task_id 열이 없는 예전 DB면 task_id 없이 다시 읽는다 */
async function selectSessions(build: (cols: string) => PromiseLike<{ data: unknown; error: PgError }>): Promise<StudySession[]> {
  let res = await build(COLUMN_SETS[0]);
  for (const cols of COLUMN_SETS.slice(1)) if (isMissingColumn(res.error)) res = await build(cols);
  if (res.error) throw res.error;
  return (res.data as StudySession[]).map(normalizeSession);
}

/** 예전 DB 값 정리: 열이 없으면 기본값, '한국사'→'역사', 옛 '인강' 과목→기타(이름 '인강') */
function normalizeSession(s: StudySession): StudySession {
  const raw = s.subject as string;
  return {
    ...s,
    subject: normalizeSubject(raw) ?? ETC,
    task_id: s.task_id ?? null,
    label: s.label ?? (raw === "인강" ? "인강" : null),
    detail: s.detail ?? (raw === "한국사" ? "한국사" : null),
    lecture: !!s.lecture,
  };
}

export type RankScope = "school" | "grade" | "class";
export type RankRow = {
  rank: number;
  nickname: string;
  grade: number;
  class_no: number;
  total_sec: number;
  studying: boolean;
  is_me: boolean;
  /** 칭호 기능(schema.sql)을 실행한 DB에서만 온다 */
  avatar?: string | null;
  title_name?: string | null;
  title_grade?: string | null;
};

const MAX_SESSION_SEC = 4 * 3600; // 이보다 긴 세션은 합계에서 빠진다 (서버 규칙과 같게)

// ── 한국 시간 기준 날짜 경계 (UTC+9, 서머타임 없음) ──

const KST = 9 * 3600_000;
const DAY = 24 * 3600_000;

export function kstDayStart(t: number): number {
  return Math.floor((t + KST) / DAY) * DAY - KST;
}

/** 이번 주 월요일 0시 (한국 시간) — 순위가 초기화되는 시각 */
export function kstWeekStart(t: number): number {
  const day = kstDayStart(t);
  const dow = new Date(day + KST).getUTCDay(); // 0=일 … 6=토
  return day - ((dow + 6) % 7) * DAY;
}

// ── 서버 호출 ──

export type StartOptions = { taskId?: string | null; detail?: string | null; lecture?: boolean };

export async function startSession(subject: Subject, opts: StartOptions = {}): Promise<StudySession> {
  const sb = supabase();
  const taskId = opts.taskId ?? null;
  let { data, error } = await sb.rpc("start_session", {
    p_subject: subject,
    p_task_id: taskId,
    p_detail: opts.detail ?? null,
    p_lecture: !!opts.lecture,
  });
  // 06-subjects.sql을 실행하기 전 DB: 세부 항목·인강 없이 예전 방식으로 (과목 이름도 예전 것으로)
  if (isMissingFunction(error)) {
    const legacy = subject === "역사" ? "한국사" : subject;
    ({ data, error } = await sb.rpc("start_session", { p_subject: legacy, p_task_id: taskId }));
    // 그보다 더 예전 DB(과목만 받는 start_session)면 과제 없이
    if (isMissingFunction(error) && !taskId) ({ data, error } = await sb.rpc("start_session", { p_subject: legacy }));
  }
  if (error) throw error;
  return normalizeSession(data as StudySession);
}

/** endAt: 앱을 벗어난 순간처럼 지금보다 이른 종료 시각 (서버는 줄이는 쪽으로만 반영) */
export async function endSession(id: string, awayCount: number, endAt?: number): Promise<StudySession> {
  const { data, error } = await supabase().rpc("end_session", {
    p_session_id: id,
    p_away_count: awayCount,
    p_end_at: endAt ? new Date(endAt).toISOString() : null,
  });
  if (error) throw error;
  return normalizeSession(data as StudySession);
}

/** 이번 주 내 기록 (RLS로 내 것만 온다) */
export async function loadWeekSessions(now: number): Promise<StudySession[]> {
  return selectSessions((cols) =>
    supabase().from("sessions").select(cols).gte("started_at", new Date(kstWeekStart(now)).toISOString()).order("started_at"),
  );
}

/**
 * 하루(한국 날짜 0시~24시)에 걸친 내 기록. 플래너의 TIMETABLE·과제별 시간에 쓴다.
 * 전날 밤에 시작해 자정을 넘긴 세션도 칸을 칠할 수 있게 4시간 앞부터 가져온다.
 */
export async function loadDaySessions(dayStart: number): Promise<StudySession[]> {
  return selectSessions((cols) =>
    supabase()
      .from("sessions")
      .select(cols)
      .gte("started_at", new Date(dayStart - MAX_SESSION_SEC * 1000).toISOString())
      .lt("started_at", new Date(dayStart + DAY).toISOString())
      .order("started_at"),
  );
}

/**
 * 세션의 실제 초 (진행 중이면 지금까지).
 * 공부 과목은 4시간 넘으면 0 — 서버 합계 규칙과 같게. 기타는 순위와 상관없으니 하루(24시간)까지 센다.
 */
export function sessionSeconds(s: StudySession, now: number): number {
  const sec = s.ended_at ? (s.duration ?? 0) : Math.floor((now - Date.parse(s.started_at)) / 1000);
  const max = s.subject === ETC ? 24 * 3600 : MAX_SESSION_SEC;
  return sec >= 1 && sec <= max ? sec : 0;
}

// ── 기타 기록 (나만 보고 직접 고칠 수 있다. 순위에는 안 들어간다) ──

export async function loadEtcSessions(sinceDays = 30): Promise<StudySession[]> {
  const since = new Date(Date.now() - sinceDays * DAY).toISOString();
  return selectSessions((cols) =>
    supabase().from("sessions").select(cols).eq("subject", ETC).gte("started_at", since).order("started_at", { ascending: false }),
  );
}

export async function addEtcSession(label: string, startedAt: number, endedAt: number): Promise<void> {
  const { error } = await supabase()
    .from("sessions")
    .insert({ subject: ETC, label: label.trim() || null, started_at: new Date(startedAt).toISOString(), ended_at: new Date(endedAt).toISOString() });
  if (error) throw error;
}

export async function updateEtcSession(id: string, patch: { label?: string | null; started_at?: string; ended_at?: string }): Promise<void> {
  const { error } = await supabase().from("sessions").update(patch).eq("id", id).eq("subject", ETC);
  if (error) throw error;
}

export async function deleteEtcSession(id: string): Promise<void> {
  const { error } = await supabase().from("sessions").delete().eq("id", id).eq("subject", ETC);
  if (error) throw error;
}

export async function getRanking(scope: RankScope, subject: RankedSubject | null): Promise<RankRow[]> {
  const { data, error } = await supabase().rpc("get_ranking", { p_scope: scope, p_subject: subject });
  if (error) throw error;
  return (data as RankRow[]).map((r) => ({ ...r, rank: Number(r.rank), total_sec: Number(r.total_sec) }));
}

// ── 합계 ──

export type StudySummary = {
  /** 공부 과목 합계 (기타·인강 제외) */
  todaySec: number;
  weekSec: number;
  /** 기타 타이머 합계 (순위·공부 합계와 따로) */
  todayEtcSec: number;
  weekEtcSec: number;
  /** 인강 합계 (공부 합계와 따로) */
  todayLectureSec: number;
  weekLectureSec: number;
  /** 과목별 공부 시간 (인강 제외). 기타 칸은 기타 합계 */
  todayBySubject: Record<Subject, number>;
  weekBySubject: Record<Subject, number>;
  /** 월~일 하루별 초 (기타 제외) */
  weekDays: number[];
};

const emptyBySubject = () => Object.fromEntries(SUBJECTS.map((s) => [s, 0])) as Record<Subject, number>;

/**
 * 이번 주 기록을 오늘/이번 주, 과목별로 더한다. 진행 중인 세션은 지금까지의 시간을 더한다.
 * 세션은 시작한 날에 넣는다 (서버의 순위 계산과 같은 기준).
 */
export function summarize(sessions: StudySession[], now: number): StudySummary {
  const dayStart = kstDayStart(now);
  const weekStart = kstWeekStart(now);
  const out: StudySummary = {
    todaySec: 0,
    weekSec: 0,
    todayEtcSec: 0,
    weekEtcSec: 0,
    todayLectureSec: 0,
    weekLectureSec: 0,
    todayBySubject: emptyBySubject(),
    weekBySubject: emptyBySubject(),
    weekDays: [0, 0, 0, 0, 0, 0, 0],
  };
  for (const s of sessions) {
    const start = Date.parse(s.started_at);
    const sec = sessionSeconds(s, now);
    if (start < weekStart || sec === 0) continue;
    const today = start >= dayStart;
    if (s.lecture) {
      // 인강은 TIMETABLE에만 보이고 공부 합계·과목별 시간에는 넣지 않는다
      out.weekLectureSec += sec;
      if (today) out.todayLectureSec += sec;
      continue;
    }
    out.weekBySubject[s.subject] += sec;
    if (today) out.todayBySubject[s.subject] += sec;
    if (s.subject === ETC) {
      // 기타는 순위·공부 합계에 넣지 않는다
      out.weekEtcSec += sec;
      if (today) out.todayEtcSec += sec;
      continue;
    }
    out.weekSec += sec;
    out.weekDays[Math.min(6, Math.floor((kstDayStart(start) - weekStart) / DAY))] += sec;
    if (today) out.todaySec += sec;
  }
  return out;
}
