"use client";

/**
 * 레벨 1~99와 닉네임 테두리. 서버 계산·검사는 supabase/parts/08-levels.sql — 식·숫자를 바꾸면 둘 다 고친다.
 *  - 경험치 = 과목별 공부 시간 합(순위와 같은 기준: 기타·인강 제외, 한 기록 1초~4시간). 과목마다 만렙 시간까지만 센다.
 *  - 만렙 시간: 국어·영어·수학 각 500시간, 사회·과학(탐구) 각 300시간, 역사 150시간 → 합계 2,250시간
 *  - 레벨 = 1 + floor(98 × √(경험치 / 2,250시간))
 *  - 보상(LEVEL_REWARDS): 대부분 과목 레벨로 열린다(2026-11-22) — 과목 칭호 10·40·70·99, 과목 테두리 20·60·80, 한정 프로필 30·50·80,
 *    과목 테마 90 (lib/subjectRewards.ts). 전체 레벨 10·20·…·90·99에는 일반 닉네임 테두리가 하나씩.
 */

import { useCallback, useEffect, useState } from "react";
import { notReady } from "@/lib/account";
import { supabase } from "@/lib/supabase";
import type { RankedSubject } from "@/lib/subjects";
import { AVATAR_TIERS, FRAME_TIERS, subjectFrameByCode } from "@/lib/subjectRewards";

export const MAX_LEVEL = 99;
export const SUBJECT_CAP_HOURS: Record<RankedSubject, number> = { 국어: 500, 영어: 500, 수학: 500, 사회: 300, 과학: 300, 역사: 150 };
export const MAX_XP = Object.values(SUBJECT_CAP_HOURS).reduce((a, b) => a + b, 0) * 3600; // 2,250시간(초)

export function levelFromXp(xp: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(98 * Math.sqrt(Math.max(0, xp) / MAX_XP)));
}

/** 과목 레벨 — 같은 식을 그 과목의 만렙 시간에 적용 (과목 테마 같은 과목별 보상용, 화면에서만 계산) */
export function subjectLevel(sec: number, cap: number): number {
  if (cap <= 0) return 1;
  return Math.min(MAX_LEVEL, 1 + Math.floor(98 * Math.sqrt(Math.max(0, Math.min(sec, cap)) / cap)));
}
/** 과목 레벨 L이 되는 데 필요한 그 과목 공부 시간(초) */
export const subjectSecForLevel = (level: number, cap: number) => (level <= 1 ? 0 : Math.ceil(cap * ((Math.min(level, MAX_LEVEL) - 1) / 98) ** 2));

/** 그 레벨이 되는 데 필요한 경험치(초) — 서버 식을 거꾸로 푼 것 (반올림 오차로 1초 모자라지 않게 올림) */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.ceil(MAX_XP * ((Math.min(level, MAX_LEVEL) - 1) / 98) ** 2);
}

// ───────────────────────── 닉네임 테두리 ─────────────────────────

export type NameFrame = { code: string; name: string; minLevel: number; desc: string };

/** 테두리 목록 — 모양은 app/globals.css의 .nf-<code>. 전체 레벨 10·20·…·90·99에 하나씩 열린다 (2026-11-22, 08-levels.sql의 name_frame_min_level()과 같게) */
export const FRAME_LEVEL = 10; // 첫 테두리가 열리는 레벨
export const NAME_FRAMES: readonly NameFrame[] = [
  { code: "sprout", name: "새싹", minLevel: 10, desc: "초록 새싹 테두리" },
  { code: "wave", name: "물결", minLevel: 20, desc: "시원한 파랑 두 줄" },
  { code: "blossom", name: "벚꽃", minLevel: 30, desc: "분홍 꽃잎 점선" },
  { code: "bronze", name: "청동", minLevel: 40, desc: "단단한 청동빛" },
  { code: "silver", name: "은빛", minLevel: 50, desc: "반짝이는 은 그라데이션" },
  { code: "gold", name: "금빛", minLevel: 60, desc: "금빛이 천천히 스쳐 감" },
  { code: "amethyst", name: "자수정", minLevel: 70, desc: "보랏빛으로 은은하게 빛남" },
  { code: "aurora", name: "오로라", minLevel: 80, desc: "색이 흐르는 오로라" },
  { code: "starlight", name: "별빛", minLevel: 90, desc: "밤하늘에 별이 반짝" },
  { code: "daepumta", name: "대품타", minLevel: 99, desc: "대품타 금장 · 왕관" },
];
/** 일반 테두리 또는 과목 테두리(lib/subjectRewards.ts) */
export const frameByCode = (code: string | null | undefined): NameFrame | null => {
  const f = NAME_FRAMES.find((x) => x.code === code);
  if (f) return f;
  const s = subjectFrameByCode(code);
  return s ? { code: s.code, name: `${s.subject} ${s.name}`, minLevel: s.level, desc: s.desc } : null;
};

// ───────────────────────── 보상 ─────────────────────────

export type RewardKind = "title" | "photo" | "theme" | "frame";
/** bySubject: 전체 레벨이 아니라 과목마다 그 과목 레벨로 열린다. href: 보상을 쓰는 화면 */
export type Reward = { level: number; kind: RewardKind; title: string; desc: string; pending?: boolean; bySubject?: boolean; href?: string; /** 닉네임 테두리 보상이면 그 테두리 code (미리보기) */ frame?: string };

/** 레벨 보상표 (2026-11-22 사용자가 다시 정함). 과목 보상은 그 과목 레벨, 일반 테두리만 전체 레벨 */
export const LEVEL_REWARDS: readonly Reward[] = ([
  { level: 10, kind: "title", title: "과목 칭호 · 뉴비", desc: "「국어 뉴비」 같은 희귀 칭호", bySubject: true, href: "/me/titles" },
  { level: FRAME_TIERS[0], kind: "frame", title: "과목 테두리 1단계", desc: "먹선 · 책갈피 · 모눈 · 비커 · 경위선 · 창살", bySubject: true, href: "/me/level#subject-frames" },
  { level: AVATAR_TIERS[0], kind: "photo", title: "한정 프로필 1단계", desc: "먹 한 방울 · 펜촉 · π · 플라스크 · 나침반 · 엽전", bySubject: true, href: "/me/avatar" },
  { level: 40, kind: "title", title: "과목 칭호 · 중수", desc: "초희귀 칭호", bySubject: true, href: "/me/titles" },
  { level: AVATAR_TIERS[1], kind: "photo", title: "한정 프로필 2단계", desc: "붓과 먹 · 펼친 책 · 컴퍼스 · 이중 나선 · 지구본 · 연꽃 수막새", bySubject: true, href: "/me/avatar" },
  { level: FRAME_TIERS[1], kind: "frame", title: "과목 테두리 2단계", desc: "낙관 · 가죽 장정 · 작도 · 분자 결합 · 지도 테두리 · 단청", bySubject: true, href: "/me/level#subject-frames" },
  { level: 70, kind: "title", title: "과목 칭호 · 고수", desc: "영웅 칭호", bySubject: true, href: "/me/titles" },
  { level: FRAME_TIERS[2], kind: "frame", title: "과목 테두리 3단계", desc: "일필휘지 · 채식 필사본 · 무한 · 플라스마 · 세계 일주 · 일월 (움직임)", bySubject: true, href: "/me/level#subject-frames" },
  { level: AVATAR_TIERS[2], kind: "photo", title: "한정 프로필 3단계", desc: "일원상 · 깃펜과 잉크 · 황금 나선 · 원자 · 대항해 · 일월오봉도 (움직임)", bySubject: true, href: "/me/avatar" },
  { level: 90, kind: "theme", title: "과목 테마", desc: "그 과목 테마 (타이머·플래너까지)", bySubject: true, href: "/me/theme" },
  { level: 99, kind: "title", title: "과목 칭호 · 마스터", desc: "신화 칭호", bySubject: true, href: "/me/titles" },
  ...NAME_FRAMES.map((f): Reward => ({ level: f.minLevel, kind: "frame", title: `닉네임 테두리 「${f.name}」`, desc: `전체 레벨 ${f.minLevel} · ${f.desc}`, href: "/me/level#frames", frame: f.code })),
] as Reward[]).sort((a, b) => a.level - b.level);

// ───────────────────────── 서버 ─────────────────────────

export type SubjectXp = { subject: RankedSubject; sec: number; cap: number };
export type MyLevel = { level: number; xp: number; maxXp: number; frame: string | null; subjects: SubjectXp[] };

export async function loadMyLevel(): Promise<MyLevel> {
  const { data, error } = await supabase().rpc("my_level");
  if (error) throw error;
  const d = data as { level: number; xp: number; max_xp: number; frame: string | null; subjects: SubjectXp[] };
  return { level: d.level, xp: Number(d.xp), maxXp: Number(d.max_xp), frame: d.frame, subjects: d.subjects.map((s) => ({ ...s, sec: Number(s.sec), cap: Number(s.cap) })) };
}

/** 'ok' | 'locked' | 'invalid' */
export async function setNameFrame(code: string | null): Promise<string> {
  const { data, error } = await supabase().rpc("set_name_frame", { p_code: code });
  if (error) throw error;
  return data as string;
}

export type PlayerCard = { level: number; frame: string | null };

/** 순위·그룹 화면의 학생들 레벨·테두리. 08을 실행하기 전이면 빈 결과 */
export async function loadPlayerCards(nicknames: string[]): Promise<Map<string, PlayerCard>> {
  const names = [...new Set(nicknames)].slice(0, 100);
  if (!names.length) return new Map();
  const { data, error } = await supabase().rpc("player_cards", { p_nicknames: names });
  if (error) {
    if (notReady(error)) return new Map();
    throw error;
  }
  return new Map(((data ?? []) as { nickname: string; level: number; name_frame: string | null }[]).map((r) => [r.nickname, { level: r.level, frame: r.name_frame }]));
}

/** 닉네임 목록이 바뀌면 레벨·테두리를 불러온다 */
export function usePlayerCards(nicknames: string[]): Map<string, PlayerCard> {
  const key = nicknames.join("\u0000");
  const [cards, setCards] = useState<{ key: string; map: Map<string, PlayerCard> }>({ key: "", map: new Map() });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    loadPlayerCards(key.split("\u0000")).then(
      (map) => alive && setCards({ key, map }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return cards.map;
}

/** 내 레벨. version이 바뀌면(공부 기록 변화 등) 다시 불러온다. available=false면 08을 아직 실행 안 함 */
export function useMyLevel(version = 0): { level: MyLevel | null; available: boolean; reload: () => Promise<void> } {
  const [level, setLevel] = useState<MyLevel | null>(null);
  const [available, setAvailable] = useState(true);
  const reload = useCallback(async () => {
    try {
      setLevel(await loadMyLevel());
    } catch (e) {
      if (notReady(e)) setAvailable(false);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    loadMyLevel().then(
      (l) => alive && setLevel(l),
      (e) => alive && notReady(e) && setAvailable(false),
    );
    return () => {
      alive = false;
    };
  }, [version]);
  return { level, available, reload };
}

// ───────────────────────── 레벨 업 알림용 ─────────────────────────

const seenKey = (uid: string) => `daego-level-seen:${uid}`;
export function readSeenLevel(uid: string): number | null {
  try {
    const v = Number(localStorage.getItem(seenKey(uid)));
    return Number.isInteger(v) && v >= 1 ? v : null;
  } catch {
    return null;
  }
}
export function writeSeenLevel(uid: string, level: number) {
  try {
    localStorage.setItem(seenKey(uid), String(level));
  } catch {
    // 저장소를 못 쓰면 알림 없이
  }
}
