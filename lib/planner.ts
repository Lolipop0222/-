/**
 * 플래너 — 그날의 과제(TASKS), 데일리 루틴, COMMENT/MEMO, TIMETABLE.
 * 테이블은 supabase/schema.sql의 tasks · routines · planner_days. 모두 RLS로 내 것만 읽고 쓴다.
 */
import { supabase } from "@/lib/supabase";
import { isCounted, sessionSeconds, type StudySession } from "@/lib/study";
import { normalizeSubject, type Subject } from "@/lib/subjects";

export type Task = {
  id: string;
  task_date: string; // "2026-11-05"
  title: string;
  subject: Subject | null;
  /** 세부 항목 (예: 미적분Ⅰ) */
  detail: string | null;
  /** 인강 — 이 과제로 잰 시간은 TIMETABLE에만 보이고 공부 합계에서 빠진다 */
  lecture: boolean;
  done: boolean;
  routine_id: string | null;
};

export type TaskExtra = { detail?: string | null; lecture?: boolean };
export type TaskPatch = Partial<Pick<Task, "title" | "subject" | "done" | "detail" | "lecture">>;

export type Routine = { id: string; title: string; subject: Subject | null; weekdays: number[]; active: boolean };
export type PlannerDay = { comment: string; memo: string };

// 06-subjects 조각 전 DB에는 detail·lecture 열이 없다 → 없으면 예전 열로 다시
const TASK_COLS: string = "id, task_date, title, subject, detail, lecture, done, routine_id";
const TASK_COLS_OLD: string = "id, task_date, title, subject, done, routine_id";
const isMissingColumn = (e: unknown) => ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");

function normalizeTask(t: Task): Task {
  return { ...t, subject: normalizeSubject(t.subject), detail: t.detail ?? null, lecture: !!t.lecture };
}
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
  let res = await sb.from("tasks").select(TASK_COLS).eq("task_date", date).eq("skipped", false).order("created_at");
  if (isMissingColumn(res.error)) res = await sb.from("tasks").select(TASK_COLS_OLD).eq("task_date", date).eq("skipped", false).order("created_at");
  if (res.error) throw res.error;
  return (res.data as unknown as Task[]).map(normalizeTask);
}

export async function addTask(date: string, title: string, subject: Subject | null, extra: TaskExtra = {}): Promise<Task> {
  const sb = supabase();
  const row = { task_date: date, title: title.trim(), subject, detail: extra.detail ?? null, lecture: !!extra.lecture && !!subject && subject !== "기타" };
  let res = await sb.from("tasks").insert(row).select(TASK_COLS).single();
  if (isMissingColumn(res.error)) {
    // 예전 DB: 세부 항목·인강 없이 저장 (과목 이름도 예전 것으로)
    res = await sb.from("tasks").insert({ task_date: date, title: row.title, subject: subject === "역사" ? "한국사" : subject }).select(TASK_COLS_OLD).single();
  }
  if (res.error) throw res.error;
  return normalizeTask(res.data as unknown as Task);
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const sb = supabase();
  let { error } = await sb.from("tasks").update(patch).eq("id", id);
  if (isMissingColumn(error)) {
    const { detail: _d, lecture: _l, ...old } = patch;
    void _d;
    void _l;
    if (Object.keys(old).length === 0) return;
    ({ error } = await sb.from("tasks").update(old).eq("id", id));
  }
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

/** 그날(0시~24시) 시작한 기록만 — 홈의 "오늘 공부"와 같은 기준 (TOTAL TIME은 기타 제외) */
function startedOn(s: StudySession, dayStart: number) {
  const t = Date.parse(s.started_at);
  return t >= dayStart && t < dayStart + DAY_MS;
}

/** TOTAL TIME: 공부 합계 (기타·인강 제외) */
export function totalSeconds(sessions: StudySession[], dayStart: number, now: number): number {
  return sessions.filter((s) => isCounted(s) && startedOn(s, dayStart)).reduce((sum, s) => sum + sessionSeconds(s, now), 0);
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

/** TIMETABLE 칸 하나에 채워지는 조각 — 10분 칸 안에서 공부한 구간만큼 (왼쪽 = 칸 시작 시각 기준) */
export type CellFill = { subject: Subject; lecture: boolean; left: number; width: number; live: boolean; key: string };

/**
 * 10분 칸마다 공부한 구간을 그대로 칠한다. [줄][칸 0~5] → 조각들 (left·width는 0~1).
 * 진행 중인 기록은 지금까지만 칠해져서, 시간이 흐르면 칸이 왼쪽부터 서서히 차오른다.
 * 인강은 빗금으로 (공부 합계에는 안 들어가지만 TIMETABLE에는 보인다). 기타도 보인다.
 */
export function timetableFills(sessions: StudySession[], dayStart: number, now: number): CellFill[][][] {
  const spans = sessions
    .filter((s) => sessionSeconds(s, now) > 0 || !s.ended_at)
    .map((s) => ({
      id: s.id,
      subject: s.subject,
      lecture: s.lecture,
      from: Date.parse(s.started_at),
      to: s.ended_at ? Date.parse(s.ended_at) : now,
      live: !s.ended_at,
    }))
    .filter((sp) => sp.to > sp.from);

  return TIMETABLE_HOURS.map((h) =>
    Array.from({ length: 6 }, (_, c) => {
      const cellFrom = dayStart + h * 3600_000 + c * CELL_MS;
      const cellTo = cellFrom + CELL_MS;
      const out: CellFill[] = [];
      for (const sp of spans) {
        const from = Math.max(cellFrom, sp.from);
        const to = Math.min(cellTo, sp.to);
        if (to <= from) continue;
        out.push({
          subject: sp.subject,
          lecture: sp.lecture,
          left: (from - cellFrom) / CELL_MS,
          width: (to - from) / CELL_MS,
          live: sp.live && to === now,
          key: sp.id,
        });
      }
      return out;
    }),
  );
}
