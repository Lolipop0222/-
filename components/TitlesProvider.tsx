"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useStudy } from "@/components/StudyProvider";
import { TitleBadge } from "@/components/TitleBadge";
import { notReady } from "@/lib/account";
import { GRADE_RANK, TITLE_CHECK_EVENT, checkTitles, loadMyTitles, type MyTitle, type NewTitle } from "@/lib/titles";

/**
 * 칭호 판정을 부르는 곳 + 새 칭호 알림(토스트).
 * 예약 작업(cron)이 없어서 이런 때에 서버 판정(check_titles)을 부른다:
 *  앱 열기(로그인 확인 직후) · 공부 기록이 바뀔 때(시작·종료) · 플래너 과제 완료 · 내정보/칭호 화면 열기
 * 서버가 "아직 알림을 안 띄운 칭호"만 돌려주므로 여러 번 불러도 알림은 한 번만 뜬다. 소리는 내지 않는다.
 */
type TitlesContext = {
  /** 판정을 다시 부른다 (새 칭호가 있으면 알림). 끝나면 version이 오른다 */
  check: () => Promise<void>;
  /** 판정이 끝날 때마다 오르는 숫자 — 칭호 목록 화면이 이걸 보고 다시 불러온다 */
  version: number;
  /** DB에 칭호 기능이 없으면(schema.sql 다시 실행 전) false */
  available: boolean;
};

const Ctx = createContext<TitlesContext | null>(null);

export function useTitles(): TitlesContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("TitlesProvider 밖에서 useTitles를 썼습니다");
  return v;
}

type Toast = { id: number; titles: NewTitle[] };

export default function TitlesProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const study = useStudy();
  const ready = auth.status === "ready";
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [version, setVersion] = useState(0);
  const [available, setAvailable] = useState(true);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const toastId = useRef(0);

  const runOnce = useCallback(async () => {
    try {
      const fresh = await checkTitles();
      if (fresh.length > 0) {
        const id = ++toastId.current;
        setToasts((list) => [...list.slice(-2), { id, titles: fresh }]);
        setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
      }
      setVersion((v) => v + 1);
    } catch (e) {
      if (notReady(e)) setAvailable(false);
      // 인터넷이 끊기는 등은 다음 기회에 다시 판정한다
    }
  }, []);

  // 동시에 여러 번 불리면 하나로 묶는다 (도는 중에 또 불리면 끝나고 한 번 더)
  const check = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    running.current = (async () => {
      do {
        again.current = false;
        await runOnce();
      } while (again.current);
    })().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [runOnce]);

  // 앱 열기 + 공부 기록이 바뀔 때 (study.version은 시작·종료·새로고침 때 오른다)
  useEffect(() => {
    if (!ready || !available) return;
    const t = setTimeout(() => void check(), 400);
    return () => clearTimeout(t);
  }, [ready, available, study.version, check]);

  // 플래너 과제 완료 등 다른 화면의 신호
  useEffect(() => {
    if (!ready) return;
    const on = () => void check();
    window.addEventListener(TITLE_CHECK_EVENT, on);
    return () => window.removeEventListener(TITLE_CHECK_EVENT, on);
  }, [ready, check]);

  return (
    <Ctx.Provider value={{ check, version, available }}>
      {children}
      {ready && toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-4 pt-[calc(env(safe-area-inset-top)+10px)]" aria-live="polite">
          {toasts.map((t) => (
            <TitleToast key={t.id} toast={t} onClose={() => setToasts((list) => list.filter((x) => x.id !== t.id))} />
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

function TitleToast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  // 여러 개면 가장 높은 등급을 앞에
  const sorted = [...toast.titles].sort((a, b) => GRADE_RANK[b.grade] - GRADE_RANK[a.grade]);
  const top = sorted[0];
  const more = sorted.length - 1;
  return (
    <Link
      href="/me/titles"
      onClick={onClose}
      className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-lg"
    >
      <span className="text-[13px] font-semibold text-muted">칭호 획득</span>
      <span className="min-w-0 flex-1">
        <TitleBadge name={top.name} grade={top.grade} size="md" />
      </span>
      {more > 0 && <span className="shrink-0 text-[12px] text-muted">외 {more}개</span>}
    </Link>
  );
}

/**
 * 내 칭호 목록 (my_titles). 판정이 끝날 때마다(version) 다시 불러온다.
 * null = 불러오는 중, available=false = DB에 칭호 기능이 아직 없음
 */
export function useMyTitles(): { titles: MyTitle[] | null; reload: () => Promise<void>; available: boolean } {
  const { version, available } = useTitles();
  const [titles, setTitles] = useState<MyTitle[] | null>(null);
  const [ok, setOk] = useState(true);

  const reload = useCallback(async () => {
    try {
      setTitles(await loadMyTitles());
    } catch (e) {
      if (notReady(e)) setOk(false);
      setTitles((t) => t ?? []);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadMyTitles().then(
      (t) => alive && setTitles(t),
      (e) => {
        if (!alive) return;
        if (notReady(e)) setOk(false);
        setTitles((t) => t ?? []);
      },
    );
    return () => {
      alive = false;
    };
  }, [version]);

  return { titles, reload, available: available && ok };
}
