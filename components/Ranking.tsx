"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Users } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { Segmented } from "@/components/ui";
import { hm } from "@/lib/format";
import { koreanError } from "@/lib/supabase";
import { getRanking, type RankRow, type RankScope } from "@/lib/study";
import { RANKED_SUBJECTS, SUBJECT_COLOR, type RankedSubject } from "@/lib/subjects";

const SCOPES = ["전교", "학년", "반"] as const;
const SCOPE_VALUE: Record<(typeof SCOPES)[number], RankScope> = { 전교: "school", 학년: "grade", 반: "class" };
const MEDAL = ["#ffd166", "#c9d1e0", "#e0a37a"];

/** 이번 주 순위 — 범위(전교/학년/반) × 과목. 내 순위를 가운데 두고 위아래 세 명씩 */
export default function Ranking() {
  const study = useStudy();
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("반");
  const [subject, setSubject] = useState<RankedSubject | null>(null);
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 범위·과목이 바뀌거나 내 기록이 저장되면 다시 불러온다
  useEffect(() => {
    let alive = true;
    getRanking(SCOPE_VALUE[scope], subject).then(
      (r) => alive && (setRows(r), setError(null)),
      (e) => alive && setError(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [scope, subject, study.version]);

  const meIdx = rows?.findIndex((r) => r.is_me) ?? -1;
  const around = rows && meIdx >= 0 ? rows.slice(Math.max(0, meIdx - 3), meIdx + 4) : (rows ?? []).slice(0, 7);
  // 위아래 세 명 안에 1등이 들어오면 상위 3명은 따로 보여주지 않는다
  const top = rows && (around[0]?.rank ?? 1) > 1 ? rows.slice(0, 3) : [];

  return (
    <section id="ranking" className="scroll-mt-4 px-5 pt-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-[20px] font-bold">이번 주 순위</h2>
        <p className="text-[12px] text-faint">매주 월요일 0시 초기화</p>
      </div>

      <Segmented items={SCOPES} value={scope} onChange={setScope} />

      {/* 과목 */}
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        <SubjectChip active={subject === null} onClick={() => setSubject(null)} label="전체" />
        {RANKED_SUBJECTS.map((s) => (
          <SubjectChip key={s} active={subject === s} onClick={() => setSubject(s)} label={s} color={SUBJECT_COLOR[s]} />
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}
      {!rows && !error && <p className="py-10 text-center text-[14px] text-faint">불러오는 중…</p>}

      {top.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {top.map((r, i) => (
            <div key={r.nickname} className="rounded-2xl bg-surface p-3 text-center">
              <Crown size={18} className="mx-auto" style={{ color: MEDAL[i] }} fill={MEDAL[i]} />
              <span className="mt-1.5 flex justify-center">
                <ProfileAvatar avatar={r.avatar} nickname={r.nickname} grade={r.title_grade} size={36} />
              </span>
              <p className="mt-1 truncate text-[13px] font-semibold">{r.nickname}</p>
              {r.title_name && (
                <span className="flex justify-center">
                  <TitleBadge name={r.title_name} grade={r.title_grade} size="xs" />
                </span>
              )}
              <p className="num text-[12px] text-muted">{hm(r.total_sec)}</p>
            </div>
          ))}
        </div>
      )}

      {rows && rows.length > 0 && (
        <ol className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          {top.length > 0 && around[0].rank > 4 && <li className="py-1 text-center text-[12px] tracking-[0.3em] text-faint">⋯</li>}
          {around.map((r) => (
            <RankItem key={r.nickname} row={r} />
          ))}
        </ol>
      )}
      {rows && (
        <p className="mt-2 text-center text-[12px] text-faint">
          {scope} {rows.length}명 중{subject ? ` · ${subject}` : ""} · 진행 중인 공부는 끝나면 반영돼요
        </p>
      )}
      <Link href="/groups" className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          <Users size={17} className="text-accent" /> 스터디그룹 순위 보기
        </span>
        <ChevronRight size={18} className="text-faint" />
      </Link>
    </section>
  );
}

function SubjectChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
        active ? "border-transparent text-on-subject" : "border-line text-muted"
      }`}
      style={active ? (color ? { background: color } : { background: "var(--text)", color: "var(--bg)" }) : undefined}
    >
      {label}
    </button>
  );
}

function RankItem({ row }: { row: RankRow }) {
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 ${
        row.is_me ? "bg-accent-soft ring-1 ring-inset ring-accent/40" : "border-t border-line first:border-t-0"
      }`}
    >
      <span className={`num w-8 text-[15px] font-bold ${row.is_me ? "text-accent" : "text-muted"}`}>{row.rank}</span>
      <span className="relative">
        <ProfileAvatar avatar={row.avatar} nickname={row.nickname} grade={row.title_grade} size={34} />
        {row.studying && <span className="live-dot absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-live" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium">{row.nickname}</span>
          {row.is_me && <span className="shrink-0 text-[12px] text-accent">나</span>}
          <span className="shrink-0 text-[11px] text-faint">
            {row.grade}-{row.class_no}
          </span>
        </span>
        {row.title_name && (
          <span className="mt-0.5 flex">
            <TitleBadge name={row.title_name} grade={row.title_grade} size="xs" />
          </span>
        )}
      </span>
      <span className="num text-[14px] font-semibold">{hm(row.total_sec)}</span>
    </li>
  );
}
