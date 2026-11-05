"use client";

import { supabase } from "@/lib/supabase";

/**
 * 계정 보안(복구 코드·비밀번호 찾기·계정 삭제)과 문의함.
 * DB 쪽은 supabase/schema.sql 끝의 "보안 · 문의함 · 비밀번호 찾기 · 계정 삭제" 부분.
 */

type PgError = { code?: string; message?: string } | null;

/** schema.sql을 다시 실행하기 전이라 테이블·함수가 없는 경우 */
export function notReady(e: unknown): boolean {
  const code = (e as PgError)?.code;
  return code === "PGRST202" || code === "PGRST205" || code === "42P01" || code === "42883";
}

export const MIN_PASSWORD = 8;

/** 새 비밀번호 검사. 문제가 없으면 null */
export function passwordProblem(pw: string, again: string): string | null {
  if (pw.length < MIN_PASSWORD) return `비밀번호는 ${MIN_PASSWORD}자 이상으로 해 주세요`;
  if (new TextEncoder().encode(pw).length > 72) return "비밀번호가 너무 길어요";
  if (pw !== again) return "두 비밀번호가 서로 달라요";
  return null;
}

// ───────────────────────── 복구 코드 ─────────────────────────

/** 복구 코드를 만든 시각 (없으면 null) */
export async function recoveryCodeCreatedAt(): Promise<string | null> {
  const { data, error } = await supabase().rpc("recovery_code_created_at");
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** 새 복구 코드 (예전 코드는 못 쓰게 된다). 이 값은 지금 한 번만 볼 수 있다 */
export async function createRecoveryCode(): Promise<string> {
  const { data, error } = await supabase().rpc("create_recovery_code");
  if (error) throw error;
  return data as string;
}

export type ResetResult = "ok" | "invalid" | "locked" | "weak";

export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<ResetResult> {
  const { data, error } = await supabase().rpc("reset_password_with_code", {
    p_email: email.trim(),
    p_code: code.trim(),
    p_password: password,
  });
  if (error) throw error;
  return data as ResetResult;
}

// ───────────────────────── 계정 삭제 ─────────────────────────

/** 비밀번호를 한 번 더 확인한 다음 계정과 모든 기록을 지운다 */
export async function deleteMyAccount(email: string, password: string): Promise<void> {
  const sb = supabase();
  const { error: authError } = await sb.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw error;
  // 서버에서 계정이 없어졌으니 이 기기의 로그인 정보만 지운다
  await sb.auth.signOut({ scope: "local" });
}

// ───────────────────────── 문의함 ─────────────────────────

export const INQUIRY_CATEGORIES = ["질문", "오류 신고", "제안", "기타"] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export type Inquiry = {
  id: string;
  category: InquiryCategory;
  body: string;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export async function loadMyInquiries(): Promise<Inquiry[]> {
  const { data, error } = await supabase()
    .from("inquiries")
    .select("id, category, body, reply, replied_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as Inquiry[];
}

export async function sendInquiry(category: InquiryCategory, body: string): Promise<void> {
  const { error } = await supabase().from("inquiries").insert({ category, body: body.trim() });
  if (error) throw error;
}

export async function deleteInquiry(id: string): Promise<void> {
  const { error } = await supabase().from("inquiries").delete().eq("id", id);
  if (error) throw error;
}

// ───────────────────────── 관리자 ─────────────────────────

export type AdminInquiry = Inquiry & { nickname: string; grade: number; class_no: number };

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase().rpc("is_admin");
  if (error) return false;
  return data === true;
}

export async function adminListInquiries(): Promise<AdminInquiry[]> {
  const { data, error } = await supabase().rpc("admin_list_inquiries");
  if (error) throw error;
  return data as AdminInquiry[];
}

export async function adminReply(id: string, reply: string): Promise<void> {
  const { error } = await supabase().rpc("admin_reply_inquiry", { p_id: id, p_reply: reply });
  if (error) throw error;
}

export async function adminIssueRecoveryCode(nickname: string): Promise<string> {
  const { data, error } = await supabase().rpc("admin_issue_recovery_code", { p_nickname: nickname.trim() });
  if (error) throw error;
  return data as string;
}

/** "2026-11-05T…" → "11월 5일 19:30" (한국 시간) */
export function kstDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${hh}:${mm}`;
}
