"use client";

import { supabase } from "@/lib/supabase";
import type { RankedSubject } from "@/lib/subjects";

/**
 * 스터디그룹 — 6자리 초대코드로 모여 이번 주 공부 시간을 겨룬다.
 * 테이블은 앱이 직접 못 읽고 schema.sql의 함수로만 다룬다 (그룹원이 아니면 아무것도 볼 수 없다).
 */

export type MyGroup = { id: string; name: string; invite_code: string; member_count: number; is_owner: boolean; joined_at: string };

export type GroupRankRow = {
  rank: number;
  nickname: string;
  grade: number;
  class_no: number;
  total_sec: number;
  today_sec: number;
  studying: boolean;
  is_me: boolean;
  is_owner: boolean;
  avatar?: string | null;
  title_name?: string | null;
  title_grade?: string | null;
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const loadMyGroups = () => rpc<MyGroup[]>("my_groups");
export const createGroup = (name: string) => rpc<string>("create_group", { p_name: name.trim() });
export const leaveGroup = (id: string) => rpc<null>("leave_group", { p_group: id });
export const renameGroup = (id: string, name: string) => rpc<null>("rename_group", { p_group: id, p_name: name.trim() });
export const regenerateGroupCode = (id: string) => rpc<string>("regenerate_group_code", { p_group: id });
export const kickGroupMember = (id: string, nickname: string) => rpc<null>("kick_group_member", { p_group: id, p_nickname: nickname });
export const deleteGroup = (id: string) => rpc<null>("delete_group", { p_group: id });
export const getGroupRanking = (id: string, subject: RankedSubject | null) =>
  rpc<GroupRankRow[]>("get_group_ranking", { p_group: id, p_subject: subject });

/** 코드로 들어가기 → 그룹 id. 코드가 틀리면 오류 */
export async function joinGroup(code: string): Promise<string> {
  const id = await rpc<string | null>("join_group", { p_code: code });
  if (!id) throw new Error("초대코드가 맞지 않아요");
  return id;
}

/** "ABC234" → "ABC 234" (읽기 쉽게) */
export const prettyCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
