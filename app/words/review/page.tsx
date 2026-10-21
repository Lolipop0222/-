"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { words, type Word } from "@/lib/mock";

/** 같은 DAY의 다른 단어에서 오답 보기 3개를 뽑는다 (UI 단계: 고정 순서) */
function choicesFor(w: Word, idx: number) {
  const others = words.filter((o) => o.id !== w.id && o.day === w.day);
  const wrong = [0, 1, 2].map((k) => others[(idx + k * 2) % others.length].ko);
  const all = [...wrong];
  all.splice(idx % 4, 0, w.ko);
  return all;
}

export default function ReviewPage() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);

  const done = i >= words.length;
  const word = words[i];
  const choices = done ? [] : choicesFor(word, i);
  const answerIdx = done ? -1 : choices.indexOf(word.ko);

  function pick(n: number) {
    if (picked !== null) return;
    setPicked(n);
    setResults((r) => [...r, n === answerIdx]);
  }

  function next() {
    setPicked(null);
    setI((v) => v + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center gap-3">
        <Link href="/words" aria-label="그만하기" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
          <X size={22} />
        </Link>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-live transition-all" style={{ width: `${(Math.min(i, words.length) / words.length) * 100}%` }} />
        </div>
        <span className="num w-12 text-right text-[13px] text-muted">
          {Math.min(i + 1, words.length)}/{words.length}
        </span>
      </header>

      {done ? (
        <Result results={results} />
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-center py-10 text-center">
            <p className="text-[13px] text-faint">
              DAY {word.day} · {word.box}단계 상자
            </p>
            <p className="mt-4 text-[40px] font-bold tracking-tight">{word.en}</p>
            <p className="mt-1 text-[14px] text-muted">{word.pos}</p>
          </div>

          <ul className="space-y-2.5">
            {choices.map((c, n) => {
              const state =
                picked === null ? "idle" : n === answerIdx ? "correct" : n === picked ? "wrong" : "dim";
              return (
                <li key={n}>
                  <button
                    onClick={() => pick(n)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left text-[16px] font-medium transition-colors ${
                      {
                        idle: "border-line bg-surface active:bg-surface-2",
                        correct: "border-live bg-live-soft text-live",
                        wrong: "border-danger bg-danger-soft text-danger",
                        dim: "border-line bg-surface opacity-40",
                      }[state]
                    }`}
                  >
                    <span className="num grid size-7 place-items-center rounded-lg bg-bg/50 text-[13px] text-muted">{n + 1}</span>
                    <span className="flex-1">{c}</span>
                    {state === "correct" && <Check size={20} />}
                    {state === "wrong" && <X size={20} />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 h-14">
            {picked !== null && (
              <PrimaryButton onClick={next}>
                {picked === answerIdx ? `정답! ${Math.min(word.box + 1, 5)}단계로` : "1단계로 돌아가요 · 다음"}
              </PrimaryButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Result({ results }: { results: boolean[] }) {
  const right = results.filter(Boolean).length;
  const wrong = results.length - right;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[56px]">🎉</p>
        <h1 className="mt-2 text-[24px] font-bold">오늘 복습 끝!</h1>
        <p className="mt-2 text-[14px] text-muted">
          포인트 <span className="font-semibold text-accent">+{right * 2}</span>
        </p>
        <div className="mt-8 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-live-soft p-4">
            <ArrowUp className="mx-auto text-live" size={20} />
            <p className="num mt-1 text-[24px] font-bold text-live">{right}</p>
            <p className="text-[12px] text-muted">한 칸 위로</p>
          </div>
          <div className="rounded-2xl bg-danger-soft p-4">
            <ArrowDown className="mx-auto text-danger" size={20} />
            <p className="num mt-1 text-[24px] font-bold text-danger">{wrong}</p>
            <p className="text-[12px] text-muted">1단계로</p>
          </div>
        </div>
      </div>
      <PrimaryButton href="/words">워마로 돌아가기</PrimaryButton>
    </div>
  );
}
