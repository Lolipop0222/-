"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Clock3, PenLine, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { AppLoader } from "@/components/BrandLoader";
import { useStudy } from "@/components/StudyProvider";
import SubjectPicker, { type SubjectChoice } from "@/components/SubjectPicker";
import { Badge, Card, ErrorText, PrimaryButton, Segmented, SubHeader } from "@/components/ui";
import { hm } from "@/lib/format";
import { MANUAL_MESSAGE, addEtcSession, addManualSession, deleteManualSession, loadSessionsSince, type StudySession } from "@/lib/study";
import { ETC, SUBJECT_COLOR, subjectLabel } from "@/lib/subjects";
import { koreanError } from "@/lib/supabase";

const KST = 9 * 3600_000;
const DAY = 24 * 3600_000;
/** 오늘 0시(한국) ms */
const kstMidnight = (t: number) => t - ((t + KST) % DAY);
const hhmm = (ms: number) => new Date(ms + KST).toISOString().slice(11, 16);
const mdText = (ms: number) => {
  const d = new Date(ms + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
/** "19:30" → 그날 0시부터 몇 ms */
const timeMs = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
};

const DAYS = ["오늘", "어제"] as const;
type DayKey = (typeof DAYS)[number];

/**
 * 공부 시간 직접 입력 (2026-11-22, 사용자: "대전고는 전자기기 금지라 몇 시 몇 분부터 몇 시 몇 분까지 입력하면 반영되게, 타이머는 그대로").
 * 서버 규칙(11-manual.sql): 오늘·어제만, 1분~4시간, 다른 기록과 안 겹치게, 하루 16시간까지. 기타는 기타 기록으로 들어간다(합계 제외).
 * 끝 시각이 시작보다 이르면 다음 날로 본다 (예: 23:00~01:00).
 */
export default function ManualEntryPage() {
  const auth = useAuth();
  const study = useStudy();
  const track = auth.status === "ready" ? (auth.profile.track ?? null) : null;
  const grade = auth.status === "ready" ? auth.profile.grade : null;

  const [now, setNow] = useState<number | null>(null);
  const [day, setDay] = useState<DayKey>("오늘");
  const [choice, setChoice] = useState<SubjectChoice>({ subject: null, detail: null, lecture: false });
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rows, setRows] = useState<StudySession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const today0 = now === null ? null : kstMidnight(now);
  const day0 = today0 === null ? null : day === "오늘" ? today0 : today0 - DAY;

  const reload = useCallback(async () => {
    if (today0 === null) return;
    try {
      setRows(await loadSessionsSince(today0 - DAY));
      setLoadError(null);
    } catch (e) {
      setRows([]);
      setLoadError(koreanError(e));
    }
  }, [today0]);

  useEffect(() => {
    if (today0 === null) return;
    let alive = true;
    loadSessionsSince(today0 - DAY).then(
      (r) => alive && setRows(r),
      (e) => alive && (setRows([]), setLoadError(koreanError(e))),
    );
    return () => {
      alive = false;
    };
  }, [today0, study.version]);

  // 고른 시간 (끝이 시작보다 이르면 다음 날)
  const range = useMemo(() => {
    if (day0 === null || !start || !end) return null;
    const s = day0 + timeMs(start);
    let e = day0 + timeMs(end);
    const nextDay = e <= s;
    if (nextDay) e += DAY;
    return { s, e, sec: Math.round((e - s) / 1000), nextDay };
  }, [day0, start, end]);

  const dayRows = useMemo(() => {
    if (!rows || day0 === null) return [];
    return rows.filter((r) => {
      const t = Date.parse(r.started_at);
      return t >= day0 && t < day0 + DAY;
    });
  }, [rows, day0]);

  const clash = useMemo(() => {
    if (!range || choice.subject === ETC) return null;
    return (
      (rows ?? []).find((r) => {
        const s = Date.parse(r.started_at);
        const e = r.ended_at ? Date.parse(r.ended_at) : (now ?? 0);
        return s < range.e && e > range.s && (!r.ended_at || (r.duration ?? 0) <= 14400);
      }) ?? null
    );
  }, [range, rows, now, choice.subject]);

  const problem = !choice.subject
    ? "과목을 골라 주세요"
    : !range
      ? "시작과 끝 시각을 넣어 주세요"
      : range.sec < 60
        ? "1분 이상이어야 해요"
        : range.sec > 4 * 3600
          ? "한 번에 4시간까지 넣을 수 있어요"
          : now !== null && range.e > now + 60_000
            ? "아직 오지 않은 시간이에요"
            : clash
              ? `${hhmm(Date.parse(clash.started_at))}~${clash.ended_at ? hhmm(Date.parse(clash.ended_at)) : "지금"} ${subjectLabel(clash.subject)} 기록과 겹쳐요`
              : null;

  async function submit() {
    if (busy || problem || !range || !choice.subject) return;
    setBusy(true);
    setMsg(null);
    try {
      if (choice.subject === ETC) {
        await addEtcSession("", range.s, range.e);
      } else {
        const r = await addManualSession(choice.subject, range.s, range.e, choice.detail, choice.lecture);
        if (r !== "ok") {
          setMsg({ ok: false, text: MANUAL_MESSAGE[r] ?? "다시 확인해 주세요." });
          return;
        }
      }
      setMsg({ ok: true, text: `${hhmm(range.s)}~${hhmm(range.e)} ${subjectLabel(choice.subject, choice.detail, choice.lecture)} ${hm(range.sec)}을 기록했어요.` });
      setStart(end);
      setEnd("");
      await reload();
      await study.refresh(); // 홈·타이머 합계도 바로
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setMsg({ ok: false, text: code === "PGRST202" ? "직접 입력은 데이터베이스 업데이트(11번 조각) 후에 쓸 수 있어요." : koreanError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: StudySession) {
    if (!confirm(`${hhmm(Date.parse(r.started_at))}~${r.ended_at ? hhmm(Date.parse(r.ended_at)) : ""} ${subjectLabel(r.subject, r.detail, r.lecture)} 기록을 지울까요?`)) return;
    try {
      await deleteManualSession(r.id);
      await reload();
      await study.refresh();
    } catch (e) {
      setMsg({ ok: false, text: koreanError(e) });
    }
  }

  const dayTotal = dayRows.filter((r) => r.subject !== ETC && !r.lecture && r.ended_at && (r.duration ?? 0) <= 14400).reduce((s, r) => s + (r.duration ?? 0), 0);

  return (
    <>
      <SubHeader title="공부 시간 직접 입력" back="/timer" />
      <div className="space-y-4 px-5 pb-10 pt-1">
        <p className="text-[13px] leading-relaxed text-muted">
          휴대폰을 못 쓰는 야자 시간에 공부했다면, 끝나고 <b className="text-text">몇 시 몇 분부터 몇 시 몇 분까지</b> 적어 주세요. 타이머처럼 순위·레벨·칭호에 들어가요.
        </p>

        {now === null ? (
          <AppLoader size="inline" />
        ) : (
          <Card className="space-y-4">
            <div>
              <Label>날짜</Label>
              <Segmented
                items={DAYS}
                value={day}
                onChange={(d) => {
                  setDay(d);
                  setMsg(null);
                }}
              />
              <p className="mt-1.5 text-[11px] text-faint">
                {day} {day0 !== null && mdText(day0)} · 오늘과 어제 것만 넣을 수 있어요
              </p>
            </div>

            <div>
              <Label>과목</Label>
              <SubjectPicker value={choice} onChange={setChoice} track={track} grade={grade} />
              {choice.subject === ETC && <p className="mt-1.5 text-[11px] text-faint">기타는 순위·공부 합계에 안 들어가고 기타 기록에 들어가요.</p>}
            </div>

            <div>
              <Label>시간</Label>
              <div className="flex items-center gap-2">
                <TimeBox label="시작" value={start} onChange={setStart} />
                <span className="text-muted">~</span>
                <TimeBox label="끝" value={end} onChange={setEnd} />
              </div>
              {range && range.sec > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-[13px]">
                  <Clock3 size={14} className="text-accent" />
                  <b className="num">{hm(range.sec)}</b>
                  {range.nextDay && <span className="text-muted">(끝은 다음 날 {hhmm(range.e)})</span>}
                </p>
              )}
            </div>

            {problem && (start || end || choice.subject) && <p className="text-[13px] text-warn">{problem}</p>}
            {msg && (msg.ok ? <p className="rounded-xl bg-live-soft px-3 py-2 text-[13px] text-live">{msg.text}</p> : <ErrorText>{msg.text}</ErrorText>)}

            <PrimaryButton onClick={submit} disabled={busy || !!problem}>
              <PenLine size={18} /> {busy ? "기록하는 중…" : "기록하기"}
            </PrimaryButton>
          </Card>
        )}

        {/* 그날 기록 — 겹치지 않게 보고 넣기 */}
        <div className="flex items-baseline justify-between px-1 pt-1">
          <h2 className="text-[15px] font-bold">
            {day} 기록 {day0 !== null && <span className="text-[12px] font-normal text-muted">{mdText(day0)}</span>}
          </h2>
          <span className="num text-[13px] text-muted">공부 합계 {hm(dayTotal)}</span>
        </div>
        {loadError && <ErrorText>{loadError}</ErrorText>}
        {rows === null ? (
          <AppLoader size="inline" />
        ) : dayRows.length === 0 ? (
          <p className="px-1 text-[13px] text-faint">아직 기록이 없어요.</p>
        ) : (
          <Card flush className="divide-y divide-line overflow-hidden">
            {[...dayRows]
              .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
              .map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[r.subject] }} />
                  <div className="min-w-0 flex-1">
                    <p className="num text-[14px] font-semibold">
                      {hhmm(Date.parse(r.started_at))}~{r.ended_at ? hhmm(Date.parse(r.ended_at)) : "지금"}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      {subjectLabel(r.subject, r.detail, r.lecture)}
                      {r.label ? ` · ${r.label}` : ""}
                    </p>
                  </div>
                  <Badge tone={r.manual ? "accent" : "neutral"}>{r.manual ? "직접 입력" : r.subject === ETC ? "기타" : r.ended_at ? "타이머" : "공부 중"}</Badge>
                  <span className="num shrink-0 whitespace-nowrap text-right text-[12px] text-muted">{r.ended_at ? hm(r.duration ?? 0) : ""}</span>
                  {r.manual ? (
                    <button type="button" onClick={() => remove(r)} aria-label="지우기" className="grid size-8 shrink-0 place-items-center rounded-full text-faint active:bg-surface-2">
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <span className="size-8 shrink-0" />
                  )}
                </div>
              ))}
          </Card>
        )}
        <p className="px-1 text-[11px] leading-relaxed text-faint">
          직접 입력한 기록은 오늘·어제 것만 지울 수 있어요(고치려면 지우고 다시 넣기). 한 번에 4시간까지, 하루 공부 16시간까지, 다른 기록과 겹치면 안 돼요. 기타 기록은{" "}
          <Link href="/timer/etc" className="underline underline-offset-2">
            기타 기록
          </Link>
          에서 고쳐요. 정직하게 적어 주세요 — 관리자가 기록을 확인할 수 있어요.
        </p>
      </div>
    </>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-semibold text-muted">{children}</p>;
}

function TimeBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-14 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-line bg-surface px-3 focus-within:border-accent">
      <span className="text-[10px] text-faint">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="num w-full bg-transparent text-[17px] font-semibold text-text outline-none" />
    </label>
  );
}
