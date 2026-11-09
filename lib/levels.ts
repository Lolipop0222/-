"use client";

/**
 * 레벨 1~99와 닉네임 테두리. 서버 계산·검사는 supabase/parts/08-levels.sql — 식·숫자를 바꾸면 둘 다 고친다.
 *  - 경험치 = 과목별 공부 시간 합(순위와 같은 기준: 기타·인강 제외, 한 기록 1초~4시간). 과목마다 만렙 시간까지만 센다.
 *  - 만렙 시간: 국어·영어·수학 각 500시간, 사회·과학(탐구) 각 300시간, 역사 150시간 → 합계 2,250시간
 *  - 레벨 = 1 + floor(98 × √(경험치 / 2,250시간))
 *  - 10레벨마다 보상(LEVEL_REWARDS). 지금은 1레벨 캐릭터(그림 준비 중)와 닉네임 테두리. 자세한 보상은 사용자가 나중에 정한다.
 */

import { useCallback, useEffect, useState } from "react";
import { notReady } from "@/lib/account";
import { supabase } from "@/lib/supabase";
import type { RankedSubject } from "@/lib/subjects";

export const MAX_LEVEL = 99;
export const SUBJECT_CAP_HOURS: Record<RankedSubject, number> = { 국어: 500, 영어: 500, 수학: 500, 사회: 300, 과학: 300, 역사: 150 };
export const MAX_XP = Object.values(SUBJECT_CAP_HOURS).reduce((a, b) => a + b, 0) * 3600; // 2,250시간(초)

export function levelFromXp(xp: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(98 * Math.sqrt(Math.max(0, xp) / MAX_XP)));
}

/** 그 레벨이 되는 데 필요한 경험치(초) — 서버 식을 거꾸로 푼 것 (반올림 오차로 1초 모자라지 않게 올림) */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.ceil(MAX_XP * ((Math.min(level, MAX_LEVEL) - 1) / 98) ** 2);
}

// ───────────────────────── 닉네임 테두리 ─────────────────────────

export type NameFrame = { code: string; name: string; minLevel: number; desc: string };

/** 테두리 목록 — 모양은 app/globals.css의 .nf-<code>. 열리는 레벨은 08-levels.sql의 name_frame_min_level()과 같게 */
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
  { code: "daepumta", name: "대품타", minLevel: 99, desc: "만렙 전용 · 대품타 금장" },
];
export const frameByCode = (code: string | null | undefined) => NAME_FRAMES.find((f) => f.code === code) ?? null;

// ───────────────────────── 보상 ─────────────────────────

export type Reward = { level: number; title: string; desc: string; frame?: string; pending?: boolean };

/** 10레벨마다 보상. 1레벨 캐릭터는 그림을 받으면 넣는다(지금은 "준비 중") */
export const LEVEL_REWARDS: readonly Reward[] = [
  { level: 1, title: "캐릭터", desc: "나만의 캐릭터 이미지", pending: true },
  ...NAME_FRAMES.map((f) => ({ level: f.minLevel, title: `닉네임 테두리 · ${f.name}`, desc: f.desc, frame: f.code })),
];

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
