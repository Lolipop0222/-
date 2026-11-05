"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, Eye, Play, Square } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { kstToday } from "@/lib/dday";
import { hm, hms } from "@/lib/format";
import { ETC, SUBJECTS, SUBJECT_COLOR, type Subject } from "@/lib/subjects";
import { usePlanner } from "@/lib/usePlanner";

/**
 * 공부 타이머. 시작·정지는 서버 시각으로 기록된다 (components/StudyProvider.tsx).
 * 배경은 검정, 숫자는 흰색으로 크게 — 자습실에서 어둡게 쓰는 화면.
 */
export default function StudyTimer() {
  const study = useStudy();
  const [picked, setPicked] = useState<Subject>("수학");
  const [taskId, setTaskId] = useState<string | null>(null); // 연결할 플래너 과제
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setToday(kstToday()), 0);
    return () => clearTimeout(id);
  }, []);
  const planner = usePlanner(today);
  const openTasks = planner.tasks.filter((t) => !t.done || t.id === taskId);
  const runningTask = planner.tasks.find((t) => t.id === study.running?.task_id);
  const subject = study.running?.subject ?? picked;
  const running = !!study.running;

  function pickTask(id: string | null) {
    setTaskId(id);
    const t = planner.tasks.find((x) => x.id === id);
    if (t?.subject) setPicked(t.subject); // 과제의 과목으로 맞춘다
  }

  return (
    <section className="bg-black px-5 pb-8 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-muted">일품타</h1>
        <Link href="/planner" className="ml-auto mr-2 flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-muted">
          <ClipboardList size={14} /> 플래너
        </Link>
        {running && (
          <span className="flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-1 text-[12px] font-semibold text-live">
            <span className="live-dot size-1.5 rounded-full bg-live" />
            공부 중
          </span>
        )}
      </div>

      {/* 과제 연결 (플래너 TASKS) — 고르면 그 과제의 과목으로 맞춰진다 */}
      {!running && openTasks.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
          <TaskChip active={taskId === null} onClick={() => pickTask(null)} label="과제 없이" />
          {openTasks.map((t) => (
            <TaskChip key={t.id} active={taskId === t.id} onClick={() => pickTask(t.id)} label={t.title} color={t.subject ? SUBJECT_COLOR[t.subject] : undefined} />
          ))}
        </div>
      )}

      {/* 과목 선택 (공부 중에는 바꿀 수 없다) */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {SUBJECTS.map((s) => {
          const active = s === subject;
          return (
            <button
              key={s}
              disabled={running || study.busy}
              onClick={() => setPicked(s)}
              className={`rounded-full border py-2 text-[14px] font-semibold transition-colors ${
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
          {running && runningTask && <span className="text-muted"> · {runningTask.title}</span>}
        </p>
        <p className="num mt-2 text-[64px] font-bold leading-none text-white">{hms(study.elapsed)}</p>
        <p className="mt-4 flex items-center justify-center gap-1 text-[13px] text-faint">
          <Eye size={14} /> 이탈 {running ? study.awayCount : 0}회 · 30초 넘게 벗어나면 자동 정지
        </p>
      </div>

      {subject === ETC && (
        <p className="mb-4 text-center text-[12px] text-faint">
          기타는 순위·공부 합계에 안 들어가요 ·{" "}
          <Link href="/timer/etc" className="font-semibold text-muted underline underline-offset-2">
            기타 기록 보기·고치기
          </Link>
        </p>
      )}
      {study.notice && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-center text-[13px] text-warn">{study.notice}</p>}

      {/* 시작 / 정지 */}
      <div className="flex justify-center">
        {running ? (
          <button
            onClick={() => study.stop()}
            disabled={study.busy}
            aria-label="정지"
            className="grid size-24 place-items-center rounded-full bg-danger text-black shadow-[0_0_0_10px_rgba(255,107,107,0.12)] active:scale-95 disabled:opacity-50"
          >
            <Square size={30} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => study.start(picked, taskId)}
            disabled={study.busy || !study.ready}
            aria-label="시작"
            className="grid size-24 place-items-center rounded-full bg-white text-black shadow-[0_0_0_10px_rgba(255,255,255,0.08)] active:scale-95 disabled:opacity-50"
          >
            <Play size={34} fill="currentColor" className="ml-1" />
          </button>
        )}
      </div>

      {/* 오늘 / 이번 주 */}
      <div className="mt-10 grid grid-cols-2 divide-x divide-line rounded-2xl bg-surface">
        <div className="p-4 text-center">
          <p className="text-[12px] text-muted">오늘 총 공부</p>
          <p className="num mt-1 text-[18px] font-bold">{hm(study.summary.todaySec)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-[12px] text-muted">이번 주 총합</p>
          <p className="num mt-1 text-[18px] font-bold">{hm(study.summary.weekSec)}</p>
        </div>
      </div>

      {/* 오늘 과목별 */}
      <ul className="mt-3 grid grid-cols-4 gap-2 text-center">
        {SUBJECTS.map((s) => (
          <li key={s} className="rounded-xl bg-surface px-1 py-2.5">
            <p className="text-[11px] font-semibold" style={{ color: SUBJECT_COLOR[s] }}>
              {s}
            </p>
            <p className="num mt-0.5 text-[12px] text-muted">{shortHm(study.summary.todayBySubject[s])}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-medium ${
        active ? "border-accent bg-accent-soft text-text" : "border-line text-muted"
      }`}
    >
      {color && <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** 5400 → "1:30", 300 → "5분", 0 → "-" */
function shortHm(sec: number) {
  if (sec < 60) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")}` : `${m}분`;
}
