"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ImageOff, KeyRound, PencilLine, Trash2, UserX } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { LevelBadge, NameTag } from "@/components/NameTag";
import { HEATMAP_MIN_DAYS, StatsPanel } from "@/components/stats/StatsView";
import { ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { Badge, Card, ErrorText, InputRow, PrimaryButton, Segmented, inputCls } from "@/components/ui";
import { adminDeleteUser, adminIssueRecoveryCode, adminRemoveAvatar, kstDateTime } from "@/lib/account";
import {
  adminDeleteSession,
  adminStudentDetail,
  adminStudentSessions,
  adminUpdateStudent,
  agoText,
  type AdminStudentDetail,
} from "@/lib/adminStudents";
import { hms } from "@/lib/format";
import { dayNoStart, hmText, kstDayNo, toRecords } from "@/lib/stats";
import type { StudySession } from "@/lib/study";
import { MAX_CLASS, SUBJECT_COLOR, TRACKS, normalizeSubject, subjectLabel } from "@/lib/subjects";
import { koreanError } from "@/lib/supabase";

const PERIODS = ["1주", "1달", "3달", "1년"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { "1주": 7, "1달": 30, "3달": 90, "1년": 365 };
const MAX_SEC = 4 * 3600;

/**
 * 관리자 학생 관리 — 학생 한 명 (app/me/admin/students). 프로필·레벨·과목별 시간·활동(워마·플래너·칭호·그룹)·
 * 공부 통계(내 통계 화면과 같은 그래프)·최근 기록(지우기)·관리(프로필 고치기·복구 코드·사진 내리기·계정 삭제).
 */
export default function StudentDetail({ nickname, onBack, onRenamed }: { nickname: string; onBack: () => void; onRenamed: (n: string) => void }) {
  const [d, setD] = useState<AdminStudentDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [period, setPeriod] = useState<Period>("1달");
  const [data, setData] = useState<{ since: number; sessions: StudySession[] } | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setData(null);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    adminStudentDetail(nickname).then(
      (x) => {
        if (!alive) return;
        setD(x);
        setNow(Date.now());
        setToday(kstDayNo(Date.now()));
      },
      (e) => alive && (setD(null), setError(koreanError(e))),
    );
    return () => {
      alive = false;
    };
  }, [nickname, version]);

  const need = today === null ? null : today - Math.max(PERIOD_DAYS[period] * 2, HEATMAP_MIN_DAYS) + 1;
  const ready = !!d;
  useEffect(() => {
    if (need === null || !ready || (data && data.since <= need)) return;
    let alive = true;
    adminStudentSessions(nickname, dayNoStart(need)).then(
      (sessions) => alive && setData({ since: need, sessions }),
      (e) => alive && setError(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [need, data, ready, nickname]);

  const todaySec = useMemo(() => {
    if (today === null || !data) return null;
    return toRecords(data.sessions).recs.filter((r) => r.day === today).reduce((s, r) => s + r.sec, 0);
  }, [today, data]);

  const header = (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <button type="button" onClick={onBack} aria-label="학생 목록으로" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
        <ArrowLeft size={22} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{nickname}</h1>
    </header>
  );

  if (d === undefined && !error) {
    return (
      <>
        {header}
        <AppLoader label="학생 기록 불러오는 중…" />
      </>
    );
  }
  if (!d) {
    return (
      <>
        {header}
        <div className="space-y-3 px-5 pt-4">
          {error ? <ErrorText>{error}</ErrorText> : <p className="pt-6 text-center text-[14px] text-muted">이 닉네임의 학생이 없어요. (닉네임이 바뀌었거나 계정이 지워졌어요)</p>}
        </div>
      </>
    );
  }

  const p = d.profile;
  const total = d.subjects.reduce((s, x) => s + x.sec, 0);
  const week = d.subjects.reduce((s, x) => s + x.week_sec, 0);
  const maxSub = Math.max(1, ...d.subjects.map((x) => x.sec));
  const activeTitles = d.titles.filter((t) => !t.revoked);

  return (
    <>
      {header}
      <div className="space-y-4 px-5 pb-10 pt-1">
        {error && <ErrorText>{error}</ErrorText>}

        {/* 프로필 */}
        <Card>
          <div className="flex items-center gap-3.5">
            <ProfileAvatar avatar={p.avatar} nickname={p.nickname} grade={p.title_grade} titleCode={p.title_code} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <NameTag name={p.nickname} frame={p.name_frame} className="min-w-0 text-[17px] font-bold" />
                <LevelBadge level={d.level} size="md" />
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {p.grade}학년 {p.class_no}반{p.track ? ` · ${p.track}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.is_admin && <Badge tone="accent">관리자</Badge>}
                {d.live && <Badge tone="live">공부 중</Badge>}
                <Badge tone={d.has_recovery_code ? "neutral" : "warn"}>{d.has_recovery_code ? "복구 코드 있음" : "복구 코드 없음"}</Badge>
              </div>
            </div>
          </div>
          {p.title_name && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
              대표 칭호 <TitleBadge name={p.title_name} grade={p.title_grade} code={p.title_code} />
            </div>
          )}
          {d.live && (
            <p className="mt-3 rounded-xl bg-live-soft px-3 py-2 text-[13px] text-live">
              지금 {subjectLabel(normalizeSubject(d.live.subject), d.live.detail, d.live.lecture)} 공부 중 · {hmText(Math.max(0, now - Date.parse(d.live.started_at)) / 1000)}째
            </p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
            <Info k="가입" v={kstDateTime(p.created_at)} />
            <Info k="마지막 공부" v={agoText(d.last_at, now)} />
            <Info k="첫 기록" v={d.first_at ? kstDateTime(d.first_at) : "없음"} />
            <Info k="전체 기록" v={`${d.session_count}개`} />
          </dl>
        </Card>

        {/* 숫자 */}
        <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
          <Mini label="누적" value={compact(total)} />
          <Mini label="이번 주" value={compact(week)} />
          <Mini label="오늘" value={todaySec === null ? "…" : hmText(todaySec)} />
          <Mini label="직접 입력" value={compact(d.manual_sec ?? 0)} />
          <Mini label="인강" value={compact(d.lecture_sec)} />
          <Mini label="기타" value={compact(d.etc_sec)} />
        </div>

        {/* 과목별 */}
        <Card>
          <h2 className="text-[15px] font-bold">과목별 공부 시간</h2>
          <p className="mt-0.5 text-[12px] text-muted">누적 · 이번 주 · 과목 레벨</p>
          <div className="mt-3 space-y-2.5">
            {d.subjects.map((x) => (
              <div key={x.subject}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: SUBJECT_COLOR[x.subject] }} />
                  <span className="w-8 shrink-0 font-semibold">{x.subject}</span>
                  <span className="num min-w-0 flex-1 truncate">{hmText(x.sec)}</span>
                  <span className="num shrink-0 text-[12px] text-muted">주 {hmText(x.week_sec)}</span>
                  <span className="num w-12 shrink-0 text-right text-[12px] font-semibold text-accent">Lv.{x.level}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${(x.sec / maxSub) * 100}%`, background: SUBJECT_COLOR[x.subject] }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 활동 */}
        <Card>
          <h2 className="text-[15px] font-bold">활동</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            <Info k="워마 외운 단어" v={`${d.words.learned}개`} />
            <Info k="외우는 중" v={`${d.words.learning}개 (복습 ${d.words.due})`} />
            <Info k="퀴즈 기록" v={`${d.quizzes}개`} />
            <Info k="워마 최근" v={agoText(d.words.last_at, now)} />
            <Info k="플래너 과제" v={`${d.tasks_done}/${d.tasks_total} 완료`} />
            <Info k="루틴 · 디데이" v={`${d.routines}개 · ${d.ddays}개`} />
            <Info k="문의" v={`${d.inquiries}개`} />
            <Info k="스터디그룹" v={d.groups.length ? `${d.groups.length}개` : "없음"} />
          </dl>
          {d.groups.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.groups.map((g) => (
                <Badge key={g.name}>
                  {g.name} · {g.members}명{g.owner ? " · 방장" : ""}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* 칭호 */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">칭호 {activeTitles.length}개</h2>
            <Link href="/me/admin/titles" className="flex items-center text-[12px] font-semibold text-accent">
              칭호 주기·회수 <ChevronRight size={14} />
            </Link>
          </div>
          {d.titles.length === 0 ? (
            <p className="mt-2 text-[13px] text-faint">아직 얻은 칭호가 없어요.</p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {d.titles.map((t) => (
                <span key={t.code} className={t.revoked ? "opacity-40 line-through" : ""} title={`${kstDateTime(t.earned_at)}${t.revoked ? " · 회수됨" : ""}`}>
                  <TitleBadge name={t.name} grade={t.grade} code={t.code} size="xs" />
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* 공부 통계 (내 통계 화면과 같은 그래프) */}
        <h2 className="px-1 pt-2 text-[16px] font-bold">공부 통계</h2>
        <Segmented items={PERIODS} value={period} onChange={setPeriod} />
        {today === null || !data ? (
          <AppLoader size="inline" label="기록 모으는 중…" />
        ) : (
          <StatsPanel
            today={today}
            sessions={data.sessions}
            n={PERIOD_DAYS[period]}
            empty={
              <Card>
                <p className="py-5 text-center text-[13px] text-muted">이 기간에는 공부 기록이 없어요.</p>
              </Card>
            }
          />
        )}

        {/* 최근 기록 */}
        {data && <RecentSessions sessions={data.sessions} onDeleted={reload} />}

        {/* 관리 */}
        <h2 className="px-1 pt-2 text-[16px] font-bold">관리</h2>
        <EditProfile d={d} onSaved={(n) => (n !== nickname ? onRenamed(n) : reload())} />
        <IssueCode nickname={p.nickname} />
        {p.avatar?.startsWith("photo:") && <RemovePhoto nickname={p.nickname} onDone={reload} />}
        {!p.is_admin && <DeleteAccount nickname={p.nickname} avatar={p.avatar} onDone={onBack} />}
      </div>
    </>
  );
}

function Info({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-faint">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}

/** 좁은 칸용: 100시간이 넘으면 분은 뺀다 */
const compact = (sec: number) => (sec >= 100 * 3600 ? `${Math.floor(sec / 3600)}시간` : hmText(sec));

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card flush className="min-w-0 px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="num truncate text-[15px] font-bold">{value}</p>
    </Card>
  );
}

// ───────────────────────── 최근 기록 ─────────────────────────

function RecentSessions({ sessions, onDeleted }: { sessions: StudySession[]; onDeleted: () => void }) {
  const [shown, setShown] = useState(20);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => [...sessions].reverse(), [sessions]);

  async function remove(s: StudySession) {
    if (busy) return;
    const what = `${kstDateTime(s.started_at)} ${subjectLabel(s.subject, s.detail, s.lecture)}${s.duration ? ` (${hmText(s.duration)})` : ""}`;
    if (!confirm(`이 기록을 지울까요?\n${what}\n\n지우면 순위·레벨·통계에서 빠지고 되돌릴 수 없어요. (이미 받은 칭호는 그대로예요)`)) return;
    setBusy(s.id);
    setError(null);
    try {
      await adminDeleteSession(s.id);
      onDeleted();
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h2 className="px-1 pt-2 text-[16px] font-bold">최근 기록</h2>
      <p className="-mt-2 px-1 text-[12px] text-muted">켜 두고 잊은 기록이나 이상한 기록은 지울 수 있어요.</p>
      {error && <ErrorText>{error}</ErrorText>}
      {list.length === 0 ? (
        <p className="px-1 text-[13px] text-faint">불러온 기간에 기록이 없어요.</p>
      ) : (
        <Card flush className="divide-y divide-line overflow-hidden">
          {list.slice(0, shown).map((s) => {
            const counted = s.subject !== "기타" && !s.lecture;
            const long = (s.duration ?? 0) > MAX_SEC;
            return (
              <div key={s.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[s.subject] }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {subjectLabel(s.subject, s.detail, s.lecture)}
                    {s.label ? ` · ${s.label}` : ""}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                    <span>{kstDateTime(s.started_at)}</span>
                    {s.manual && <span className="font-semibold text-accent">직접 입력</span>}
                    {s.away_count > 0 && <span>이탈 {s.away_count}번</span>}
                    {!counted && <span className="text-faint">합계 제외</span>}
                    {long && <span className="text-warn">4시간 넘음 · 제외</span>}
                  </p>
                </div>
                <span className={`num shrink-0 text-[13px] font-semibold ${s.ended_at ? "" : "text-live"}`}>{s.ended_at ? hms(s.duration ?? 0) : "진행 중"}</span>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  disabled={!!busy}
                  aria-label="기록 지우기"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-faint active:bg-surface-2 disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </Card>
      )}
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + 30)} className="h-10 w-full rounded-xl bg-surface-2 text-[13px] font-semibold text-muted">
          더 보기 ({list.length - shown}개 남음)
        </button>
      )}
    </>
  );
}

// ───────────────────────── 관리 ─────────────────────────

const GRADE_ITEMS = ["1학년", "2학년", "3학년"] as const;
const TRACK_ITEMS = ["없음", ...TRACKS] as const;

function EditProfile({ d, onSaved }: { d: AdminStudentDetail; onSaved: (nickname: string) => void }) {
  const p = d.profile;
  const [nick, setNick] = useState(p.nickname);
  const [grade, setGrade] = useState(p.grade);
  const [classNo, setClassNo] = useState(p.class_no);
  const [track, setTrack] = useState<string>(p.track ?? "없음");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = nick.trim() !== p.nickname || grade !== p.grade || classNo !== p.class_no || (track === "없음" ? null : track) !== p.track;

  async function save() {
    if (busy || !changed) return;
    const n = nick.trim();
    if (n.length < 2 || n.length > 12) return setMsg({ ok: false, text: "닉네임은 2~12자예요." });
    if (n !== p.nickname && !confirm(`닉네임을 「${p.nickname}」 → 「${n}」로 바꿀까요? 학생에게 따로 알려 주세요.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminUpdateStudent(p.nickname, { nickname: n, grade, class_no: classNo, track: track === "없음" ? null : track });
      if (r === "ok") {
        setMsg({ ok: true, text: "저장했어요." });
        onSaved(n);
      } else {
        setMsg({ ok: false, text: r === "taken" ? "다른 학생이 쓰는 닉네임이에요." : r === "not_found" ? "학생을 찾지 못했어요." : "값이 올바르지 않아요." });
      }
    } catch (e) {
      setMsg({ ok: false, text: koreanError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle icon={<PencilLine size={18} />} title="프로필 고치기" />
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">부적절한 닉네임이나 잘못 고른 학년·반·계열을 고쳐요.</p>
      <div className="mt-3 space-y-2.5">
        <InputRow icon={<PencilLine size={18} />}>
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={12} placeholder="닉네임" className={inputCls} />
        </InputRow>
        <Segmented items={GRADE_ITEMS} value={GRADE_ITEMS[grade - 1]} onChange={(v) => setGrade(GRADE_ITEMS.indexOf(v) + 1)} />
        <div className="flex gap-2">
          <select
            value={classNo}
            onChange={(e) => setClassNo(Number(e.target.value))}
            aria-label="반"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[13px] text-text outline-none focus:border-accent"
          >
            {Array.from({ length: Math.max(MAX_CLASS, p.class_no) }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                {c}반
              </option>
            ))}
          </select>
          <div className="min-w-0 flex-[1.6]">
            <Segmented items={TRACK_ITEMS} value={track as (typeof TRACK_ITEMS)[number]} onChange={setTrack} />
          </div>
        </div>
        {msg && (msg.ok ? <p className="text-[13px] text-live">{msg.text}</p> : <ErrorText>{msg.text}</ErrorText>)}
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed}
          className="h-11 w-full rounded-xl bg-accent-soft text-[14px] font-semibold text-accent disabled:opacity-40"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </Card>
  );
}

function IssueCode({ nickname }: { nickname: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    if (busy) return;
    if (!confirm(`'${nickname}' 학생 본인이 맞는지 직접 확인했나요? 새 복구 코드를 만들면 예전 코드는 못 쓰게 돼요.`)) return;
    setBusy(true);
    setError(null);
    try {
      setCode(await adminIssueRecoveryCode(nickname));
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle icon={<KeyRound size={18} />} title="복구 코드 만들어 주기" />
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">비밀번호를 잊은 학생에게 본인 확인 후 전해 주세요. 로그인 화면 → 비밀번호를 잊었어요에서 써요.</p>
      {error && (
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {code ? (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent-soft p-4 text-center">
          <p className="text-[12px] text-muted">{nickname} 학생의 새 복구 코드</p>
          <p className="num mt-1 select-all font-mono text-[22px] font-bold tracking-[0.12em] text-accent">{code}</p>
        </div>
      ) : (
        <button type="button" onClick={issue} disabled={busy} className="mt-3 h-11 w-full rounded-xl bg-accent-soft text-[14px] font-semibold text-accent disabled:opacity-40">
          {busy ? "만드는 중…" : "새 코드 만들기"}
        </button>
      )}
    </Card>
  );
}

function RemovePhoto({ nickname, onDone }: { nickname: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (busy || !confirm(`'${nickname}' 학생의 프로필 사진을 내릴까요? 사진 파일도 지워져요.`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminRemoveAvatar(nickname);
      onDone();
    } catch (e) {
      setError(koreanError(e));
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardTitle icon={<ImageOff size={18} />} title="프로필 사진 내리기" />
      {error && (
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <button type="button" onClick={remove} disabled={busy} className="mt-3 h-11 w-full rounded-xl bg-warn-soft text-[14px] font-semibold text-warn disabled:opacity-40">
        {busy ? "내리는 중…" : "사진 내리기"}
      </button>
    </Card>
  );
}

function DeleteAccount({ nickname, avatar, onDone }: { nickname: string; avatar: string | null; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (busy || typed.trim() !== nickname) return;
    if (!confirm(`'${nickname}' 계정과 모든 기록(공부 기록·플래너·워마·칭호·문의)을 지울까요? 되돌릴 수 없어요.`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminDeleteUser(nickname, avatar);
      onDone();
    } catch (e) {
      setError(koreanError(e));
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardTitle icon={<UserX size={18} />} title="계정 삭제" danger />
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        확인을 위해 닉네임 <b className="text-text">{nickname}</b>을(를) 똑같이 입력하세요.
      </p>
      <div className="mt-3 space-y-2.5">
        <InputRow icon={<UserX size={18} />}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={12} placeholder="닉네임" className={inputCls} />
        </InputRow>
        {error && <ErrorText>{error}</ErrorText>}
        <PrimaryButton tone="danger" onClick={remove} disabled={busy || typed.trim() !== nickname}>
          {busy ? "지우는 중…" : "계정 삭제"}
        </PrimaryButton>
      </div>
    </Card>
  );
}

function CardTitle({ icon, title, danger }: { icon: ReactNode; title: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={danger ? "text-danger" : "text-accent"}>{icon}</span>
      <h3 className="text-[15px] font-bold">{title}</h3>
    </div>
  );
}

