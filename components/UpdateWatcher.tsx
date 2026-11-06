"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";

/**
 * 새 배포를 열려 있는 앱에 바로 반영한다 (웹·홈 화면 앱·안드로이드 APK 모두).
 * APK는 배포된 웹 주소를 여는 껍데기라 앱을 새로 열면 항상 최신이지만, 휴대폰이 앱을 메모리에 오래 들고 있으면
 * 예전 화면이 계속 돌 수 있다. 그래서:
 *  - 10분마다, 그리고 앱으로 다시 돌아올 때 /api/version을 물어봐서 지금 화면의 버전과 비교한다
 *  - 앱으로 돌아온 순간 새 버전이 있고 공부 중이 아니면 → 바로 새로 불러온다 (사용자는 그냥 앱을 다시 연 것처럼 느낌)
 *  - 공부 중이거나 쓰고 있는 중이면 → 아래에 "새 버전" 알림만 띄운다 (누르면 업데이트)
 * 공부 기록은 서버에 있으므로 새로 불러와도 타이머는 이어진다.
 */
const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const CHECK_EVERY_MS = 10 * 60_000;
const RELOADED_KEY = "daego-reloaded-for"; // 같은 버전 때문에 계속 새로고침하지 않게

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const v = (await res.json()) as { version?: string };
    return v.version ?? null;
  } catch {
    return null; // 인터넷이 끊겼으면 다음에
  }
}

function alreadyReloadedFor(v: string): boolean {
  try {
    return sessionStorage.getItem(RELOADED_KEY) === v;
  } catch {
    return false;
  }
}

function reloadFor(v: string) {
  try {
    sessionStorage.setItem(RELOADED_KEY, v);
  } catch {
    // 저장이 막혀도 새로고침은 한다
  }
  window.location.reload();
}

export default function UpdateWatcher() {
  const study = useStudy();
  const [next, setNext] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    running.current = !!study.running;
  }, [study.running]);

  const check = useCallback(async (fromBackground: boolean) => {
    if (CURRENT === "dev") return;
    const v = await latestVersion();
    if (!v || v === CURRENT) return;
    if (fromBackground && !running.current && !alreadyReloadedFor(v)) {
      reloadFor(v);
      return;
    }
    setNext(v);
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void check(false), 5_000);
    const id = setInterval(() => void check(false), CHECK_EVERY_MS);
    let leftAt = 0;
    const onVis = () => {
      if (document.hidden) leftAt = Date.now();
      else if (leftAt) void check(Date.now() - leftAt > 3_000); // 잠깐 다른 앱에 갔다 왔을 때
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [check]);

  if (!next || hidden) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[55] mx-auto w-full max-w-md px-4" role="status">
      <div className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-accent/50 bg-surface px-4 py-3 shadow-lg">
        <RefreshCw size={18} className="shrink-0 text-accent" />
        <p className="min-w-0 flex-1 text-[13px] leading-snug">
          <b>새 버전이 나왔어요</b>
          <span className="block text-[12px] text-muted">{study.running ? "공부 기록은 그대로 이어져요" : "눌러서 바로 업데이트하세요"}</span>
        </p>
        <button type="button" onClick={() => reloadFor(next)} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-bg">
          업데이트
        </button>
        <button type="button" onClick={() => setHidden(true)} aria-label="나중에" className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-faint">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
