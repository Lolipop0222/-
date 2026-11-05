"use client";

import { supabase } from "@/lib/supabase";
import { SUBJECTS, type Subject } from "@/lib/subjects";

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
};

const SESSION_COLS = "id, subject, started_at, ended_at, away_count, duration, task_id";
// supabase/schema.sql을 다시 실행하기 전(플래너 이전) DB에는 task_id가 없다 → 그때는 이 목록으로 읽는다
const LEGACY_COLS = "id, subject, started_at, ended_at, away_count, duration";

type PgError = { code?: string } | null;
const isMissingColumn = (e: PgError) => e?.code === "42703";
const isMissingFunction = (e: PgError) => e?.code === "PGRST202";

/** task_id 열이 없는 예전 DB면 task_id 없이 다시 읽는다 */
async function selectSessions(build: (cols: string) => PromiseLike<{ data: unknown; error: PgError }>): Promise<StudySession[]> {
  let { data, error } = await build(SESSION_COLS);
  if (isMissingColumn(error)) ({ data, error } = await build(LEGACY_COLS));
  if (error) throw error;
  return (data as StudySession[]).map((s) => ({ ...s, task_id: s.task_id ?? null }));
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

export async function startSession(subject: Subject, taskId?: string | null): Promise<StudySession> {
  let { data, error } = await supabase().rpc("start_session", { p_subject: subject, p_task_id: taskId ?? null });
  // 예전 DB(과목만 받는 start_session)면 과제 없이 다시 — 과제 연결은 SQL을 다시 실행한 뒤부터
  if (isMissingFunction(error) && !taskId) ({ data, error } = await supabase().rpc("start_session", { p_subject: subject }));
  if (error) throw error;
  const row = data as StudySession;
  return { ...row, task_id: row.task_id ?? null };
}

/** endAt: 앱을 벗어난 순간처럼 지금보다 이른 종료 시각 (서버는 줄이는 쪽으로만 반영) */
export async function endSession(id: string, awayCount: number, endAt?: number): Promise<StudySession> {
  const { data, error } = await supabase().rpc("end_session", {
    p_session_id: id,
    p_away_count: awayCount,
    p_end_at: endAt ? new Date(endAt).toISOString() : null,
  });
  if (error) throw error;
  return data as StudySession;
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

/** 세션의 실제 공부 초 (진행 중이면 지금까지). 4시간 넘는 것은 0 — 서버 합계 규칙과 같게 */
export function sessionSeconds(s: StudySession, now: number): number {
  const sec = s.ended_at ? (s.duration ?? 0) : Math.floor((now - Date.parse(s.started_at)) / 1000);
  return sec >= 1 && sec <= MAX_SESSION_SEC ? sec : 0;
}

export async function getRanking(scope: RankScope, subject: Subject | null): Promise<RankRow[]> {
  const { data, error } = await supabase().rpc("get_ranking", { p_scope: scope, p_subject: subject });
  if (error) throw error;
  return (data as RankRow[]).map((r) => ({ ...r, rank: Number(r.rank), total_sec: Number(r.total_sec) }));
}

// ── 합계 ──

export type StudySummary = {
  todaySec: number;
  weekSec: number;
  todayBySubject: Record<Subject, number>;
  weekBySubject: Record<Subject, number>;
  /** 월~일 하루별 초 */
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
    todayBySubject: emptyBySubject(),
    weekBySubject: emptyBySubject(),
    weekDays: [0, 0, 0, 0, 0, 0, 0],
  };
  for (const s of sessions) {
    const start = Date.parse(s.started_at);
    const sec = s.ended_at ? (s.duration ?? 0) : Math.floor((now - start) / 1000);
    if (start < weekStart || sec < 1 || sec > MAX_SESSION_SEC) continue;
    out.weekSec += sec;
    out.weekBySubject[s.subject] += sec;
    out.weekDays[Math.min(6, Math.floor((kstDayStart(start) - weekStart) / DAY))] += sec;
    if (start >= dayStart) {
      out.todaySec += sec;
      out.todayBySubject[s.subject] += sec;
    }
  }
  return out;
}
