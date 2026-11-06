"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { Card, SubHeader } from "@/components/ui";
import { kstToday } from "@/lib/dday";
import { WEEKDAYS, fromYmd, hm } from "@/lib/format";
import { addEtcSession, deleteEtcSession, loadEtcSessions, updateEtcSession, type StudySession } from "@/lib/study";
import { koreanError } from "@/lib/supabase";

const KST = 9 * 3600_000;
/** ms → 한국 시간 "2026-11-05" / "19:30" */
const kstDate = (ms: number) => new Date(ms + KST).toISOString().slice(0, 10);
const kstTime = (ms: number) => new Date(ms + KST).toISOString().slice(11, 16);
/** "2026-11-05" + "19:30" → ms */
const toMs = (date: string, time: string) => Date.parse(`${date}T${time}:00+09:00`);

/**
 * 기타 기록 — 나만 보는 타이머 기록. 순위·공부 합계에 안 들어가므로 직접 추가·수정·삭제할 수 있다.
 */
export default function EtcPage() {
  const study = useStudy();
  const [rows, setRows] = useState<StudySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StudySession | "new" | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await loadEtcSessions(30));
    } catch (e) {
      setRows([]);
      setError(koreanError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadEtcSessions(30).then(
      (r) => alive && setRows(r),
      (e) => alive && (setRows([]), setError(koreanError(e))),
    );
    return () => {
      alive = false;
    };
  }, [study.version]);

  async function done() {
    setEditing(null);
    await reload();
    await study.refresh(); // 홈·타이머의 기타 합계도 바로 바뀌게
  }

  // 날짜별로 묶기 (최신 날짜 먼저)
  const groups = new Map<string, StudySession[]>();
  for (const r of rows ?? []) {
    const d = kstDate(Date.parse(r.started_at));
    groups.set(d, [...(groups.get(d) ?? []), r]);
  }

  return (
    <>
      <SubHeader title="기타 기록" back="/timer" />
      <div className="space-y-4 px-5 pt-1">
        <p className="text-[13px] leading-relaxed text-muted">
          기타 타이머는 순위·공부 합계에 들어가지 않고 나만 볼 수 있어요. 그래서 기록을 직접 고치거나 추가할 수 있어요.
        </p>

        <div className="grid grid-cols-2 gap-3 text-center">
          <Card>
            <p className="text-[12px] text-muted">오늘 기타</p>
            <p className="num mt-1 text-[18px] font-bold">{hm(study.summary.todayEtcSec)}</p>
          </Card>
          <Card>
            <p className="text-[12px] text-muted">이번 주 기타</p>
            <p className="num mt-1 text-[18px] font-bold">{hm(study.summary.weekEtcSec)}</p>
          </Card>
        </div>

        <button
          onClick={() => setEditing("new")}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-[14px] font-semibold text-muted active:bg-surface-2"
        >
          <Plus size={16} /> 기록 직접 추가
        </button>

        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}

        {rows === null ? (
          <AppLoader />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-faint">최근 30일 동안 기타 기록이 없어요</p>
        ) : (
          [...groups].map(([date, list]) => (
            <section key={date}>
              <p className="mb-1.5 px-1 text-[13px] font-semibold text-muted">
                {shortDate(date)}
                <span className="num ml-2 font-normal text-faint">{hm(list.reduce((s, r) => s + (r.duration ?? 0), 0))}</span>
              </p>
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {list.map((r) => {
                  const running = !r.ended_at;
                  return (
                    <li key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{r.label || "기타"}</p>
                        <p className="num mt-0.5 text-[12px] text-muted">
                          {kstTime(Date.parse(r.started_at))} – {running ? "진행 중" : kstTime(Date.parse(r.ended_at!))}
                        </p>
                      </div>
                      <span className="num text-[14px] font-semibold">{running ? "–" : hm(r.duration ?? 0)}</span>
                      <button
                        aria-label={`${r.label || "기타"} 고치기`}
                        disabled={running}
                        onClick={() => setEditing(r)}
                        className="-mr-1 grid size-9 place-items-center rounded-lg text-faint active:bg-surface-2 disabled:opacity-30"
                      >
                        <Pencil size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        <div className="h-4" />
      </div>

      {editing && <EtcSheet row={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={done} />}
    </>
  );
}

function EtcSheet({ row, onClose, onDone }: { row: StudySession | null; onClose: () => void; onDone: () => void }) {
  const start = row ? Date.parse(row.started_at) : null;
  const end = row?.ended_at ? Date.parse(row.ended_at) : null;
  const [label, setLabel] = useState(row?.label ?? "");
  const [date, setDate] = useState(start ? kstDate(start) : kstToday());
  const [from, setFrom] = useState(start ? kstTime(start) : "");
  const [to, setTo] = useState(end ? kstTime(end) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now()); // 미래 시각 막기 기준 (시트를 연 시각)

  // 끝 시각이 시작보다 이르면 자정을 넘긴 것으로 본다 (23:00 → 01:00)
  const fromMs = from ? toMs(date, from) : NaN;
  let toMsVal = to ? toMs(date, to) : NaN;
  if (toMsVal <= fromMs) toMsVal += 86_400_000;
  const valid = !!from && !!to && toMsVal > fromMs && toMsVal <= openedAt + 60_000;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (row) {
        await updateEtcSession(row.id, {
          label: label.trim() || null,
          started_at: new Date(fromMs).toISOString(),
          ended_at: new Date(toMsVal).toISOString(),
        });
      } else {
        await addEtcSession(label, fromMs, toMsVal);
      }
      onDone();
    } catch (e) {
      setError(koreanError(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!row || busy) return;
    setBusy(true);
    try {
      await deleteEtcSession(row.id);
      onDone();
    } catch (e) {
      setError(koreanError(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={row ? "기타 기록 고치기" : "기타 기록 추가"}
        className="mx-auto w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[16px] font-bold">{row ? "기록 고치기" : "기록 추가"}</p>
          <button aria-label="닫기" onClick={onClose} className="grid size-8 place-items-center rounded-full text-muted">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={label}
            maxLength={20}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="이름 (예: 독서, 운동) — 비워도 돼요"
            className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none placeholder:text-faint focus:border-accent"
          />
          <input
            type="date"
            aria-label="날짜"
            value={date}
            max={kstToday()}
            onChange={(e) => setDate(e.target.value)}
            className="num h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-accent"
          />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input type="time" aria-label="시작" value={from} onChange={(e) => setFrom(e.target.value)} className="num h-12 rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-accent" />
            <span className="text-muted">–</span>
            <input type="time" aria-label="끝" value={to} onChange={(e) => setTo(e.target.value)} className="num h-12 rounded-xl border border-line bg-bg px-3 text-[15px] outline-none focus:border-accent" />
          </div>
          <p className="num text-center text-[13px] text-muted">
            {from && to ? (valid ? `${hm((toMsVal - fromMs) / 1000)}${toMsVal - fromMs > 0 && kstDate(toMsVal) !== date ? " (다음 날까지)" : ""}` : "미래 시각은 넣을 수 없어요") : "시작·끝 시각을 넣어 주세요"}
          </p>
        </div>
        {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
        <div className={`mt-5 grid gap-2.5 ${row ? "grid-cols-2" : "grid-cols-1"}`}>
          {row && (
            <button onClick={remove} disabled={busy} className="h-12 rounded-xl border border-line text-[14px] font-semibold text-danger disabled:opacity-40">
              지우기
            </button>
          )}
          <button onClick={save} disabled={!valid || busy} className="h-12 rounded-xl bg-accent text-[14px] font-bold text-bg disabled:opacity-40">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function shortDate(ymd: string) {
  const d = fromYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}
