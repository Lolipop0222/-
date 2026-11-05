"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { koreanError } from "@/lib/supabase";
import { endSession, loadWeekSessions, startSession, summarize, type StudySession, type StudySummary } from "@/lib/study";
import type { Subject } from "@/lib/subjects";

const AWAY_LIMIT_MS = 30_000;
const OFFSET_KEY = "study:clockOffset"; // 서버 시각 − 기기 시각 (표시용)

type StudyContext = {
  ready: boolean; // 이번 주 기록을 다 불러왔는지
  running: StudySession | null;
  /** 진행 중인 세션의 경과 초 (서버 시각 기준으로 보정) */
  elapsed: number;
  summary: StudySummary;
  awayCount: number;
  notice: string | null;
  busy: boolean;
  /** taskId: 플래너 과제와 연결해서 시작 */
  start: (subject: Subject, taskId?: string | null) => Promise<void>;
  stop: () => Promise<void>;
  /** 순위 등 다른 화면이 기록이 바뀐 걸 알 수 있게 — 저장할 때마다 1씩 오른다 */
  version: number;
  /** 다른 화면에서 기록을 직접 고친 뒤(기타 기록) 다시 불러오기 */
  refresh: () => Promise<void>;
};

const Ctx = createContext<StudyContext | null>(null);

export function useStudy(): StudyContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("StudyProvider 밖에서 useStudy를 썼습니다");
  return v;
}

function readOffset(): number {
  try {
    return Number(localStorage.getItem(OFFSET_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * 공부 기록 상태 (타이머·홈·순위가 같이 쓴다).
 * 시작·종료 시각은 서버가 정한다. 화면의 숫자는 (지금 − 시작 시각)을 계산해서 보여 줄 뿐이라
 * 화면이 꺼졌다 켜져도, 다른 탭으로 갔다 와도 정확하다.
 */
export default function StudyProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.status === "ready" ? auth.user.id : null;

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0); // 기록을 불러올 때 채운다
  const [offset, setOffset] = useState(0);
  const [awayCount, setAwayCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const leftAt = useRef<number | null>(null);

  const running = sessions.find((s) => !s.ended_at) ?? null;
  const serverNow = now + offset;

  // 로그인하면 이번 주 기록을 불러온다
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const t = Date.now();
    loadWeekSessions(t).then(
      (rows) => {
        if (!alive) return;
        setOffset(readOffset());
        setNow(t);
        setSessions(rows);
        setReady(true);
      },
      (e) => alive && setNotice(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  // 진행 중이면 화면 숫자를 갱신
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const stopAt = useCallback(
    async (endAt?: number) => {
      if (!running) return;
      setBusy(true);
      try {
        const ended = await endSession(running.id, awayCount, endAt ? endAt + offset : undefined);
        setSessions((list) => list.map((s) => (s.id === ended.id ? ended : s)));
        setVersion((v) => v + 1);
      } catch (e) {
        setNotice(`저장하지 못했어요: ${koreanError(e)}`);
      } finally {
        setBusy(false);
        setNow(Date.now());
      }
    },
    [running, awayCount, offset],
  );

  const start = useCallback(
    async (subject: Subject, taskId?: string | null) => {
      setBusy(true);
      setNotice(null);
      try {
        const before = Date.now();
        const s = await startSession(subject, taskId);
        // 서버가 찍은 시작 시각으로 기기 시계와의 차이를 잰다 (왕복 시간의 절반만큼 보정)
        const after = Date.now();
        const off = Date.parse(s.started_at) - (before + after) / 2;
        setOffset(off);
        try {
          localStorage.setItem(OFFSET_KEY, String(off));
        } catch {
          // 저장소를 못 쓰면 보정 없이 진행
        }
        // 켜져 있던 세션은 서버가 끝냈다 → 목록을 다시 불러온다
        const rows = await loadWeekSessions(after);
        setSessions(rows.some((r) => r.id === s.id) ? rows : [...rows, s]);
        setAwayCount(0);
        setVersion((v) => v + 1);
      } catch (e) {
        setNotice(koreanError(e));
      } finally {
        setBusy(false);
        setNow(Date.now());
      }
    },
    [],
  );

  // 이탈 감지 — 다른 앱으로 가면 횟수를 세고, 30초 넘게 비우면 벗어난 순간으로 자동 정지
  useEffect(() => {
    if (!running) return;
    const onVis = () => {
      if (document.hidden) {
        leftAt.current = Date.now();
        setAwayCount((c) => c + 1);
      } else if (leftAt.current) {
        const t = leftAt.current;
        leftAt.current = null;
        if (Date.now() - t > AWAY_LIMIT_MS) {
          stopAt(t).then(() => setNotice("30초 넘게 앱을 벗어나서 자동으로 멈췄어요. 벗어난 시간은 빠졌어요."));
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running, stopAt]);

  const refresh = useCallback(async () => {
    const t = Date.now();
    const rows = await loadWeekSessions(t);
    setSessions(rows);
    setNow(t);
    setVersion((v) => v + 1);
  }, []);

  const value: StudyContext = {
    ready,
    running,
    elapsed: running ? Math.max(0, Math.floor((serverNow - Date.parse(running.started_at)) / 1000)) : 0,
    summary: summarize(sessions, serverNow),
    awayCount,
    notice,
    busy,
    start,
    stop: () => stopAt(),
    version,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
