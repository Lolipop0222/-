"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Play, Square } from "lucide-react";
import { hm, hms } from "@/lib/format";
import { SUBJECTS, SUBJECT_COLOR, todayStudy, weekStudy, type Subject } from "@/lib/mock";

const AWAY_LIMIT_MS = 30_000;

/**
 * 공부 타이머 화면.
 * 표시되는 숫자는 (현재 시각 − 시작 시각)을 계산할 뿐, 1초씩 누적해서 세지 않는다.
 * 지금은 UI 단계라 시작 시각을 브라우저에 두지만, 1단계에서 Supabase의 서버 시각(started_at)으로 바꾼다.
 */
export default function StudyTimer() {
  const [subject, setSubject] = useState<Subject>("수학");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [awayCount, setAwayCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedSec, setSavedSec] = useState(0);
  const hiddenAt = useRef<number | null>(null);

  const running = startedAt !== null;
  const elapsed = running ? Math.max(0, (now - startedAt) / 1000) : 0;

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  // 이탈 감지 — 다른 앱으로 가서 30초가 넘으면 자동 정지
  useEffect(() => {
    if (!running) return;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        setAwayCount((c) => c + 1);
      } else if (hiddenAt.current) {
        const leftAt = hiddenAt.current;
        hiddenAt.current = null;
        if (Date.now() - leftAt > AWAY_LIMIT_MS) {
          // 벗어난 시간은 공부 시간에서 뺀다
          stop(leftAt);
          setNotice("30초 넘게 앱을 벗어나서 자동으로 멈췄어요");
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start() {
    setNotice(null);
    setAwayCount(0);
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  }

  function stop(endAt = Date.now()) {
    if (startedAt === null) return;
    setSavedSec((s) => s + Math.max(0, (endAt - startedAt) / 1000));
    setStartedAt(null);
  }

  const today = todayStudy.totalSec + savedSec + elapsed;

  return (
    <section className="bg-black px-5 pb-8 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-muted">일품타</h1>
        {running && (
          <span className="flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-1 text-[12px] font-semibold text-live">
            <span className="live-dot size-1.5 rounded-full bg-live" />
            공부 중
          </span>
        )}
      </div>

      {/* 과목 선택 */}
      <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
        {SUBJECTS.map((s) => {
          const active = s === subject;
          return (
            <button
              key={s}
              disabled={running}
              onClick={() => setSubject(s)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
                active ? "border-transparent text-black" : "border-line text-muted disabled:opacity-30"
              }`}
              style={active ? { background: SUBJECT_COLOR[s] } : undefined}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* 큰 숫자 */}
      <div className="py-12 text-center">
        <p className="text-[14px] font-medium" style={{ color: SUBJECT_COLOR[subject] }}>
          {subject}
        </p>
        <p className="num mt-2 text-[64px] font-bold leading-none text-white">{hms(elapsed)}</p>
        <p className="mt-4 flex items-center justify-center gap-1 text-[13px] text-faint">
          <Eye size={14} /> 이탈 {awayCount}회 · 30초 넘게 벗어나면 자동 정지
        </p>
      </div>

      {notice && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-center text-[13px] text-warn">{notice}</p>}

      {/* 시작 / 정지 */}
      <div className="flex justify-center">
        {running ? (
          <button
            onClick={() => stop()}
            aria-label="정지"
            className="grid size-24 place-items-center rounded-full bg-danger text-black shadow-[0_0_0_10px_rgba(255,107,107,0.12)] active:scale-95"
          >
            <Square size={30} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={start}
            aria-label="시작"
            className="grid size-24 place-items-center rounded-full bg-white text-black shadow-[0_0_0_10px_rgba(255,255,255,0.08)] active:scale-95"
          >
            <Play size={34} fill="currentColor" className="ml-1" />
          </button>
        )}
      </div>

      {/* 오늘 / 이번 주 */}
      <div className="mt-10 grid grid-cols-2 divide-x divide-line rounded-2xl bg-surface">
        <div className="p-4 text-center">
          <p className="text-[12px] text-muted">오늘 총 공부</p>
          <p className="num mt-1 text-[18px] font-bold">{hm(today)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-[12px] text-muted">이번 주 총합</p>
          <p className="num mt-1 text-[18px] font-bold">{hm(weekStudy.totalSec + savedSec + elapsed)}</p>
        </div>
      </div>
    </section>
  );
}
