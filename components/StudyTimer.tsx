"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ClipboardList, Eye, MonitorPlay, Play, Square } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useStudy } from "@/components/StudyProvider";
import { kstToday } from "@/lib/dday";
import { hm, hms } from "@/lib/format";
import { ETC, SUBJECTS, SUBJECT_COLOR, canLecture, detailsFor, type Subject } from "@/lib/subjects";
import { usePlanner } from "@/lib/usePlanner";

/**
 * 공부 타이머. 시작·정지는 서버 시각으로 기록된다 (components/StudyProvider.tsx).
 * 배경은 검정, 숫자는 흰색으로 크게 — 자습실에서 어둡게 쓰는 화면.
 */
export default function StudyTimer() {
  const study = useStudy();
  const auth = useAuth();
  const track = auth.status === "ready" ? auth.profile.track ?? null : null;
  const [picked, setPicked] = useState<Subject>("수학");
  const [pickedDetail, setPickedDetail] = useState<string | null>(null); // 세부 항목 (계열에 따라 목록이 다름)
  const [pickedLecture, setPickedLecture] = useState(false); // 인강 — 공부 합계·순위 제외
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
  const detail = study.running ? study.running.detail : pickedDetail;
  const lecture = study.running ? study.running.lecture : pickedLecture;
  const running = !!study.running;
  const details = detailsFor(track, picked);
  // 계열을 아직 안 골랐는데 세부 항목이 있는 과목이면 안내
  const needTrack = !track && (detailsFor("문과", picked).length > 0 || detailsFor("이과", picked).length > 0);

  function pickSubject(s: Subject) {
    setPicked(s);
    setPickedDetail(null);
    if (!canLecture(s)) setPickedLecture(false);
  }

  function pickTask(id: string | null) {
    setTaskId(id);
    const t = planner.tasks.find((x) => x.id === id);
    if (t?.subject) {
      // 과제의 과목·세부 항목·인강으로 맞춘다
      setPicked(t.subject);
      setPickedDetail(t.detail ?? null);
      setPickedLecture(!!t.lecture && canLecture(t.subject));
    }
  }

  return (
    <section className="bg-stage text-stage-text px-5 pb-8 pt-[calc(env(safe-area-inset-top)+20px)]">
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
              onClick={() => pickSubject(s)}
              className={`rounded-full border py-2 text-[14px] font-semibold transition-colors ${
                active ? "border-transparent text-on-subject" : "border-line text-muted disabled:opacity-30"
              }`}
              style={active ? { background: SUBJECT_COLOR[s] } : undefined}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* 세부 항목 + 인강 (공부 중에는 바꿀 수 없다) */}
      {!running && (details.length > 0 || canLecture(picked) || needTrack) && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="세부 항목">
          {details.map((d) => {
            const on = pickedDetail === d;
            return (
              <button
                key={d}
                type="button"
                disabled={study.busy}
                aria-pressed={on}
                onClick={() => setPickedDetail(on ? null : d)}
                className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${on ? "border-transparent text-on-subject" : "border-line text-muted"}`}
                style={on ? { background: SUBJECT_COLOR[picked] } : undefined}
              >
                {d}
              </button>
            );
          })}
          {canLecture(picked) && (
            <button
              type="button"
              disabled={study.busy}
              aria-pressed={pickedLecture}
              onClick={() => setPickedLecture((v) => !v)}
              className={`lecture-chip flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${pickedLecture ? "border-text text-text" : "border-dashed border-line text-muted"}`}
              style={pickedLecture ? ({ "--chip": SUBJECT_COLOR[picked] } as CSSProperties) : undefined}
            >
              <MonitorPlay size={13} /> 인강
            </button>
          )}
          {needTrack && (
            <Link href="/me/track" className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-accent underline underline-offset-2">
              계열을 고르면 세부 과목이 나와요
            </Link>
          )}
        </div>
      )}
      {!running && pickedLecture && canLecture(picked) && (
        <p className="mt-2 text-[12px] text-faint">인강은 TIMETABLE에는 표시되지만 총 공부 시간·순위에는 들어가지 않아요.</p>
      )}

      {/* 큰 숫자 */}
      <div className="py-12 text-center">
        <p className="text-[14px] font-medium" style={{ color: SUBJECT_COLOR[subject] }}>
          {subject}
          {detail && <span> · {detail}</span>}
          {lecture && <span className="text-muted"> · 인강</span>}
          {running && runningTask && <span className="text-muted"> · {runningTask.title}</span>}
        </p>
        <p className="num mt-2 text-[64px] font-bold leading-none text-stage-text">{hms(study.elapsed)}</p>
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
            className="grid size-24 place-items-center rounded-full bg-danger text-bg shadow-[0_0_0_10px_var(--danger-soft)] active:scale-95 disabled:opacity-50"
          >
            <Square size={30} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => study.start(picked, { taskId, detail: details.includes(pickedDetail ?? "") ? pickedDetail : null, lecture: pickedLecture && canLecture(picked) })}
            disabled={study.busy || !study.ready}
            aria-label="시작"
            className="grid size-24 place-items-center rounded-full bg-text text-bg shadow-[0_0_0_10px_color-mix(in_srgb,var(--text)_10%,transparent)] active:scale-95 disabled:opacity-50"
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
        <li className="rounded-xl bg-surface px-1 py-2.5" title="인강은 총 공부 시간에 들어가지 않아요">
          <p className="flex items-center justify-center gap-0.5 text-[11px] font-semibold text-muted">
            <MonitorPlay size={11} /> 인강
          </p>
          <p className="num mt-0.5 text-[12px] text-faint">{shortHm(study.summary.todayLectureSec)}</p>
        </li>
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
