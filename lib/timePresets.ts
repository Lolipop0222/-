"use client";

/**
 * 내 일과 (2026-11-22) — 직접 입력(/timer/manual)에서 한 번 누르면 시각(과목·세부까지 정했으면 그것도)이 채워지는 나만의 시간대.
 * 예: 「야자 1교시 18:50~20:10」. **계정에 저장**(11-manual.sql `time_presets`, RLS 내 것만, 20개).
 * 처음엔 기기 저장(localStorage `daego-day-plan:<uid>`)이었다 → 계정 저장이 되는 DB면 처음 열 때 한 번 옮기고 기기 것은 지운다.
 * 11을 다시 실행하기 전 DB(표 없음 PGRST205)면 예전처럼 기기에 저장한다.
 */

import { supabase } from "@/lib/supabase";
import { normalizeSubject, type Subject } from "@/lib/subjects";

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
const localKey = (uid: string) => `daego-day-plan:${uid}`;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isMissingTable = (e: unknown) => ["PGRST205", "42P01"].includes((e as { code?: string } | null)?.code ?? "");

/** 시작 시각 순 */
export const sortPresets = (list: TimePreset[]) => [...list].sort((a, b) => a.start.localeCompare(b.start));

function readLocal(uid: string): TimePreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(uid)) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is TimePreset => !!p && typeof p.name === "string" && TIME.test(p.start) && TIME.test(p.end))
      .slice(0, MAX_PRESETS)
      .map((p) => ({ ...p, subject: p.subject ?? null, detail: p.detail ?? null }));
  } catch {
    return [];
  }
}
function writeLocal(uid: string, list: TimePreset[]) {
  try {
    if (list.length) localStorage.setItem(localKey(uid), JSON.stringify(list.slice(0, MAX_PRESETS)));
    else localStorage.removeItem(localKey(uid));
  } catch {
    // 저장이 막힌 브라우저
  }
}

type Row = { id: string; name: string; start_time: string; end_time: string; subject: string | null; detail: string | null };
const fromRow = (r: Row): TimePreset => ({
  id: r.id,
  name: r.name,
  start: r.start_time.slice(0, 5),
  end: r.end_time.slice(0, 5),
  subject: r.subject ? normalizeSubject(r.subject) : null,
  detail: r.detail,
});
const toRow = (p: Omit<TimePreset, "id">) => ({ name: p.name.trim().slice(0, 12), start_time: p.start, end_time: p.end, subject: p.subject, detail: p.subject ? p.detail : null });

/** where = "account"(계정) | "device"(이 기기 — DB 업데이트 전) */
export type PresetStore = { list: TimePreset[]; where: "account" | "device" };

export async function loadPresets(uid: string): Promise<PresetStore> {
  const sb = supabase();
  const res = await sb.from("time_presets").select("id, name, start_time, end_time, subject, detail").order("start_time");
  if (isMissingTable(res.error)) return { list: sortPresets(readLocal(uid)), where: "device" };
  if (res.error) throw res.error;
  let list = (res.data as Row[]).map(fromRow);
  // 기기에 있던 일과를 계정으로 한 번 옮긴다 (이름·시각이 같은 건 건너뜀)
  const local = readLocal(uid);
  if (local.length) {
    const have = new Set(list.map((p) => `${p.name}|${p.start}|${p.end}`));
    const rows = local.filter((p) => !have.has(`${p.name}|${p.start}|${p.end}`)).slice(0, Math.max(0, MAX_PRESETS - list.length)).map(toRow);
    if (rows.length) {
      const ins = await sb.from("time_presets").insert(rows).select("id, name, start_time, end_time, subject, detail");
      if (!ins.error) list = list.concat((ins.data as Row[]).map(fromRow));
    }
    writeLocal(uid, []);
  }
  return { list: sortPresets(list), where: "account" };
}

export async function addPreset(uid: string, store: PresetStore, p: Omit<TimePreset, "id">): Promise<TimePreset[]> {
  if (store.where === "device") {
    const list = sortPresets([...store.list, { ...p, id: Math.random().toString(36).slice(2, 10) }]);
    writeLocal(uid, list);
    return list;
  }
  const { data, error } = await supabase().from("time_presets").insert(toRow(p)).select("id, name, start_time, end_time, subject, detail").single();
  if (error) throw error;
  return sortPresets([...store.list, fromRow(data as Row)]);
}

export async function deletePreset(uid: string, store: PresetStore, id: string): Promise<TimePreset[]> {
  const list = store.list.filter((x) => x.id !== id);
  if (store.where === "device") writeLocal(uid, list);
  else {
    const { error } = await supabase().from("time_presets").delete().eq("id", id);
    if (error) throw error;
  }
  return list;
}
