"use client";

/**
 * 내 일과 (2026-11-22, 사용자: "시간 입력할 때 자신이 정한 일과도 추가할 수 있게") — 직접 입력(/timer/manual)에서
 * 한 번 누르면 시각(과목도 정했으면 과목까지)이 채워지는 나만의 시간대. 예: 「야자 1교시 18:50~20:10」.
 * 기기에 저장한다(localStorage `daego-day-plan:<uid>`) — 다른 기기·홈 화면 앱에는 따로 만든다.
 */

import type { Subject } from "@/lib/subjects";

export type TimePreset = {
  id: string;
  name: string;
  /** "18:50" */
  start: string;
  end: string;
  /** 과목까지 정해 둔 일과면 같이 채운다 (null = 시각만) */
  subject: Subject | null;
  detail: string | null;
};

export const MAX_PRESETS = 20;
const key = (uid: string) => `daego-day-plan:${uid}`;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function loadPresets(uid: string): TimePreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is TimePreset => !!p && typeof p.name === "string" && TIME.test(p.start) && TIME.test(p.end))
      .slice(0, MAX_PRESETS)
      .map((p) => ({ ...p, subject: p.subject ?? null, detail: p.detail ?? null }));
  } catch {
    return [];
  }
}

export function savePresets(uid: string, list: TimePreset[]): boolean {
  try {
    localStorage.setItem(key(uid), JSON.stringify(list.slice(0, MAX_PRESETS)));
    return true;
  } catch {
    return false;
  }
}

/** 시작 시각 순 */
export const sortPresets = (list: TimePreset[]) => [...list].sort((a, b) => a.start.localeCompare(b.start));
export const newPresetId = () => Math.random().toString(36).slice(2, 10);
