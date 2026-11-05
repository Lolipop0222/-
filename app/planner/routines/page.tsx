"use client";

import { useEffect, useState } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { Card, SubHeader } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";
import { addRoutine, deleteRoutine, isPlannerMissing, listRoutines, updateRoutine, type Routine } from "@/lib/planner";
import { SUBJECTS, SUBJECT_COLOR, guessSubject, type Subject } from "@/lib/subjects";
import { koreanError } from "@/lib/supabase";

// 월요일부터 보여 준다 (값은 0=일 … 6=토)
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const PRESETS: { label: string; days: number[] }[] = [
  { label: "매일", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "평일", days: [1, 2, 3, 4, 5] },
  { label: "주말", days: [0, 6] },
];

/** 데일리 루틴 — 매일(또는 정한 요일마다) 플래너에 자동으로 들어가는 과제 */
export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject | null | undefined>(undefined); // undefined = 자동
  const [days, setDays] = useState<number[]>(PRESETS[0].days);
  const [busy, setBusy] = useState(false);
  const pickedSubject = subject === undefined ? guessSubject(title) : subject;

  const fail = (e: unknown) => (isPlannerMissing(e) ? setUnavailable(true) : setError(koreanError(e)));

  useEffect(() => {
    listRoutines().then(setRoutines, (e) => {
      setRoutines([]);
      if (isPlannerMissing(e)) setUnavailable(true);
      else setError(koreanError(e));
    });
  }, []);

  async function add() {
    if (!title.trim() || days.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await addRoutine(title, pickedSubject, [...days].sort());
      setRoutines((list) => [...(list ?? []), r]);
      setTitle("");
      setSubject(undefined);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function patch(r: Routine, p: Partial<Routine>) {
    setRoutines((list) => list?.map((x) => (x.id === r.id ? { ...x, ...p } : x)) ?? null);
    try {
      await updateRoutine(r.id, p);
    } catch (e) {
      setRoutines((list) => list?.map((x) => (x.id === r.id ? r : x)) ?? null);
      fail(e);
    }
  }

  async function remove(r: Routine) {
    setRoutines((list) => list?.filter((x) => x.id !== r.id) ?? null);
    try {
      await deleteRoutine(r.id);
    } catch (e) {
      setRoutines((list) => [...(list ?? []), r]);
      fail(e);
    }
  }

  return (
    <>
      <SubHeader title="데일리 루틴" back="/planner" />
      <div className="space-y-4 px-5 pt-1">
        <p className="text-[13px] leading-relaxed text-muted">매일 하는 공부를 한 번만 적어 두면, 고른 요일마다 플래너 TASKS에 자동으로 들어가요.</p>

        {unavailable ? (
          <Card>
            <p className="text-[13px] text-faint">데일리 루틴은 아직 준비 중이에요.</p>
          </Card>
        ) : (
          <Card>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="예: 영단어 30개, 비문학 3지문, 수학 오답노트"
                className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none placeholder:text-faint focus:border-accent"
              />
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-muted">과목 {subject === undefined && pickedSubject && <span className="text-faint">(자동)</span>}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECTS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSubject(pickedSubject === s ? null : s)}
                      className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${pickedSubject === s ? "border-transparent text-black" : "border-line text-muted"}`}
                      style={pickedSubject === s ? { background: SUBJECT_COLOR[s] } : undefined}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-muted">요일</p>
                  <div className="flex gap-1">
                    {PRESETS.map((pr) => (
                      <button
                        type="button"
                        key={pr.label}
                        onClick={() => setDays(pr.days)}
                        className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted"
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {ORDER.map((d) => {
                    const on = days.includes(d);
                    return (
                      <button
                        type="button"
                        key={d}
                        aria-pressed={on}
                        onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                        className={`h-9 rounded-lg text-[13px] font-semibold ${on ? "bg-accent text-bg" : "bg-surface-2 text-faint"}`}
                      >
                        {WEEKDAYS[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                disabled={!title.trim() || days.length === 0 || busy}
                className="h-12 w-full rounded-xl bg-accent text-[15px] font-bold text-bg active:scale-[0.98] disabled:opacity-40"
              >
                루틴 추가
              </button>
            </form>
            {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
          </Card>
        )}

        {routines === null ? (
          <p className="py-8 text-center text-[14px] text-faint">불러오는 중…</p>
        ) : routines.length === 0 ? (
          !unavailable && <p className="py-8 text-center text-[14px] text-faint">아직 루틴이 없어요</p>
        ) : (
          <ul className="space-y-2.5">
            {routines.map((r) => (
              <li key={r.id} className={`flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 ${r.active ? "" : "opacity-50"}`}>
                <Repeat size={16} className="shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{r.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                    {r.subject && (
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full" style={{ background: SUBJECT_COLOR[r.subject] }} />
                        {r.subject} ·
                      </span>
                    )}
                    {weekdayText(r.weekdays)}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={r.active}
                  aria-label={`${r.title} 켜기/끄기`}
                  onClick={() => patch(r, { active: !r.active })}
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${r.active ? "bg-accent" : "bg-line"}`}
                >
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${r.active ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <button aria-label={`${r.title} 삭제`} onClick={() => remove(r)} className="-mr-1 grid size-8 place-items-center rounded-lg text-faint active:bg-surface-2">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="pb-4 text-center text-[12px] text-faint">루틴을 지워도 이미 만들어진 과제와 공부 기록은 남아요</p>
      </div>
    </>
  );
}

function weekdayText(days: number[]): string {
  const set = [...days].sort().join();
  const preset = PRESETS.find((p) => [...p.days].sort().join() === set);
  return preset ? preset.label : ORDER.filter((d) => days.includes(d)).map((d) => WEEKDAYS[d]).join("·");
}
