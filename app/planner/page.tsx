"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Play, Repeat, Square, X } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { SubHeader } from "@/components/ui";
import { daysUntil, ddayLabel, kstToday } from "@/lib/dday";
import { WEEKDAYS, fromYmd, hm } from "@/lib/format";
import { TIMETABLE_HOURS, addDays, secondsByTask, timetableCells, totalSeconds, type Task } from "@/lib/planner";
import { SUBJECTS, SUBJECT_COLOR, guessSubject, type Subject } from "@/lib/subjects";
import { useDdays } from "@/lib/useDdays";
import { usePlanner, type PlannerState } from "@/lib/usePlanner";

/**
 * 플래너 — 종이 플래너(YEAR/MONTH/DAY · D-DAY · COMMENT · TOTAL TIME · TASKS · TIMETABLE · MEMO) 그대로.
 * TASKS에 적은 과제로 타이머를 켜면 그 과목 공부 시간이 되고, TIMETABLE은 공부 기록으로 저절로 칠해진다.
 */
export default function PlannerPage() {
  const study = useStudy();
  const ddays = useDdays();
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const p = usePlanner(date);

  // 날짜·현재 시각은 브라우저에서만 정한다
  useEffect(() => {
    const t = kstToday();
    const id = setTimeout(() => {
      setToday(t);
      setDate(t);
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(id);
  }, []);
  // 공부 중이면 과제 시간·TOTAL TIME이 흐르게
  useEffect(() => {
    if (!study.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [study.running]);

  const sessions = useMemo(() => {
    // 저장된 기록 + 지금 진행 중인 세션 (목록을 다시 받기 전에도 바로 보이게)
    const r = study.running;
    return r && !p.sessions.some((s) => s.id === r.id) ? [...p.sessions, r] : p.sessions;
  }, [p.sessions, study.running]);
  const total = totalSeconds(sessions, p.dayStart, now);
  const byTask = secondsByTask(sessions, p.dayStart, now);
  const cells = useMemo(() => timetableCells(sessions, p.dayStart, now), [sessions, p.dayStart, now]);
  const nextDday = ddays.items.find((i) => i.kind === "exam" || daysUntil(i.date, ddays.today) >= 0);

  if (!date || !today) return <SubHeader title="플래너" back="/" />;
  const d = fromYmd(date);
  const isToday = date === today;

  return (
    <>
      <SubHeader title="플래너" back="/" right={<Link href="/planner/routines" className="mr-2 flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-muted"><Repeat size={14} /> 루틴</Link>} />

      <div className="px-4 pb-6">
        {/* YEAR / MONTH / DAY · D-DAY */}
        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3">
          <Field label="YEAR / MONTH / DAY">
            <div className="flex items-center gap-1">
              <button aria-label="전날" onClick={() => setDate(addDays(date, -1))} className="-ml-1 grid size-7 place-items-center rounded-full text-muted active:bg-surface-2">
                <ChevronLeft size={18} />
              </button>
              <span className="num text-[16px] font-semibold">
                {d.getFullYear()} / {String(d.getMonth() + 1).padStart(2, "0")} / {String(d.getDate()).padStart(2, "0")}
                <span className="ml-1 text-muted">({WEEKDAYS[d.getDay()]})</span>
              </span>
              <button aria-label="다음 날" onClick={() => setDate(addDays(date, 1))} className="grid size-7 place-items-center rounded-full text-muted active:bg-surface-2">
                <ChevronRight size={18} />
              </button>
              {!isToday && (
                <button onClick={() => setDate(today)} className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                  오늘
                </button>
              )}
            </div>
          </Field>
          <Field label="D-DAY">
            <Link href="/dday" className="block max-w-[120px] truncate text-right text-[14px]">
              {nextDday ? (
                <>
                  <span className="num font-bold text-accent">{ddayLabel(Math.max(0, daysUntil(nextDday.date, ddays.today)))}</span>{" "}
                  <span className="text-muted">{nextDday.title}</span>
                </>
              ) : (
                <span className="text-faint">–</span>
              )}
            </Link>
          </Field>

          {/* COMMENT · TOTAL TIME */}
          <Field label="COMMENT">
            <CommentInput key={`${date}:${p.ready}`} value={p.day.comment} disabled={p.unavailable} onSave={(comment) => p.saveDay({ comment })} />
          </Field>
          <Field label="TOTAL TIME">
            <p className="num text-right text-[20px] font-bold">{hm(total)}</p>
          </Field>
        </div>

        {p.unavailable && (
          <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn">과제·루틴 저장은 아직 준비 중이에요. TIMETABLE과 TOTAL TIME은 지금도 공부 기록으로 채워져요.</p>
        )}
        {p.error && <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger">{p.error}</p>}

        {/* TASKS + MEMO | TIMETABLE */}
        <div className="mt-5 grid grid-cols-[1fr_128px] gap-3">
          <div className="min-w-0">
            <Label>TASKS</Label>
            <TaskList p={p} byTask={byTask} isToday={isToday} />
            <div className="mt-5">
              <Label>MEMO</Label>
              <MemoInput key={`${date}:${p.ready}`} value={p.day.memo} disabled={p.unavailable} onSave={(memo) => p.saveDay({ memo })} />
            </div>
          </div>
          <div>
            <Label>TIMETABLE</Label>
            <Timetable cells={cells} />
          </div>
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 border-b border-line pb-1 text-[10px] font-semibold tracking-[0.12em] text-faint">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-faint">{label}</p>
      <div className="mt-1 border-b border-line pb-1.5">{children}</div>
    </div>
  );
}

function CommentInput({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value); // 날짜가 바뀌거나 불러오면 key로 새로 그려서 처음 값을 맞춘다
  return (
    <input
      value={v}
      disabled={disabled}
      maxLength={100}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder="오늘의 한마디"
      className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint disabled:opacity-50"
    />
  );
}

function MemoInput({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value); // 날짜가 바뀌거나 불러오면 key로 새로 그려서 처음 값을 맞춘다
  return (
    <textarea
      value={v}
      disabled={disabled}
      maxLength={1000}
      rows={4}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      placeholder="메모"
      className="w-full resize-none bg-[repeating-linear-gradient(transparent,transparent_27px,var(--line)_27px,var(--line)_28px)] bg-transparent text-[14px] leading-[28px] outline-none placeholder:text-faint disabled:opacity-50"
    />
  );
}

// ───────────────────────── TASKS ─────────────────────────

function TaskList({ p, byTask, isToday }: { p: PlannerState; byTask: Map<string, number>; isToday: boolean }) {
  const study = useStudy();
  const [draft, setDraft] = useState("");
  const [draftSubject, setDraftSubject] = useState<Subject | null | undefined>(undefined); // undefined = 자동
  const [editing, setEditing] = useState<Task | null>(null);
  const [needSubject, setNeedSubject] = useState(false);
  const guessed = guessSubject(draft);
  const subject = draftSubject === undefined ? guessed : draftSubject;

  async function submit() {
    if (!draft.trim()) return;
    if (await p.add(draft, subject)) {
      setDraft("");
      setDraftSubject(undefined);
    }
  }

  function toggleTimer(t: Task) {
    if (study.running?.task_id === t.id) return study.stop();
    if (!t.subject) {
      setNeedSubject(true);
      setEditing(t);
      return;
    }
    study.start(t.subject, t.id);
  }

  return (
    <>
      <ul>
        {p.tasks.map((t) => {
          const running = study.running?.task_id === t.id;
          const sec = byTask.get(t.id) ?? 0;
          return (
            <li key={t.id} className={`flex items-center gap-2 border-b border-line py-2 ${running ? "bg-live-soft" : ""}`}>
              <button
                aria-label={t.done ? `${t.title} 완료 취소` : `${t.title} 완료`}
                onClick={() => p.update(t.id, { done: !t.done })}
                className={`grid size-5 shrink-0 place-items-center rounded border ${t.done ? "border-accent bg-accent text-bg" : "border-dashed border-faint"}`}
              >
                {t.done && <Check size={14} strokeWidth={3} />}
              </button>
              <button onClick={() => (setNeedSubject(false), setEditing(t))} className="min-w-0 flex-1 text-left">
                <p className={`line-clamp-2 text-[14px] leading-snug ${t.done ? "text-faint line-through" : ""}`}>{t.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  {t.subject ? (
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full" style={{ background: SUBJECT_COLOR[t.subject] }} />
                      {t.subject}
                    </span>
                  ) : (
                    <span className="text-faint">과목 없음</span>
                  )}
                  {sec >= 60 && <span className="num">· {hm(sec)}</span>}
                  {t.routine_id && <Repeat size={11} className="text-faint" aria-label="루틴" />}
                </p>
              </button>
              {isToday && (
                <button
                  aria-label={running ? `${t.title} 타이머 정지` : `${t.title} 타이머 시작`}
                  disabled={study.busy}
                  onClick={() => toggleTimer(t)}
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${running ? "bg-danger text-bg" : "bg-surface-2 text-text"} disabled:opacity-40`}
                >
                  {running ? <Square size={12} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* 과제 적기 */}
      {!p.unavailable && (
        <form
          className="border-b border-line py-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={60}
            placeholder="+ 과제 적기 (예: 미적분 문제집 2장)"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          {draft.trim() && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SubjectChips value={subject} onChange={setDraftSubject} />
              <button className="ml-auto rounded-lg bg-accent px-3 py-1 text-[12px] font-bold text-bg">추가</button>
            </div>
          )}
        </form>
      )}
      {p.ready && p.tasks.length === 0 && !draft && !p.unavailable && (
        <p className="py-3 text-[12px] leading-relaxed text-faint">오늘 할 공부를 적어 보세요. 과제로 타이머를 켜면 그 과목 시간이 올라가요.</p>
      )}

      {editing && (
        <TaskSheet
          task={p.tasks.find((t) => t.id === editing.id) ?? editing}
          needSubject={needSubject}
          canStart={isToday}
          onClose={() => setEditing(null)}
          onSave={(patch) => p.update(editing.id, patch)}
          onDelete={() => (p.remove(editing), setEditing(null))}
          onStart={(t) => (t.subject && study.start(t.subject, t.id), setEditing(null))}
        />
      )}
    </>
  );
}

/** 과목 고르기 — 자동 짐작된 과목이 먼저 골라져 있다 */
function SubjectChips({ value, onChange }: { value: Subject | null; onChange: (s: Subject | null) => void }) {
  return (
    <>
      {SUBJECTS.map((s) => (
        <button
          type="button"
          key={s}
          onClick={() => onChange(value === s ? null : s)}
          className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${value === s ? "border-transparent text-black" : "border-line text-muted"}`}
          style={value === s ? { background: SUBJECT_COLOR[s] } : undefined}
        >
          {s}
        </button>
      ))}
    </>
  );
}

function TaskSheet({
  task,
  needSubject,
  canStart,
  onClose,
  onSave,
  onDelete,
  onStart,
}: {
  task: Task;
  needSubject: boolean;
  canStart: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Pick<Task, "title" | "subject">>) => void;
  onDelete: () => void;
  onStart: (t: Task) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [subject, setSubject] = useState<Subject | null>(task.subject);

  function close() {
    const patch: Partial<Pick<Task, "title" | "subject">> = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    if (subject !== task.subject) patch.subject = subject;
    if (Object.keys(patch).length) onSave(patch);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={close}>
      <div
        role="dialog"
        aria-label="과제 편집"
        className="mx-auto w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[16px] font-bold">과제</p>
          <button aria-label="닫기" onClick={close} className="grid size-8 place-items-center rounded-full text-muted">
            <X size={20} />
          </button>
        </div>
        <input
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-accent"
        />
        <p className={`mb-2 mt-4 text-[13px] font-medium ${needSubject && !subject ? "text-warn" : "text-muted"}`}>
          {needSubject && !subject ? "타이머를 켜려면 과목을 먼저 골라 주세요" : "과목 — 이 과제로 잰 시간이 이 과목 공부 시간이 돼요"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <SubjectChips value={subject} onChange={setSubject} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button onClick={onDelete} className="h-12 rounded-xl border border-line text-[14px] font-semibold text-danger">
            {task.routine_id ? "오늘만 지우기" : "지우기"}
          </button>
          {canStart ? (
            <button
              disabled={!subject}
              onClick={() => {
                close();
                onStart({ ...task, subject });
              }}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-accent text-[14px] font-bold text-bg disabled:opacity-40"
            >
              <Play size={14} fill="currentColor" /> 이 과제로 공부 시작
            </button>
          ) : (
            <button onClick={close} className="h-12 rounded-xl bg-accent text-[14px] font-bold text-bg">
              저장
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── TIMETABLE ─────────────────────────

function Timetable({ cells }: { cells: (Subject | null)[][] }) {
  return (
    <div className="border-l border-line">
      {TIMETABLE_HOURS.map((h, row) => (
        <div key={h} className="flex h-[22px] border-b border-line">
          <span className="num w-5 shrink-0 pr-0.5 text-right text-[10px] leading-[22px] text-faint">{h % 12 === 0 ? 12 : h % 12}</span>
          {cells[row].map((s, c) => (
            <span
              key={c}
              className="flex-1 border-l border-dashed border-line"
              style={s ? { background: SUBJECT_COLOR[s], opacity: 0.85 } : undefined}
            />
          ))}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 pl-1">
        {SUBJECTS.map((s) => (
          <span key={s} className="flex items-center gap-1 text-[10px] text-faint">
            <span className="size-1.5 rounded-full" style={{ background: SUBJECT_COLOR[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
