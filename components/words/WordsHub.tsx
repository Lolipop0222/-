"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Camera, ChevronRight, Layers, PenLine, Play, Search } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { useProfile } from "@/components/AuthProvider";
import { Card, SectionTitle } from "@/components/ui";
import { WM_DAYS, WM_WORDS, WORDS_PER_DAY } from "@/lib/wordmaster";
import { BOX_INTERVAL_DAYS, MASTERED, boxCounts, dayBestScore, dayStats, dueIds, nextDay, useWordStore } from "@/lib/wordProgress";

const DAYS = Array.from({ length: WM_DAYS }, (_, i) => i + 1);

/** 워마 첫 화면: 오늘 복습 · 이어서 외우기 · 전체 진도 · 상자별 단어 · DAY 1~50 */
export default function WordsHub() {
  const profile = useProfile();
  const store = useWordStore(profile.id);
  const stats = useMemo(() => dayStats(store), [store]);
  const due = useMemo(() => dueIds(store).length, [store]);
  const boxes = useMemo(() => boxCounts(store), [store]);

  if (store.status !== "ready") return <AppLoader label="진도 불러오는 중…" />;

  const seen = store.progress.size;
  const mastered = boxes[MASTERED - 1];
  const learning = seen - mastered;
  const day = nextDay(stats);
  const dayLeft = WORDS_PER_DAY - stats[day - 1].seen;
  const boxMax = Math.max(1, ...boxes.slice(0, 5));

  return (
    <div className="space-y-4">
      {store.backend === "local" && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-[12px] leading-relaxed text-warn">
          지금은 진도가 <b>이 기기에만</b> 저장돼요. 데이터베이스 업데이트(07-words)가 끝나면 계정으로 자동으로 옮겨져요.
        </p>
      )}

      {/* 오늘 복습 */}
      <Card flush className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-live/10 blur-2xl" />
        <p className="text-[13px] text-muted">오늘 복습할 단어</p>
        <p className="num mt-1 text-[40px] font-bold leading-none text-live">
          {due}
          <span className="ml-1 text-[18px] text-text">개</span>
        </p>
        <p className="mt-2 text-[13px] text-muted">
          {due ? `한 번에 20개씩 · 약 ${Math.max(1, Math.round((Math.min(due, 20) * 15) / 60))}분` : seen ? "오늘 복습은 끝! 새 단어를 외워 볼까요?" : "암기 카드로 첫 단어를 외워 보세요."}
        </p>
        {due > 0 ? (
          <Link href="/words/review" className="mt-5 flex h-13 items-center justify-center gap-2 rounded-2xl bg-live text-[16px] font-bold text-bg active:scale-[0.98]">
            <Play size={18} fill="currentColor" />
            복습 시작
          </Link>
        ) : (
          <Link href={`/words/day/${day}`} className="mt-5 flex h-13 items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-bold text-bg active:scale-[0.98]">
            <Layers size={18} />
            DAY {day} 외우기
          </Link>
        )}
      </Card>

      {/* 이어서 외우기 (복습이 있을 때만 따로 보여 줌) */}
      {due > 0 && dayLeft > 0 && (
        <Link href={`/words/day/${day}`} className="block">
          <Card className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Layers size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-muted">이어서 외우기</p>
              <p className="text-[15px] font-bold">
                DAY {day} · 새 단어 {dayLeft}개
              </p>
            </div>
            <ChevronRight size={20} className="text-faint" />
          </Card>
        </Link>
      )}

      {/* 단어 찾기 */}
      <Link href="/words/search" className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-[14px] text-faint active:bg-surface-2">
        <Search size={18} />
        2,000단어에서 찾기 (영어·뜻)
      </Link>

      {/* 전체 진도 + 상자별 */}
      <Card>
        <div className="flex items-end justify-between">
          <SectionTitle>내 진도</SectionTitle>
          <p className="num -mt-2 text-[12px] text-faint">
            {seen.toLocaleString()} / {WM_WORDS.toLocaleString()} 단어 봄
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat n={mastered} label="외움" cls="text-live" />
          <Stat n={learning} label="외우는 중" cls="text-accent" />
          <Stat n={WM_WORDS - seen} label="새 단어" cls="text-muted" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="flex h-full">
            <span className="bg-live" style={{ width: `${(mastered / WM_WORDS) * 100}%` }} />
            <span className="bg-accent/60" style={{ width: `${(learning / WM_WORDS) * 100}%` }} />
          </div>
        </div>

        <p className="mt-5 text-[13px] font-semibold">상자별 단어</p>
        <div className="mt-2 flex h-24 items-end gap-2">
          {boxes.slice(0, 5).map((n, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="num text-[12px] font-semibold">{n}</span>
              <div className="w-full rounded-lg bg-accent" style={{ height: `${Math.max(4, (n / boxMax) * 70)}%`, opacity: 0.35 + i * 0.16 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 text-center">
          {BOX_INTERVAL_DAYS.map((d, i) => (
            <div key={i} className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold">{i + 1}단계</p>
              <p className="text-[10px] text-faint">{d}일 뒤</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-muted">
          복습할 날에 맞히면 한 칸 위로, 틀리면 1단계로 돌아가요. 5단계에서 맞히면 <b className="text-live">외움</b>이에요.
        </p>
      </Card>

      {/* DAY 1~50 */}
      <Card>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">워드마스터 수능 2000</h2>
            <p className="mt-0.5 text-[12px] text-muted">DAY마다 40단어 · 암기 카드·퀴즈</p>
          </div>
          <p className="num text-[12px] text-faint">
            {stats.filter((d) => d.seen === WORDS_PER_DAY).length}/{WM_DAYS} DAY
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {DAYS.map((d) => {
            const s = stats[d - 1];
            const score = dayBestScore(store, d);
            const full = s.mastered === WORDS_PER_DAY;
            return (
              <Link
                key={d}
                href={`/words/day/${d}`}
                className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border text-center active:scale-95 ${
                  full ? "border-live/50 bg-live-soft" : s.seen ? "border-accent/40 bg-accent-soft" : "border-line bg-surface-2"
                }`}
              >
                {s.due > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-live" aria-label="복습 있음" />}
                <span className="text-[10px] font-medium text-faint">DAY</span>
                <span className="num text-[17px] font-bold leading-tight">{d}</span>
                {score !== null ? (
                  <span className={`num text-[10px] font-semibold ${score >= 90 ? "text-live" : "text-accent"}`}>{score}점</span>
                ) : s.seen ? (
                  <span className="num text-[10px] text-muted">{s.seen}/40</span>
                ) : null}
                {s.seen > 0 && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-line">
                    <span className="block h-full bg-live" style={{ width: `${(s.mastered / WORDS_PER_DAY) * 100}%` }} />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">칸 아래 막대 = 외운 비율 · 초록 점 = 오늘 복습 있음 · 점수 = 퀴즈 최고 점수</p>
      </Card>

      {/* 내 단어장 (준비 중) */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/words/scan" className="flex flex-col rounded-2xl border border-dashed border-line bg-surface p-4 opacity-80 active:bg-surface-2">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <Camera size={18} />
          </span>
          <span className="mt-2 block text-[14px] font-semibold">사진 스캔</span>
          <span className="text-[11px] text-faint">준비 중</span>
        </Link>
        <Link href="/words/add" className="flex flex-col rounded-2xl border border-dashed border-line bg-surface p-4 opacity-80 active:bg-surface-2">
          <span className="grid size-9 place-items-center rounded-xl bg-warn-soft text-warn">
            <PenLine size={18} />
          </span>
          <span className="mt-2 block text-[14px] font-semibold">직접 입력</span>
          <span className="text-[11px] text-faint">준비 중</span>
        </Link>
      </div>
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className={`num text-[20px] font-bold leading-tight ${cls}`}>{n.toLocaleString()}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
