/**
 * 디데이 — 학교 시험(NEIS에서 자동)과 학생이 직접 만든 날(Supabase ddays 테이블).
 */
import { supabase } from "@/lib/supabase";

/** 학교 시험. 날짜는 "2026-12-14" (한국 날짜) */
export type Exam = { name: string; start: string; end: string; grades: number[] };
/** /api/exams 응답 */
export type ExamsResponse = { source: "neis" | "none"; exams: Exam[] };

/** 직접 만든 디데이 (ddays 테이블) */
export type CustomDday = { id: string; title: string; target_date: string };

/** 화면에 보여 줄 디데이 한 줄 */
export type DdayItem =
  | { kind: "exam"; key: string; title: string; date: string; end: string }
  | { kind: "custom"; key: string; title: string; date: string; id: string };

const KST = 9 * 3600_000;
const DAY = 86_400_000;

/** 오늘 (한국 날짜) "2026-11-05" */
export function kstToday(now = Date.now()): string {
  return new Date(now + KST).toISOString().slice(0, 10);
}

/** 오늘부터 그날까지 남은 날 수. 0이면 오늘, 음수면 지남 */
export function daysUntil(date: string, today = kstToday()): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY);
}

/** 12 → "D-12", 0 → "D-DAY", -3 → "D+3" */
export function ddayLabel(days: number): string {
  return days === 0 ? "D-DAY" : days > 0 ? `D-${days}` : `D+${-days}`;
}

/** 내 학년에 해당하는 시험만 (학년 정보가 없는 행사는 모두에게) */
export function examsForGrade(exams: Exam[], grade: number): Exam[] {
  return exams.filter((e) => e.grades.length === 0 || e.grades.includes(grade));
}

/** 시험 + 직접 만든 디데이를 날짜순으로. 진행 중인 시험(시작 지남, 끝 안 지남)은 남겨 둔다 */
export function mergeDdays(exams: Exam[], custom: CustomDday[], today = kstToday()): DdayItem[] {
  const items: DdayItem[] = [
    ...exams.map((e) => ({ kind: "exam" as const, key: `exam:${e.name}:${e.start}`, title: e.name, date: e.start, end: e.end })),
    ...custom.map((c) => ({ kind: "custom" as const, key: `custom:${c.id}`, title: c.title, date: c.target_date, id: c.id })),
  ];
  return items
    .filter((i) => (i.kind === "exam" ? i.end >= today : true))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

// ── 서버 호출 ──

export async function fetchExams(): Promise<ExamsResponse> {
  const res = await fetch("/api/exams");
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function listCustomDdays(): Promise<CustomDday[]> {
  const { data, error } = await supabase().from("ddays").select("id, title, target_date").order("target_date");
  if (error) throw error;
  return data as CustomDday[];
}

export async function addCustomDday(title: string, date: string): Promise<CustomDday> {
  const { data, error } = await supabase()
    .from("ddays")
    .insert({ title: title.trim(), target_date: date })
    .select("id, title, target_date")
    .single();
  if (error) throw error;
  return data as CustomDday;
}

export async function deleteCustomDday(id: string): Promise<void> {
  const { error } = await supabase().from("ddays").delete().eq("id", id);
  if (error) throw error;
}

/** ddays 테이블이 아직 없을 때 (supabase/schema.sql을 다시 실행하기 전) */
export function isMissingTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "PGRST205" || err?.code === "42P01" || /ddays/.test(err?.message ?? "") && /schema cache|does not exist/.test(err?.message ?? "");
}
