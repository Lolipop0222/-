"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUp, RotateCcw, X } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { useProfile } from "@/components/AuthProvider";
import { PrimaryButton } from "@/components/ui";
import { ChoiceList, ChoicePrompt } from "@/components/words/Quiz";
import { BOX_STYLE, Example, Meaning, SpeakButton } from "@/components/words/parts";
import { dayOf, loadDays, meaningQ, reviewQuestion, sentenceFor, type ChoiceQ, type WmDay } from "@/lib/wordmaster";
import { MASTERED, dayStats, dueIds, nextDay, recordAnswers, useWordStore, type WordStore } from "@/lib/wordProgress";

const BATCH = 20; // 한 번에 20개씩

type Item = { q: ChoiceQ; box: number; retry: boolean }; // retry: 틀린 단어 한 번 더 (기록 안 함)
type Done = { id: number; word: string; meaning: string; ok: boolean; from: number };

/** 오늘 복습 — 날이 된 단어를 낮은 단계부터 20개씩. 맞히면 한 칸 위로, 틀리면 1단계로 */
export default function ReviewPage() {
  const profile = useProfile();
  const store = useWordStore(profile.id);
  const [round, setRound] = useState(0);
  if (store.status !== "ready") {
    return (
      <div className="pt-24">
        <AppLoader label="복습할 단어 찾는 중…" />
      </div>
    );
  }
  return <ReviewRound key={round} store={store} onMore={() => setRound((r) => r + 1)} />;
}

function ReviewRound({ store, onMore }: { store: WordStore; onMore: () => void }) {
  // 시작할 때의 목록·단계를 고정한다 (기록하면 바뀌므로)
  const [ids] = useState(() => dueIds(store).slice(0, BATCH));
  const [boxes] = useState(() => new Map(ids.map((id) => [id, store.progress.get(id)!.box])));
  const [days, setDays] = useState<Map<number, WmDay> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState<Done[]>([]);

  useEffect(() => {
    if (!ids.length) return;
    loadDays(ids.map(dayOf)).then(
      (m) => {
        setDays(m);
        const items: Item[] = [];
        for (const id of ids) {
          const d = m.get(dayOf(id))!;
          const w = d.words.find((x) => x.id === id);
          if (w) items.push({ q: reviewQuestion(w, d.words, boxes.get(id) ?? 1), box: boxes.get(id) ?? 1, retry: false });
        }
        setQueue(items);
      },
      (e: Error) => setError(e.message),
    );
  }, [ids, boxes]);

  if (!ids.length) return <Empty store={store} />;
  if (error) return <p className="px-5 py-24 text-center text-[14px] text-danger">{error}</p>;
  if (!queue || !days) {
    return (
      <div className="pt-24">
        <AppLoader label="단어 불러오는 중…" />
      </div>
    );
  }
  if (i >= queue.length) return <Summary done={done} store={store} onMore={onMore} />;

  const item = queue[i];
  const { q } = item;
  const correct = picked === null ? null : picked === q.answerIdx;
  const firstCount = queue.filter((x) => !x.retry).length;

  function pick(n: number) {
    if (picked !== null) return;
    setPicked(n);
    const ok = n === q.answerIdx;
    if (item.retry) return;
    void recordAnswers([{ id: q.word.id, ok }]);
    setDone((d) => [...d, { id: q.word.id, word: q.word.word, meaning: q.word.meaning, ok, from: item.box }]);
    // 틀린 단어는 이번 복습 끝에 한 번 더 (뜻 고르기로, 기록은 안 함)
    if (!ok) {
      const d = days!.get(q.word.day)!;
      setQueue((qs) => [...qs!, { q: meaningQ(q.word, d.words), box: 1, retry: true }]);
    }
  }

  function next() {
    setPicked(null);
    setI((n) => n + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center gap-3">
        <Link href="/words" aria-label="그만하기" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
          <X size={22} />
        </Link>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-live transition-all" style={{ width: `${(Math.min(i, firstCount) / firstCount) * 100}%` }} />
        </div>
        <span className="num w-14 text-right text-[13px] text-muted">{item.retry ? "다시" : `${i + 1}/${firstCount}`}</span>
      </header>

      <div className="flex items-center gap-1.5">
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${BOX_STYLE[item.box].cls}`}>{item.retry ? "한 번 더" : BOX_STYLE[item.box].label}</span>
        <span className="text-[11px] text-faint">DAY {q.word.day}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-5">
        <ChoicePrompt q={q} revealed={false} />
      </div>

      {picked === null ? (
        <ChoiceList q={q} picked={picked} onPick={pick} />
      ) : (
        <div className="space-y-3">
          <ChoiceList q={q} picked={picked} onPick={() => {}} />
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-1">
              <p className="min-w-0 flex-1 break-words text-[18px] font-bold">{q.word.word}</p>
              <SpeakButton text={q.word.word} />
            </div>
            <Meaning meaning={q.word.meaning} className="text-[14px] text-muted" />
            <div className="mt-3">
              <Example s={q.sentence ?? sentenceFor(q.word, item.box)} />
            </div>
            {!item.retry && (
              <p className={`mt-3 flex items-center gap-1 text-[12px] font-semibold ${correct ? "text-live" : "text-danger"}`}>
                {correct ? (
                  <>
                    <ArrowUp size={14} /> {item.box >= 5 ? "외웠어요! 이제 복습에 안 나와요" : `${item.box + 1}단계로 올라가요`}
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} /> 1단계로 — 내일 다시 나오고, 이번 복습 끝에 한 번 더 봐요
                  </>
                )}
              </p>
            )}
          </div>
          <PrimaryButton onClick={next} tone={correct ? "accent" : "danger"}>
            {correct ? "정답!" : "틀렸어요"} · 다음
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function Summary({ done, store, onMore }: { done: Done[]; store: WordStore; onMore: () => void }) {
  const up = done.filter((d) => d.ok);
  const down = done.filter((d) => !d.ok);
  const mastered = up.filter((d) => d.from >= 5).length;
  const left = dueIds(store).length;
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="text-center">
        <p className="text-[13px] text-muted">오늘 복습</p>
        <p className="num mt-2 text-[56px] font-bold leading-none">
          {Math.round((up.length / Math.max(1, done.length)) * 100)}
          <span className="text-[22px] text-muted">점</span>
        </p>
        <p className="mt-3 text-[14px] text-muted">
          <span className="font-semibold text-live">{up.length}개 올라감</span>
          {mastered > 0 && <span className="font-semibold text-live"> (외움 {mastered})</span>} · <span className="font-semibold text-danger">{down.length}개 1단계로</span>
        </p>
      </div>
      {down.length > 0 ? (
        <div className="mt-8 flex-1">
          <p className="mb-2 text-[15px] font-semibold">다시 볼 단어</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {down.map((d) => (
              <li key={d.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="w-28 shrink-0 break-words text-[15px] font-semibold">{d.word}</span>
                <span className="min-w-0 text-[13px] text-muted">{d.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-10 flex-1 text-center text-[15px] font-semibold text-live">전부 맞혔어요! 🎉</p>
      )}
      <div className="mt-6 space-y-2.5">
        {left > 0 && (
          <PrimaryButton onClick={onMore} tone="live">
            남은 복습 {left}개 이어서
          </PrimaryButton>
        )}
        {left > 0 ? (
          <Link href="/words" className="flex h-14 w-full items-center justify-center rounded-2xl border border-line bg-surface text-[15px] font-semibold">
            워마로 돌아가기
          </Link>
        ) : (
          <PrimaryButton href="/words" tone="live">
            워마로 돌아가기
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function Empty({ store }: { store: WordStore }) {
  const stats = dayStats(store);
  const seen = stats.reduce((a, d) => a + d.seen, 0);
  const upcoming = [...store.progress.values()].filter((p) => p.box < MASTERED && p.due).map((p) => p.due!).sort();
  const nextDue = upcoming[0];
  const nextCount = upcoming.filter((d) => d === nextDue).length;
  const day = nextDay(stats);
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center">
        <Link href="/words" aria-label="뒤로" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
          <X size={22} />
        </Link>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[40px]">{seen ? "✅" : "📘"}</p>
        <p className="mt-3 text-[18px] font-bold">{seen ? "오늘 복습할 단어가 없어요" : "아직 외운 단어가 없어요"}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {nextDue ? (
            <>
              다음 복습: <b className="text-text">{fmtDate(nextDue)}</b> · {nextCount}개
            </>
          ) : (
            "암기 카드로 단어를 외우면 정해진 날에 복습이 나와요."
          )}
        </p>
      </div>
      <PrimaryButton href={`/words/day/${day}`}>DAY {day} 외우러 가기</PrimaryButton>
    </div>
  );
}

const fmtDate = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}월 ${d}일`;
};
