"use client";

import { supabase } from "@/lib/supabase";

/**
 * 칭호와 프로필 그림.
 * 칭호 정의(이름·등급·조건)와 판정은 DB(supabase/schema.sql의 title_defs, title_stats, check_titles)에 있다.
 * 앱은 결과만 받아 그린다 — 히든 칭호는 얻기 전까지 서버가 이름을 '???'로 보내 준다.
 */

export type TitleGrade = "common" | "rare" | "epic" | "legendary" | "hidden";
export type TitleUnit = "flag" | "hour" | "day" | "count";

export type MyTitle = {
  code: string;
  name: string;
  grade: TitleGrade;
  category: string;
  description: string;
  unit: TitleUnit;
  goal: number | null;
  progress: number | null;
  earned_at: string | null;
  equipped: boolean;
  sort: number;
};

export type NewTitle = { code: string; name: string; grade: TitleGrade };

/** 등급 이름과 화면에 보여 줄 순서 (전설부터, 히든은 맨 끝) */
export const GRADES: { id: TitleGrade; label: string }[] = [
  { id: "legendary", label: "전설" },
  { id: "epic", label: "영웅" },
  { id: "rare", label: "희귀" },
  { id: "common", label: "일반" },
  { id: "hidden", label: "히든" },
];
export const GRADE_LABEL: Record<TitleGrade, string> = Object.fromEntries(GRADES.map((g) => [g.id, g.label])) as Record<TitleGrade, string>;
export const GRADE_RANK: Record<TitleGrade, number> = { common: 1, rare: 2, epic: 3, legendary: 4, hidden: 4 };

export function isGrade(v: unknown): v is TitleGrade {
  return typeof v === "string" && v in GRADE_LABEL;
}

/** 진행도 글자: 37/100시간, 3/7일, 99/100개 */
export function progressText(t: MyTitle): string | null {
  if (t.goal == null || t.progress == null || t.unit === "flag") return null;
  if (t.unit === "hour") {
    const p = Math.floor(t.progress / 3600);
    return `${p}/${Math.round(t.goal / 3600)}시간`;
  }
  return `${Math.floor(t.progress)}/${t.goal}${t.unit === "day" ? "일" : "개"}`;
}

export function progressRatio(t: MyTitle): number {
  if (t.goal == null || t.progress == null || t.goal <= 0) return 0;
  return Math.min(1, t.progress / t.goal);
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

/** 판정 + 아직 알림을 안 띄운 새 칭호 (부르면 '봤음'이 된다) */
export const checkTitles = () => rpc<NewTitle[]>("check_titles");
export const loadMyTitles = () => rpc<MyTitle[]>("my_titles");
export const setTitle = (code: string | null) => rpc<null>("set_title", { p_code: code });

/** 플래너 과제 완료처럼 칭호 판정을 다시 해야 할 때 보내는 신호 (components/TitlesProvider가 듣는다) */
export const TITLE_CHECK_EVENT = "daego-check-titles";
export function requestTitleCheck() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TITLE_CHECK_EVENT));
}

// ───────────────────────── 프로필 그림 ─────────────────────────
// 사진 대신 그림+색을 고른다 (실명·얼굴을 받지 않는 앱 원칙). DB에는 '그림:색' 글자로 저장한다.

export const AVATAR_ICONS = [
  "cat", "dog", "rabbit", "bird", "fish", "squirrel", "turtle", "snail",
  "ghost", "bot", "rocket", "flame", "star", "moon", "sun", "zap",
  "coffee", "pencil", "music", "gamepad", "leaf", "clover", "cherry", "origami",
] as const;
export type AvatarIcon = (typeof AVATAR_ICONS)[number];

/** 색은 테마의 과목 색 토큰을 쓴다 (테마마다 어울리게 바뀜) */
export const AVATAR_COLORS = ["s-math", "s-kor", "s-eng", "s-sci", "s-soc", "s-his", "s-lec", "s-etc"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export type AvatarValue = { icon: AvatarIcon; color: AvatarColor };

export function parseAvatar(v: string | null | undefined): AvatarValue | null {
  if (!v) return null;
  const [icon, color] = v.split(":");
  if (!(AVATAR_ICONS as readonly string[]).includes(icon) || !(AVATAR_COLORS as readonly string[]).includes(color)) return null;
  return { icon: icon as AvatarIcon, color: color as AvatarColor };
}

export const avatarString = (a: AvatarValue) => `${a.icon}:${a.color}`;

/** 프로필 avatar 값 저장 ('cat:s-math' 같은 그림, 'photo:…' 사진, null = 첫 글자) */
export async function saveAvatar(userId: string, value: string | null): Promise<void> {
  const { error } = await supabase().from("profiles").update({ avatar: value }).eq("id", userId);
  if (error) throw error;
}
