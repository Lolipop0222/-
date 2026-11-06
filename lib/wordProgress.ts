"use client";

/**
 * 워마 암기 진도 — 복습 상자 5단계(라이트너) + DAY별 퀴즈 최고 점수.
 * 원본은 Supabase(supabase/parts/07-words.sql)의 word_progress·word_quiz_best. 단계·날짜 계산은 서버 함수 wm_record가 한다.
 * 화면이 바로 바뀌도록 같은 규칙을 여기서도 먼저 계산하고(낙관적 갱신), 서버 결과가 오면 그걸로 덮는다.
 *
 * 07을 실행하기 전 DB(테이블 없음)에서는 이 기기 localStorage에 저장한다 → 07을 실행한 뒤 처음 열 때 계정으로 옮긴다(wm_import).
 * 인터넷이 끊겨 못 보낸 결과는 localStorage 보낼 함(outbox)에 두었다가 다음에 보낸다.
 */

import { useEffect, useSyncExternalStore } from "react";
import { kstToday } from "@/lib/dday";
import { supabase } from "@/lib/supabase";
import { WM_DAYS, WORDS_PER_DAY, dayOf, type QuizMode } from "@/lib/wordmaster";

export type Progress = { box: number; due: string | null; seen: number; wrong: number };
export type Best = { correct: number; total: number };
export type Answer = { id: number; ok: boolean };

/** 상자 1~5 → 다음 복습까지 며칠 (07-words.sql의 wm_interval과 같게) */
export const BOX_INTERVAL_DAYS = [1, 3, 7, 16, 35] as const;
export const MASTERED = 6;

export type WordStore = {
  status: "idle" | "loading" | "ready";
  backend: "server" | "local";
  userId: string | null;
  progress: ReadonlyMap<number, Progress>;
  best: ReadonlyMap<string, Best>; // `${day}:${mode}`
  today: string; // 한국 날짜 (불러온 때 기준, 앱으로 돌아오면 다시 계산)
  version: number;
};

const INITIAL: WordStore = { status: "idle", backend: "server", userId: null, progress: new Map(), best: new Map(), today: "", version: 0 };
let state: WordStore = INITIAL;
let loadedAt = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<WordStore>) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** 화면에서 쓰는 훅. 처음 쓸 때 불러오고, 앱으로 돌아오면(2분 넘게 지났으면) 다시 불러온다 */
export function useWordStore(userId: string): WordStore {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  useEffect(() => {
    void ensureLoaded(userId);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt > 120_000) void ensureLoaded(userId, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);
  return s;
}

// ───────────────────────── 규칙 (서버 wm_record와 같게) ─────────────────────────

export function addDays(ymd: string, n: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function nextProgress(prev: Progress | undefined, ok: boolean, today: string): Progress {
  if (!prev) {
    const box = ok ? 2 : 1;
    return { box, due: addDays(today, BOX_INTERVAL_DAYS[box - 1]), seen: 1, wrong: ok ? 0 : 1 };
  }
  let box: number;
  if (!ok) box = 1;
  else if (prev.box < MASTERED && prev.due !== null && prev.due <= today) box = prev.box + 1;
  else box = prev.box;
  const due = box === MASTERED ? null : box === prev.box && ok ? prev.due : addDays(today, BOX_INTERVAL_DAYS[box - 1]);
  return { box, due, seen: prev.seen + 1, wrong: prev.wrong + (ok ? 0 : 1) };
}

export const isDue = (p: Progress | undefined, today: string) => !!p && p.box < MASTERED && p.due !== null && p.due <= today;

// ───────────────────────── 계산 ─────────────────────────

/** 오늘 복습할 단어 id — 낮은 단계·오래 밀린 것부터 */
export function dueIds(s: WordStore): number[] {
  return [...s.progress.entries()]
    .filter(([, p]) => isDue(p, s.today))
    .sort(([a, p], [b, q]) => p.box - q.box || (p.due ?? "").localeCompare(q.due ?? "") || a - b)
    .map(([id]) => id);
}

/** 상자별 단어 수: [1단계, …, 5단계, 외움] */
export function boxCounts(s: WordStore): number[] {
  const c = [0, 0, 0, 0, 0, 0];
  for (const p of s.progress.values()) c[p.box - 1]++;
  return c;
}

export type DayStat = { seen: number; mastered: number; due: number; strong: number };
/** DAY별: 본 단어, 외운 단어(6), 오늘 복습, 4단계 이상 */
export function dayStats(s: WordStore): DayStat[] {
  const out: DayStat[] = Array.from({ length: WM_DAYS }, () => ({ seen: 0, mastered: 0, due: 0, strong: 0 }));
  for (const [id, p] of s.progress) {
    const d = out[dayOf(id) - 1];
    if (!d) continue;
    d.seen++;
    if (p.box === MASTERED) d.mastered++;
    if (p.box >= 4) d.strong++;
    if (isDue(p, s.today)) d.due++;
  }
  return out;
}

/** 다음에 외울 DAY — 안 본 단어가 남은 첫 DAY */
export function nextDay(stats: DayStat[]): number {
  const i = stats.findIndex((d) => d.seen < WORDS_PER_DAY);
  return i < 0 ? WM_DAYS : i + 1;
}

export const getBest = (s: WordStore, day: number, mode: QuizMode) => s.best.get(`${day}:${mode}`) ?? null;

/** DAY 칸에 보여 줄 점수: 퀴즈 최고 점수 중 가장 높은 것(%) */
export function dayBestScore(s: WordStore, day: number): number | null {
  const scores = (["meaning", "reverse", "blank", "relation"] as const)
    .map((m) => getBest(s, day, m))
    .filter((b): b is Best => !!b)
    .map((b) => (b.correct / b.total) * 100);
  return scores.length ? Math.round(Math.max(...scores)) : null;
}

const better = (a: Best, b: Best | null | undefined) =>
  !b || a.correct / a.total > b.correct / b.total || (a.correct / a.total === b.correct / b.total && a.total > b.total);

// ───────────────────────── 이 기기 저장 (07 실행 전·보낼 함) ─────────────────────────

const progressKey = (uid: string) => `wm:progress:${uid}`;
const outboxKey = (uid: string) => `wm:outbox:${uid}`;
const LEGACY_BEST = /^wm:best:(\d+):(meaning|blank)$/; // 예전 버전(기기에만 저장)의 최고 점수
const localBestKey = (uid: string) => `wm:best2:${uid}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 이번 화면에서만 기억
  }
}

type LocalProgress = Record<string, [number, string | null, number, number]>; // id → [box, due, seen, wrong]

function readLocalProgress(uid: string): Map<number, Progress> {
  const raw = readJson<LocalProgress>(progressKey(uid), {});
  const m = new Map<number, Progress>();
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (Number.isInteger(id) && id >= 1 && id <= 2000 && Array.isArray(v) && v[0] >= 1 && v[0] <= 6) m.set(id, { box: v[0], due: v[1], seen: v[2] ?? 1, wrong: v[3] ?? 0 });
  }
  return m;
}
function writeLocalProgress(uid: string, m: ReadonlyMap<number, Progress>) {
  const out: LocalProgress = {};
  for (const [id, p] of m) out[id] = [p.box, p.due, p.seen, p.wrong];
  writeJson(progressKey(uid), m.size ? out : null);
}

function readLocalBest(uid: string): Map<string, Best> {
  const m = new Map(Object.entries(readJson<Record<string, Best>>(localBestKey(uid), {})));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const g = k ? LEGACY_BEST.exec(k) : null;
      if (!g) continue;
      const b = readJson<Best | null>(k!, null);
      const key = `${g[1]}:${g[2]}`;
      if (b && b.total > 0 && better(b, m.get(key))) m.set(key, b);
    }
  } catch {
    // 무시
  }
  return m;
}
function clearLocalBest(uid: string) {
  writeJson(localBestKey(uid), null);
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && LEGACY_BEST.test(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // 무시
  }
}

// ───────────────────────── 서버 ─────────────────────────

type PgError = { code?: string; message?: string } | null;
/** 07-words.sql을 아직 실행 안 함 (테이블·함수 없음) */
const notReady = (e: PgError) => ["PGRST205", "PGRST202", "42P01", "42883"].includes(e?.code ?? "");

type Row = { word_id: number; box: number; due: string | null; seen?: number; wrong?: number };

async function fetchServer(): Promise<{ progress: Map<number, Progress>; best: Map<string, Best> } | "notReady"> {
  const sb = supabase();
  const progress = new Map<number, Progress>();
  // PostgREST는 한 번에 1000줄까지 → 두 번에 나눠 받는다
  for (let from = 0; from < 2000; from += 1000) {
    const { data, error } = await sb.from("word_progress").select("word_id, box, due, seen, wrong").order("word_id").range(from, from + 999);
    if (error) {
      if (notReady(error)) return "notReady";
      throw error;
    }
    for (const r of (data ?? []) as Row[]) progress.set(r.word_id, { box: r.box, due: r.due, seen: r.seen ?? 1, wrong: r.wrong ?? 0 });
    if ((data ?? []).length < 1000) break;
  }
  const best = new Map<string, Best>();
  const { data, error } = await sb.from("word_quiz_best").select("day, mode, correct, total");
  if (error && !notReady(error)) throw error;
  for (const r of (data ?? []) as { day: number; mode: string; correct: number; total: number }[]) best.set(`${r.day}:${r.mode}`, { correct: r.correct, total: r.total });
  return { progress, best };
}

async function ensureLoaded(userId: string, force = false) {
  if (!force && state.userId === userId && state.status !== "idle") return loading ?? undefined;
  if (loading) return loading;
  if (state.userId !== userId) state = { ...INITIAL, version: state.version + 1 };
  set({ status: state.status === "ready" ? "ready" : "loading", userId, today: kstToday() });
  loading = (async () => {
    const localProgress = readLocalProgress(userId);
    const localBest = readLocalBest(userId);
    try {
      const server = await fetchServer();
      if (server === "notReady") {
        set({ status: "ready", backend: "local", progress: localProgress, best: localBest, today: kstToday() });
        return;
      }
      const sb = supabase();
      // 이 기기에만 있던 진도를 계정으로 옮긴다 (계정에 이미 있는 단어는 그대로)
      if (localProgress.size) {
        const rows = [...localProgress].map(([id, p]) => ({ id, box: p.box, due: p.due, seen: p.seen, wrong: p.wrong }));
        const { error } = await sb.rpc("wm_import", { p_rows: rows });
        if (!error) {
          for (const [id, p] of localProgress) if (!server.progress.has(id)) server.progress.set(id, p);
          writeLocalProgress(userId, new Map());
        }
      }
      for (const [key, b] of localBest) {
        if (!better(b, server.best.get(key))) continue;
        const [day, mode] = key.split(":");
        const { error } = await sb.rpc("wm_save_quiz", { p_day: Number(day), p_mode: mode, p_correct: b.correct, p_total: b.total });
        if (!error) server.best.set(key, b);
      }
      if (localBest.size) clearLocalBest(userId);
      set({ status: "ready", backend: "server", progress: server.progress, best: server.best, today: kstToday() });
      loadedAt = Date.now();
      await flushOutbox(userId);
    } catch {
      // 인터넷이 안 되면 이 기기 기록이라도 보여 준다 (다음에 다시 불러옴)
      set({ status: "ready", backend: state.backend, progress: state.progress.size ? state.progress : localProgress, best: state.best.size ? state.best : localBest, today: kstToday() });
    }
  })().finally(() => {
    loading = null;
  });
  return loading;
}

async function flushOutbox(uid: string) {
  const box = readJson<Answer[]>(outboxKey(uid), []);
  if (!box.length) return;
  writeJson(outboxKey(uid), null);
  await send(uid, box);
}

/** 서버에 보내고 돌아온 단계로 맞춘다. 실패하면 보낼 함에 넣는다 */
async function send(uid: string, answers: Answer[]) {
  for (let i = 0; i < answers.length; i += 200) {
    const chunk = answers.slice(i, i + 200);
    const { data, error } = await supabase().rpc("wm_record", { p_results: chunk });
    if (error) {
      if (notReady(error)) {
        set({ backend: "local" });
        writeLocalProgress(uid, state.progress);
        return;
      }
      writeJson(outboxKey(uid), [...readJson<Answer[]>(outboxKey(uid), []), ...answers.slice(i)].slice(-2000));
      return;
    }
    if (state.userId !== uid) return;
    const next = new Map(state.progress);
    for (const r of (data ?? []) as Row[]) {
      const prev = next.get(r.word_id);
      next.set(r.word_id, { box: r.box, due: r.due, seen: prev?.seen ?? 1, wrong: prev?.wrong ?? 0 });
    }
    set({ progress: next });
  }
}

// ───────────────────────── 기록하기 ─────────────────────────

/** 답한 결과 기록 (암기 카드 알아요/몰라요, 퀴즈·복습 정답/오답). 화면은 바로 바뀐다 */
export function recordAnswers(answers: Answer[]): Promise<void> {
  const uid = state.userId;
  if (!uid || !answers.length) return Promise.resolve();
  const today = kstToday();
  const next = new Map(state.progress);
  for (const a of answers) next.set(a.id, nextProgress(next.get(a.id), a.ok, today));
  set({ progress: next, today });
  if (state.backend === "local") {
    writeLocalProgress(uid, next);
    return Promise.resolve();
  }
  return send(uid, answers).catch(() => {
    writeJson(outboxKey(uid), [...readJson<Answer[]>(outboxKey(uid), []), ...answers].slice(-2000));
  });
}

/** 퀴즈 결과 저장 (최고 점수만 남음) */
export async function saveQuizResult(day: number, mode: QuizMode, result: Best) {
  const uid = state.userId;
  if (!uid || result.total < 1) return;
  const key = `${day}:${mode}`;
  if (better(result, state.best.get(key))) set({ best: new Map(state.best).set(key, result) });
  if (state.backend === "local") {
    writeJson(localBestKey(uid), Object.fromEntries(state.best));
    return;
  }
  const { error } = await supabase().rpc("wm_save_quiz", { p_day: day, p_mode: mode, p_correct: result.correct, p_total: result.total });
  if (error) writeJson(localBestKey(uid), Object.fromEntries(state.best)); // 다음에 불러올 때 다시 보낸다
}

/** DAY 하나(null이면 전부) 진도 지우기 */
export async function resetProgress(day: number | null): Promise<boolean> {
  const uid = state.userId;
  if (!uid) return false;
  if (state.backend === "server") {
    const { error } = await supabase().rpc("wm_reset", { p_day: day });
    if (error && !notReady(error)) return false;
  }
  const next = new Map([...state.progress].filter(([id]) => day !== null && dayOf(id) !== day));
  set({ progress: next });
  if (state.backend === "local") writeLocalProgress(uid, next);
  return true;
}
