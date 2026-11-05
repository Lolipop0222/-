"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 브라우저용 Supabase 클라이언트.
 * URL과 publishable 키는 공개돼도 되는 값이다 — 데이터는 RLS와 DB 함수가 지킨다 (supabase/schema.sql).
 * 로그인 상태는 이 기기의 localStorage에 남는다.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const url = envValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = envValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    if (!url || !key) throw new Error("Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY)가 없습니다");
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }
  return client;
}

/**
 * 환경변수 값 정리. 배포 설정 화면에 "이름=값" 한 줄을 통째로 붙여넣거나 따옴표가 들어가는 실수가 흔해서
 * 앞의 "NEXT_PUBLIC_…=" 과 따옴표·공백을 떼어 낸다. 값은 컴파일할 때 그대로 박히므로 여기서 정리한다.
 */
function envValue(v: string | undefined): string | undefined {
  return v?.trim().replace(/^[A-Z0-9_]+=/, "").replace(/^["']|["']$/g, "").trim() || undefined;
}

export type Profile = { id: string; nickname: string; grade: number; class_no: number };

/** Supabase/Postgres 오류를 학생이 읽을 말로 */
export function koreanError(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const msg = err?.message ?? String(e);
  if (err?.code === "23505" || msg.includes("profiles_nickname_key")) return "이미 쓰는 닉네임이에요";
  if (msg.includes("profiles_nickname_check")) return "닉네임은 2~12글자로 해 주세요";
  if (msg.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않아요";
  if (msg.includes("User already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요";
  if (msg.includes("Password should be at least")) return "비밀번호는 6자 이상이어야 해요";
  if (msg.includes("Unable to validate email") || msg.includes("invalid format")) return "이메일 형식을 확인해 주세요";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "인터넷 연결을 확인해 주세요";
  // DB 함수가 직접 던지는 한국어 메시지 (초대코드, 16시간 상한 등)
  if (/[가-힣]/.test(msg)) return msg;
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요";
}
