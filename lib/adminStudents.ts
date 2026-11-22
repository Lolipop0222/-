"use client";

/**
 * 관리자 학생 관리 (supabase/parts/10-admin-students.sql). 관리자가 아니면 DB 함수가 모두 거절한다(42501).
 * 이메일·비밀번호는 받지 않는다. 공부 시간은 순위와 같은 기준(기타·인강 제외, 한 기록 1초~4시간).
 */

import { supabase } from "@/lib/supabase";
import { ETC, normalizeSubject, type RankedSubject } from "@/lib/subjects";
import type { StudySession } from "@/lib/study";

export type AdminStudent = {
  nickname: string;
  grade: number;
  class_no: number;
  track: string | null;
  avatar: string | null;
  title_code: string | null;
  title_name: string | null;
  title_grade: string | null;
  name_frame: string | null;
  created_at: string;
  is_admin: boolean;
  level: number;
  total_sec: number;
  week_sec: number;
  today_sec: number;
  last_at: string | null;
  studying: boolean;
  words_learned: number;
};

export type AdminStudentDetail = {
  profile: {
    nickname: string;
    grade: number;
    class_no: number;
    track: string | null;
    avatar: string | null;
    title_code: string | null;
    title_name: string | null;
    title_grade: string | null;
    name_frame: string | null;
    created_at: string;
    is_admin: boolean;
  };
  xp: number;
  level: number;
  subjects: { subject: RankedSubject; sec: number; week_sec: number; level: number }[];
  etc_sec: number;
  lecture_sec: number;
  /** 공부 합계 중 직접 입력한 시간 (06·11 전 DB면 없음) */
  manual_sec?: number;
  session_count: number;
  first_at: string | null;
  last_at: string | null;
  live: { id: string; subject: string; detail: string | null; lecture: boolean; started_at: string } | null;
  titles: { code: string; name: string; grade: string; earned_at: string; revoked: boolean }[];
  groups: { name: string; owner: boolean; members: number }[];
  words: { learned: number; learning: number; due: number; last_at: string | null };
  quizzes: number;
  tasks_total: number;
  tasks_done: number;
  routines: number;
  ddays: number;
  inquiries: number;
  has_recovery_code: boolean;
};

const num = (v: unknown) => Number(v ?? 0);

export async function adminListStudents(): Promise<AdminStudent[]> {
  const { data, error } = await supabase().rpc("admin_list_students");
  if (error) throw error;
  return ((data ?? []) as AdminStudent[]).map((r) => ({
    ...r,
    level: num(r.level) || 1,
    total_sec: num(r.total_sec),
    week_sec: num(r.week_sec),
    today_sec: num(r.today_sec),
    words_learned: num(r.words_learned),
  }));
}

/** 없는 닉네임이면 null */
export async function adminStudentDetail(nickname: string): Promise<AdminStudentDetail | null> {
  const { data, error } = await supabase().rpc("admin_student_detail", { p_nickname: nickname });
  if (error) throw error;
  return (data as AdminStudentDetail | null) ?? null;
}

/** since(ms) 이후 시작한 기록, 오래된 순 (최대 5000개) */
export async function adminStudentSessions(nickname: string, since: number): Promise<StudySession[]> {
  const { data, error } = await supabase().rpc("admin_student_sessions", { p_nickname: nickname, p_since: new Date(since).toISOString() });
  if (error) throw error;
  return ((data ?? []) as StudySession[]).map((s) => ({ ...s, subject: normalizeSubject(s.subject) ?? ETC, lecture: !!s.lecture, manual: !!s.manual }));
}

export type UpdateResult = "ok" | "not_found" | "taken" | "invalid";

export async function adminUpdateStudent(
  nickname: string,
  next: { nickname: string; grade: number; class_no: number; track: string | null },
): Promise<UpdateResult> {
  const { data, error } = await supabase().rpc("admin_update_student", {
    p_nickname: nickname,
    p_new_nickname: next.nickname.trim(),
    p_grade: next.grade,
    p_class_no: next.class_no,
    p_track: next.track,
  });
  if (error) throw error;
  return data as UpdateResult;
}

export async function adminDeleteSession(id: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("admin_delete_session", { p_id: id });
  if (error) throw error;
  return data === true;
}

/** "3분 전", "2시간 전", "어제", "5일 전", "11/3" */
export function agoText(iso: string | null, now: number): string {
  if (!iso) return "기록 없음";
  const diff = Math.max(0, now - Date.parse(iso)) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return days === 1 ? "어제" : `${days}일 전`;
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCFullYear() % 100}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
}
