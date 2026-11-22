"use client";

import { supabase } from "@/lib/supabase";

/**
 * 칭호와 프로필 그림.
 * 칭호 정의(이름·등급·조건)와 판정은 DB(supabase/schema.sql의 title_defs, title_stats, check_titles)에 있다.
 * 앱은 결과만 받아 그린다 — 히든 칭호는 얻기 전까지 서버가 이름을 '???'로 보내 준다.
 */

export type TitleGrade = "common" | "rare" | "superrare" | "epic" | "mythic" | "legendary" | "special" | "hidden";
export type TitleUnit = "flag" | "hour" | "day" | "count" | "level";

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

/**
 * 과목 누적 1,000시간 전설 칭호 (2026-11-22) — 금빛 대신 과목마다 다른 디자인 (globals.css .tb-sig-*, .ring-sig-*).
 * code로 고른다 (04-titles.sql의 sub1k_<과목>). 순위 화면은 get_ranking의 title_code로 받는다.
 */
export const SIGNATURE_TITLES = { sub1k_kor: "kor", sub1k_eng: "eng", sub1k_math: "math", sub1k_soc: "soc", sub1k_sci: "sci", sub1k_his: "his" } as const;
export type Signature = (typeof SIGNATURE_TITLES)[keyof typeof SIGNATURE_TITLES];
export const signatureOf = (code: string | null | undefined): Signature | null =>
  code && code in SIGNATURE_TITLES ? SIGNATURE_TITLES[code as keyof typeof SIGNATURE_TITLES] : null;
/**
 * 스페셜 칭호 (2026-11-22) — 칭호마다 디자인이 모두 다르다 (globals.css .tb-sp-*, .ring-sp-*).
 * 관리자가 새로 만든 스페셜은 기본 스페셜 디자인(.tb-special — 노을빛 입장권, 히든의 밤하늘·오로라와 겹치지 않게)을 쓴다.
 */
export const SPECIAL_TITLES = {
  top_kor: "kor", // 장원 급제 — 홍패
  top_eng: "eng", // No.1 — 바시티 재킷
  top_math: "math", // 최댓값 — 그래프 꼭대기
  top_soc: "soc", // 지지율 1위 — 선거 포스터
  top_sci: "sci", // 1번 원소 — 주기율표 칸
  top_his: "his", // 태조 — 곤룡포
  nh_class: "nh", // 능화반 — 남보라 홀로그램
  nh_keep: "nhk", // 대능인 — 백금·무지갯빛
  nh_fall: "nhf", // 능화 추락자 — 떨어지는 별똥별
} as const;
export type SpecialDesign = (typeof SPECIAL_TITLES)[keyof typeof SPECIAL_TITLES];
export const specialOf = (code: string | null | undefined): SpecialDesign | null =>
  code && code in SPECIAL_TITLES ? SPECIAL_TITLES[code as keyof typeof SPECIAL_TITLES] : null;

/** 프로필 그림 테두리 클래스 (과목 전설·스페셜이면 그 디자인, 아니면 등급 색) */
export const ringClass = (grade: string | null | undefined, code?: string | null) => {
  const sig = signatureOf(code);
  if (sig) return `ring-sig-${sig}`;
  const sp = specialOf(code);
  if (sp) return `ring-sp-${sp}`;
  return isGrade(grade) ? `ring-${grade}` : "";
};

/**
 * 등급 이름과 화면에 보여 줄 순서 (스페셜 맨 앞, 높은 것부터, 히든은 맨 끝).
 * 스페셜(2026-11-22) = 특별한 칭호. 칭호마다 디자인이 다르다(DESIGNED_TITLES). 히든 = 얻기 전까지 숨겨진 칭호.
 * 2026-11-22 사용자 요청: 전설 밑에 신화(붉은색), 초희귀 추가 → 일반 < 희귀 < 초희귀 < 영웅 < 신화 < 전설
 */
export const GRADES: { id: TitleGrade; label: string }[] = [
  { id: "special", label: "스페셜" },
  { id: "legendary", label: "전설" },
  { id: "mythic", label: "신화" },
  { id: "epic", label: "영웅" },
  { id: "superrare", label: "초희귀" },
  { id: "rare", label: "희귀" },
  { id: "common", label: "일반" },
  { id: "hidden", label: "히든" },
];
export const GRADE_LABEL: Record<TitleGrade, string> = Object.fromEntries(GRADES.map((g) => [g.id, g.label])) as Record<TitleGrade, string>;
export const GRADE_RANK: Record<TitleGrade, number> = { common: 1, rare: 2, superrare: 3, epic: 4, mythic: 5, legendary: 6, special: 7, hidden: 5 };

export function isGrade(v: unknown): v is TitleGrade {
  return typeof v === "string" && v in GRADE_LABEL;
}

/** 진행도 글자: 37/100시간, 3/7일, 99/100개, Lv.7/10 (과목 레벨) */
export function progressText(t: MyTitle): string | null {
  if (t.goal == null || t.progress == null || t.unit === "flag") return null;
  if (t.unit === "hour") {
    const p = Math.floor(t.progress / 3600);
    return `${p}/${Math.round(t.goal / 3600)}시간`;
  }
  if (t.unit === "level") return `Lv.${Math.floor(t.progress)}/${t.goal}`;
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
