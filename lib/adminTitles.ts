"use client";

/**
 * 관리자 칭호 관리 (supabase/parts/09-admin-titles.sql). 관리자가 아니면 DB 함수가 모두 거절한다.
 * 조건(metric) 목록은 09의 title_metric_unit()·06의 title_stats()와 같게.
 */

import { supabase } from "@/lib/supabase";
import type { TitleGrade, TitleUnit } from "@/lib/titles";

export type AdminTitle = {
  code: string;
  name: string;
  grade: TitleGrade;
  category: string;
  description: string;
  metric: string;
  goal: number;
  unit: TitleUnit;
  sort: number;
  active: boolean;
  custom: boolean;
  edited: boolean;
  holders: number;
};

export type Metric = { id: string; label: string; unit: TitleUnit };

/** 'manual' = 자동으로 안 생기고 관리자가 줄 때만 생김 */
export const MANUAL = "manual";

/** 자동 판정 조건 (단위가 flag면 목표 없이 "했으면" 얻음) */
export const METRICS: readonly Metric[] = [
  { id: "total_sec", label: "누적 공부 시간", unit: "hour" },
  { id: "max_day_sec", label: "하루 최대 공부 시간", unit: "hour" },
  { id: "sub_kor", label: "국어 누적 공부 시간", unit: "hour" },
  { id: "sub_eng", label: "영어 누적 공부 시간", unit: "hour" },
  { id: "sub_math", label: "수학 누적 공부 시간", unit: "hour" },
  { id: "sub_soc", label: "사회 누적 공부 시간", unit: "hour" },
  { id: "sub_sci", label: "과학 누적 공부 시간", unit: "hour" },
  { id: "sub_his", label: "역사 누적 공부 시간", unit: "hour" },
  { id: "max_streak", label: "연속 출석 (하루 30분 이상) 최장 일수", unit: "day" },
  { id: "yaja_days", label: "평일 야자(18~22시) 2시간 이상 한 날 수", unit: "day" },
  { id: "tasks_done", label: "플래너 과제 완료 개수", unit: "count" },
  { id: "short_count", label: "1~3분 만에 끝낸 기록 횟수", unit: "count" },
  { id: "first_record", label: "첫 공부 기록 (1분 이상)", unit: "flag" },
  { id: "focus_2h", label: "앱을 안 벗어나고 한 번에 2시간", unit: "flag" },
  { id: "allround", label: "하루에 5과목을 각각 20분 이상", unit: "flag" },
  { id: "week_class_top", label: "반 주간 1위", unit: "flag" },
  { id: "week_grade_top", label: "학년 주간 1위", unit: "flag" },
  { id: "week_school_top", label: "전교 주간 1위", unit: "flag" },
  { id: "reset_hunter", label: "월요일 0시~0시 5분에 공부 시작", unit: "flag" },
  { id: "hour_exact", label: "한 번의 기록이 정확히 1시간", unit: "flag" },
  { id: "xmas", label: "12월 25일에 3시간 이상", unit: "flag" },
  { id: "newyear", label: "1월 1일 0시대에 공부 중", unit: "flag" },
  { id: "bug_finder", label: "오류 신고 문의에 답변을 받음", unit: "flag" },
];

export const metricById = (id: string) => METRICS.find((m) => m.id === id) ?? null;
export const UNIT_SUFFIX: Record<TitleUnit, string> = { hour: "시간", day: "일", count: "개", flag: "" };

/** 저장된 목표(시간은 초)를 화면 단위로 */
export const goalForDisplay = (t: Pick<AdminTitle, "goal" | "unit">) => (t.unit === "hour" ? Math.round((t.goal / 3600) * 10) / 10 : t.goal);

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const adminListTitles = async () =>
  (await rpc<AdminTitle[]>("admin_list_titles")).map((t) => ({ ...t, goal: Number(t.goal), holders: Number(t.holders) }));

export type TitleDraft = { code: string | null; name: string; grade: TitleGrade; category: string; description: string; metric: string; goal: number | null; active: boolean };

/** 저장(code가 null이면 새로). 목표는 화면 단위(시간·일·개)로 넘긴다. 저장된 코드를 돌려준다 */
export const adminSaveTitle = (d: TitleDraft) =>
  rpc<string>("admin_save_title", {
    p_code: d.code,
    p_name: d.name,
    p_grade: d.grade,
    p_category: d.category,
    p_description: d.description,
    p_metric: d.metric,
    p_goal: d.goal,
    p_active: d.active,
  });

export const adminDeleteTitle = (code: string) => rpc<boolean>("admin_delete_title", { p_code: code });

/** 'ok' | 'no_user' | 'no_title' | 'already' */
export const adminGrantTitle = (nickname: string, code: string) => rpc<string>("admin_grant_title", { p_nickname: nickname.trim(), p_code: code });
/** 'ok' | 'no_user' | 'not_owned' */
export const adminRevokeTitle = (nickname: string, code: string) => rpc<string>("admin_revoke_title", { p_nickname: nickname.trim(), p_code: code });

export type Holder = { nickname: string; grade: number; class_no: number; earned_at: string };
export const adminTitleHolders = (code: string) => rpc<Holder[]>("admin_title_holders", { p_code: code });

export type FoundUser = { nickname: string; grade: number; class_no: number };
export const adminFindUsers = (q: string) => rpc<FoundUser[]>("admin_find_users", { p_query: q });
