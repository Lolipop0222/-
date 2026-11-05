/**
 * 플래너 — 그날의 과제(TASKS), 데일리 루틴, COMMENT/MEMO, TIMETABLE.
 * 테이블은 supabase/schema.sql의 tasks · routines · planner_days. 모두 RLS로 내 것만 읽고 쓴다.
 */
import { supabase } from "@/lib/supabase";
import { sessionSeconds, type StudySession } from "@/lib/study";
import type { Subject } from "@/lib/subjects";

export type Task = {
  id: string;
  task_date: string; // "2026-11-05"
  title: string;
  subject: Subject | null;
  done: boolean;
  routine_id: string | null;
};

export type Routine = { id: string; title: string; subject: Subject | null; weekdays: number[]; active: boolean };
export type PlannerDay = { comment: string; memo: string };

const TASK_COLS = "id, task_date, title, subject, done, routine_id";
const DAY_MS = 86_400_000;

/** "2026-11-05" → 그날 0시(한국 시간)의 ms */
export function kstDateStart(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`);
}

export function addDays(date: string, n: number): string {
  return new Date(kstDateStart(date) + n * DAY_MS + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 플래너 테이블이 아직 없을 때 (supabase/schema.sql을 다시 실행하기 전) */
export function isPlannerMissing(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "PGRST202" || code === "42P01";
}

// ── 과제 ──

/** 그날 과제. 먼저 데일리 루틴을 그날 과제로 넣는다 (이미 있거나 그날만 지운 것은 건너뜀) */
export async function loadTasks(date: string): Promise<Task[]> {
  const sb = supabase();
  const m = await sb.rpc("materialize_routines", { p_date: date });
  if (m.error) throw m.error;
  const { data, error } = await sb.from("tasks").select(TASK_COLS).eq("task_date", date).eq("skipped", false).order("created_at");
  if (error) throw error;
  return data as Task[];
}

export async function addTask(date: string, title: string, subject: Subject | null): Promise<Task> {
  const { data, error } = await supabase().from("tasks").insert({ task_date: date, title: title.trim(), subject }).select(TASK_COLS).single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Pick<Task, "title" | "subject" | "done">>): Promise<void> {
  const { error } = await supabase().from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

/** 루틴에서 온 과제는 그날만 숨긴다 (지우면 다음에 플래너를 열 때 다시 생기므로) */
export async function removeTask(task: Task): Promise<void> {
  const q = supabase().from("tasks");
  const { error } = task.routine_id ? await q.update({ skipped: true }).eq("id", task.id) : await q.delete().eq("id", task.id);
  if (error) throw error;
}

// ── COMMENT / MEMO ──

export async function loadDay(date: string): Promise<PlannerDay> {
  const { data, error } = await supabase().from("planner_days").select("comment, memo").eq("day", date).maybeSingle();
  if (error) throw error;
  return { comment: data?.comment ?? "", memo: data?.memo ?? "" };
}

export async function saveDay(date: string, patch: Partial<PlannerDay>): Promise<void> {
  const { error } = await supabase().from("planner_days").upsert({ day: date, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id,day" });
  if (error) throw error;
}

// ── 데일리 루틴 ──

export async function listRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase().from("routines").select("id, title, subject, weekdays, active").order("created_at");
  if (error) throw error;
  return data as Routine[];
}

export async function addRoutine(title: string, subject: Subject | null, weekdays: number[]): Promise<Routine> {
  const { data, error } = await supabase()
    .from("routines")
    .insert({ title: title.trim(), subject, weekdays })
    .select("id, title, subject, weekdays, active")
    .single();
  if (error) throw error;
  return data as Routine;
}

export async function updateRoutine(id: string, patch: Partial<Omit<Routine, "id">>): Promise<void> {
  const { error } = await supabase().from("routines").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase().from("routines").delete().eq("id", id);
  if (error) throw error;
}

// ── 시간 계산 ──

/** 그날(0시~24시) 시작한 기록만 — 홈의 "오늘 공부"와 같은 기준 */
function startedOn(s: StudySession, dayStart: number) {
  const t = Date.parse(s.started_at);
  return t >= dayStart && t < dayStart + DAY_MS;
}

export function totalSeconds(sessions: StudySession[], dayStart: number, now: number): number {
  return sessions.filter((s) => startedOn(s, dayStart)).reduce((sum, s) => sum + sessionSeconds(s, now), 0);
}

/** 과제별 공부 시간 (taskId → 초) */
export function secondsByTask(sessions: StudySession[], dayStart: number, now: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessions) {
    if (s.task_id && startedOn(s, dayStart)) out.set(s.task_id, (out.get(s.task_id) ?? 0) + sessionSeconds(s, now));
  }
  return out;
}

/** TIMETABLE 줄 순서: 종이 플래너처럼 6시부터 다음 날 새벽 5시까지 (같은 날의 0~5시는 맨 아래) */
export const TIMETABLE_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
const CELL_MS = 10 * 60_000;

/**
 * 10분 칸마다 어느 과목으로 칠할지. [줄][칸 0~5] → 과목 또는 null.
 * 한 칸에서 5분 넘게 공부한 과목으로 칠한다 (여러 과목이면 가장 오래 한 것).
 */
export function timetableCells(sessions: StudySession[], dayStart: number, now: number): (Subject | null)[][] {
  const spans = sessions
    .filter((s) => sessionSeconds(s, now) > 0)
    .map((s) => ({ subject: s.subject, from: Date.parse(s.started_at), to: s.ended_at ? Date.parse(s.ended_at) : now }));

  return TIMETABLE_HOURS.map((h) =>
    Array.from({ length: 6 }, (_, c) => {
      const cellFrom = dayStart + h * 3600_000 + c * CELL_MS;
      const cellTo = cellFrom + CELL_MS;
      const bySubject = new Map<Subject, number>();
      for (const sp of spans) {
        const overlap = Math.min(cellTo, sp.to) - Math.max(cellFrom, sp.from);
        if (overlap > 0) bySubject.set(sp.subject, (bySubject.get(sp.subject) ?? 0) + overlap);
      }
      let best: Subject | null = null;
      let bestMs = CELL_MS / 2;
      for (const [subject, ms] of bySubject) if (ms > bestMs) [best, bestMs] = [subject, ms];
      return best;
    }),
  );
}
