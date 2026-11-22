"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { LevelBadge, NameTag } from "@/components/NameTag";
import StudentDetail from "@/components/admin/StudentDetail";
import { ProfileAvatar } from "@/components/TitleBadge";
import { Badge, Card, ErrorText, InputRow, Segmented, SubHeader, inputCls } from "@/components/ui";
import { isAdmin } from "@/lib/account";
import { adminListStudents, agoText, type AdminStudent } from "@/lib/adminStudents";
import { hmText } from "@/lib/stats";
import { koreanError } from "@/lib/supabase";

const GRADES = ["전체", "1학년", "2학년", "3학년"] as const;
type GradeFilter = (typeof GRADES)[number];

const SORTS = {
  week: "이번 주 공부 많은 순",
  today: "오늘 공부 많은 순",
  total: "누적 공부 많은 순",
  level: "레벨 높은 순",
  recent: "최근 공부한 순",
  joined: "최근 가입한 순",
  class: "학년·반·닉네임 순",
} as const;
type SortKey = keyof typeof SORTS;

const selectCls = "h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[13px] text-text outline-none focus:border-accent";

/** 주소의 ?s=닉네임 (학생 상세). 안드로이드 뒤로 가기로 목록에 돌아올 수 있게 history에 남긴다 */
const readSelected = () => new URLSearchParams(window.location.search).get("s");

/**
 * 관리자 학생 관리 (2026-11-22) — 가입한 학생 목록(검색·학년·반·정렬)과 학생별 공부 기록·통계·관리.
 * DB 함수는 supabase/parts/10-admin-students.sql. 관리자가 아니면 DB가 모두 거절한다.
 */
export default function AdminStudentsPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const pushed = useRef(false);

  useEffect(() => {
    let alive = true;
    isAdmin().then((v) => alive && setAdmin(v));
    const sync = () => setSelected(readSelected());
    const id = setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      alive = false;
      clearTimeout(id);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const open = useCallback((nickname: string) => {
    window.history.pushState(null, "", `?s=${encodeURIComponent(nickname)}`);
    pushed.current = true;
    setSelected(nickname);
    window.scrollTo(0, 0);
  }, []);

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", window.location.pathname);
      setSelected(null);
      setListKey((k) => k + 1); // 상세에서 고쳤을 수 있으니 목록을 다시 읽는다
    }
  }, []);

  /** 닉네임을 바꿨을 때 주소도 바꾼다 (뒤로 가기 기록은 그대로) */
  const renamed = useCallback((nickname: string) => {
    window.history.replaceState(null, "", `?s=${encodeURIComponent(nickname)}`);
    setSelected(nickname);
  }, []);

  if (admin === false) {
    return (
      <>
        <SubHeader title="학생 관리" back="/me/admin" />
        <p className="px-5 pt-8 text-center text-[14px] text-muted">관리자만 쓸 수 있는 화면이에요.</p>
      </>
    );
  }
  if (admin === null) {
    return (
      <>
        <SubHeader title="학생 관리" back="/me/admin" />
        <AppLoader />
      </>
    );
  }
  return (
    <>
      {/* 목록은 상세를 보는 동안에도 남겨 둔다 → 돌아오면 검색·정렬·스크롤이 그대로 */}
      <div hidden={!!selected}>
        <StudentList key={listKey} onOpen={open} />
      </div>
      {selected && <StudentDetail key={selected} nickname={selected} onBack={close} onRenamed={renamed} />}
    </>
  );
}

function StudentList({ onOpen }: { onOpen: (nickname: string) => void }) {
  const [rows, setRows] = useState<AdminStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<GradeFilter>("전체");
  const [classNo, setClassNo] = useState("all");
  const [sort, setSort] = useState<SortKey>("week");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminListStudents();
      setRows(r);
      setNow(Date.now());
    } catch (e) {
      setError(koreanError(e));
      setRows((x) => x ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(load, 0);
    // 상세에서 고치고 돌아오면 다시 읽는다
    const onPop = () => !readSelected() && load();
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(id);
      window.removeEventListener("popstate", onPop);
    };
  }, [load]);

  const classes = useMemo(() => {
    const g = GRADES.indexOf(grade);
    const set = new Set((rows ?? []).filter((r) => !g || r.grade === g).map((r) => r.class_no));
    return [...set].sort((a, b) => a - b);
  }, [rows, grade]);

  const list = useMemo(() => {
    if (!rows) return [];
    const g = GRADES.indexOf(grade);
    const words = q.trim().toLowerCase();
    const out = rows.filter(
      (r) => (!g || r.grade === g) && (classNo === "all" || r.class_no === Number(classNo)) && (!words || r.nickname.toLowerCase().includes(words)),
    );
    const by: Record<SortKey, (a: AdminStudent, b: AdminStudent) => number> = {
      week: (a, b) => b.week_sec - a.week_sec,
      today: (a, b) => b.today_sec - a.today_sec,
      total: (a, b) => b.total_sec - a.total_sec,
      level: (a, b) => b.level - a.level || b.total_sec - a.total_sec,
      recent: (a, b) => (b.last_at ? Date.parse(b.last_at) : 0) - (a.last_at ? Date.parse(a.last_at) : 0),
      joined: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      class: (a, b) => a.grade - b.grade || a.class_no - b.class_no || a.nickname.localeCompare(b.nickname, "ko"),
    };
    return out.sort((a, b) => by[sort](a, b) || a.nickname.localeCompare(b.nickname, "ko"));
  }, [rows, q, grade, classNo, sort]);

  const all = rows ?? [];
  const sumWeek = list.reduce((s, r) => s + r.week_sec, 0);

  return (
    <>
      <SubHeader
        title="학생 관리"
        back="/me/admin"
        right={
          <button type="button" onClick={load} disabled={loading} aria-label="새로 고침" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2 disabled:opacity-40">
            <RefreshCw size={19} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />
      <div className="space-y-3 px-5 pb-8 pt-1">
        {error && <ErrorText>{error}</ErrorText>}
        {rows === null ? (
          !error && <AppLoader label="학생 목록 불러오는 중…" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="가입한 학생" value={`${all.length}명`} />
              <Stat label="지금 공부 중" value={`${all.filter((r) => r.studying).length}명`} live />
              <Stat label="오늘 공부한 학생" value={`${all.filter((r) => r.today_sec > 0).length}명`} />
              <Stat label="이번 주 공부한 학생" value={`${all.filter((r) => r.week_sec > 0).length}명`} />
            </div>

            <InputRow icon={<Search size={18} />}>
              <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={12} placeholder="닉네임 찾기" className={inputCls} />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="지우기" className="text-faint">
                  <X size={18} />
                </button>
              )}
            </InputRow>
            <Segmented
              items={GRADES}
              value={grade}
              onChange={(v) => {
                setGrade(v);
                setClassNo("all");
              }}
            />
            <div className="flex gap-2">
              <select value={classNo} onChange={(e) => setClassNo(e.target.value)} aria-label="반" className={selectCls}>
                <option value="all">모든 반</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}반
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬" className={`${selectCls} flex-[1.6]`}>
                {(Object.keys(SORTS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k]}
                  </option>
                ))}
              </select>
            </div>

            <p className="px-1 text-[12px] text-muted">
              {list.length}명 · 이번 주 합계 {hmText(sumWeek)}
              {list.length > 0 && ` · 평균 ${hmText(sumWeek / list.length)}`}
            </p>

            {list.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-faint">{all.length ? "조건에 맞는 학생이 없어요." : "아직 가입한 학생이 없어요."}</p>
            ) : (
              <Card flush className="divide-y divide-line overflow-hidden">
                {list.map((r, i) => (
                  <Row key={r.nickname} r={r} rank={i + 1} sort={sort} now={now} onOpen={onOpen} />
                ))}
              </Card>
            )}
            <p className="px-1 text-[11px] leading-relaxed text-faint">
              공부 시간은 순위와 같은 기준이에요(기타·인강, 한 번에 4시간 넘게 켜 둔 기록 제외). 이메일·비밀번호는 관리자도 볼 수 없어요.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <Card flush className="min-w-0 p-3.5">
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        {live && <span className="size-2 rounded-full bg-live" />}
        {label}
      </p>
      <p className="num mt-0.5 truncate text-[19px] font-bold">{value}</p>
    </Card>
  );
}

function Row({ r, rank, sort, now, onOpen }: { r: AdminStudent; rank: number; sort: SortKey; now: number; onOpen: (n: string) => void }) {
  const main =
    sort === "today"
      ? { label: "오늘", sec: r.today_sec }
      : sort === "total" || sort === "level"
        ? { label: "누적", sec: r.total_sec }
        : { label: "이번 주", sec: r.week_sec };
  const sub = sort === "today" ? { label: "이번 주", sec: r.week_sec } : { label: "오늘", sec: r.today_sec };
  const ranked = sort === "week" || sort === "today" || sort === "total" || sort === "level";
  return (
    <button type="button" onClick={() => onOpen(r.nickname)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-surface-2">
      {ranked && <span className="num w-5 shrink-0 text-center text-[12px] font-semibold text-faint">{rank}</span>}
      <span className="relative shrink-0">
        <ProfileAvatar avatar={r.avatar} nickname={r.nickname} grade={r.title_grade} titleCode={r.title_code} size={36} />
        {r.studying && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-live" aria-label="공부 중" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <NameTag name={r.nickname} frame={r.name_frame} className="min-w-0 text-[15px] font-medium" />
          <LevelBadge level={r.level} />
          {r.is_admin && <Badge tone="accent">관리자</Badge>}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-muted">
          {r.grade}학년 {r.class_no}반{r.track ? ` · ${r.track}` : ""} · {r.studying ? "공부 중" : agoText(r.last_at, now)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="num block text-[14px] font-semibold">{hmText(main.sec)}</span>
        <span className="num block text-[11px] text-faint">
          {sort === "recent" || sort === "joined" || sort === "class" ? `오늘 ${hmText(r.today_sec)}` : `${sub.label} ${hmText(sub.sec)}`}
        </span>
      </span>
    </button>
  );
}
