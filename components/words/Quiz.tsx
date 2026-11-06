"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { Meaning, SpeakButton } from "@/components/words/parts";
import { LEVEL_LABEL, splitBlank, type ChoiceQ, type Question, type WmSentence } from "@/lib/wordmaster";

export type QuizAnswer = { q: Question; correct: boolean; timedOut?: boolean };
const TIMEOUT = -1; // picked 값: 시간 초과

/** 4지선다 문제의 위쪽 (방식마다 다름) */
export function ChoicePrompt({ q, revealed }: { q: ChoiceQ; revealed: boolean }) {
  if (q.mode === "meaning") {
    return (
      <div className="text-center">
        <p className="text-[13px] text-faint">알맞은 뜻을 고르세요</p>
        <div className="mt-4 flex items-center justify-center gap-1">
          <p className="break-all text-[clamp(30px,10vw,40px)] font-bold tracking-tight">{q.word.word}</p>
          <SpeakButton text={q.word.word} />
        </div>
        {revealed && <ExampleLine s={q.word.sentences[0]} />}
      </div>
    );
  }
  if (q.mode === "reverse") {
    return (
      <div className="text-center">
        <p className="text-[13px] text-faint">이 뜻의 영단어를 고르세요</p>
        <Meaning meaning={q.word.meaning} className="mt-4 text-[clamp(20px,6.4vw,26px)] font-bold leading-snug" />
        {revealed && <ExampleLine s={q.word.sentences[0]} />}
      </div>
    );
  }
  if (q.mode === "relation") {
    return (
      <div className="text-center">
        <p className="text-[13px] text-faint">
          <b className={q.rel === "반의어" ? "text-danger" : "text-accent"}>{q.rel}</b>를 고르세요
        </p>
        <p className="mt-4 break-all text-[clamp(30px,10vw,40px)] font-bold tracking-tight">{q.word.word}</p>
        <p className="mt-1 text-[14px] text-muted">{q.word.meaning}</p>
      </div>
    );
  }
  // sentence: 빈칸 문장 4지선다
  const s = q.sentence!;
  return (
    <div>
      <p className="text-[13px] text-faint">빈칸에 들어갈 단어를 고르세요 · {LEVEL_LABEL[s.level]}</p>
      <BlankLine s={s} revealed={revealed} />
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.translation}</p>
    </div>
  );
}

function ExampleLine({ s }: { s: WmSentence }) {
  const [before, after] = splitBlank(s.blanked);
  return (
    <div className="mx-auto mt-5 max-w-sm text-[14px] leading-relaxed">
      <p className="text-muted">
        {before}
        <span className="font-semibold text-text">{s.answer}</span>
        {after}
      </p>
      <p className="mt-1 text-[12px] text-faint">{s.translation}</p>
    </div>
  );
}

function BlankLine({ s, revealed, correct }: { s: WmSentence; revealed: boolean; correct?: boolean }) {
  const [before, after] = splitBlank(s.blanked);
  return (
    <p className="mt-4 text-[clamp(16px,5vw,19px)] leading-relaxed">
      {before}
      {revealed ? (
        <span className={`rounded-md px-1 font-bold ${correct === false ? "bg-danger-soft text-danger" : "bg-live-soft text-live"}`}>{s.answer}</span>
      ) : (
        <span className="inline-block w-20 border-b-2 border-accent align-baseline" />
      )}
      {after}
    </p>
  );
}

export function ChoiceButton({ state, onClick, num, children }: { state: string; onClick: () => void; num: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-13 w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left text-[15px] font-medium transition-colors ${
        {
          idle: "border-line bg-surface active:bg-surface-2",
          correct: "border-live bg-live-soft text-live",
          wrong: "border-danger bg-danger-soft text-danger",
          dim: "border-line bg-surface opacity-40",
        }[state]
      }`}
    >
      <span className="num grid size-7 shrink-0 place-items-center rounded-lg bg-bg/50 text-[13px] text-muted">{num}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {state === "correct" && <Check size={20} className="shrink-0" />}
      {state === "wrong" && <X size={20} className="shrink-0" />}
    </button>
  );
}

/** 4지선다 보기 목록 */
export function ChoiceList({ q, picked, onPick }: { q: ChoiceQ; picked: number | null; onPick: (n: number) => void }) {
  return (
    <ul className="space-y-2">
      {q.choices.map((c, n) => {
        const state = picked === null ? "idle" : n === q.answerIdx ? "correct" : n === picked ? "wrong" : "dim";
        return (
          <li key={n}>
            <ChoiceButton state={state} onClick={() => picked === null && onPick(n)} num={n + 1}>
              {c}
            </ChoiceButton>
          </li>
        );
      })}
    </ul>
  );
}

/** 남은 시간 막대 + 초. 마지막 3초는 빨간색 */
function Countdown({ remainingMs, limitMs, stopped }: { remainingMs: number; limitMs: number; stopped: boolean }) {
  const urgent = remainingMs <= 3000;
  return (
    <div className="flex items-center gap-3" aria-label="남은 시간">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${urgent ? "bg-danger" : "bg-accent"} ${stopped ? "opacity-40" : ""}`} style={{ width: `${(remainingMs / limitMs) * 100}%` }} />
      </div>
      <span className={`num w-10 text-right text-[13px] font-semibold ${urgent ? "text-danger" : "text-muted"}`}>{Math.ceil(remainingMs / 1000)}초</span>
    </div>
  );
}

/** 퀴즈 풀기 화면. 키보드 1~4로 고르고 Enter로 다음 */
export function QuizRunner({ questions, timeLimit, onDone, onExit }: { questions: Question[]; timeLimit: number; onDone: (a: QuizAnswer[]) => void; onExit: (a: QuizAnswer[]) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // 4지: 보기 번호, 빈칸: 단어 id, TIMEOUT: 시간 초과
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const q = questions[i];

  const correct = picked === null ? null : q.kind === "choice" ? picked === q.answerIdx : picked === q.word.id;
  const timedOut = picked === TIMEOUT;

  const limitMs = timeLimit * 1000;
  const [deadline, setDeadline] = useState(() => Date.now() + limitMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!limitMs || picked !== null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) setPicked((p) => (p === null ? TIMEOUT : p));
    }, 100);
    return () => clearInterval(id);
  }, [limitMs, picked, deadline]);
  const remainingMs = Math.max(0, deadline - now);

  function next() {
    const all = [...answers, { q, correct: !!correct, timedOut }];
    if (i + 1 >= questions.length) {
      onDone(all);
      return;
    }
    setAnswers(all);
    setPicked(null);
    setI(i + 1);
    const t = Date.now();
    setDeadline(t + limitMs);
    setNow(t);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picked === null && q.kind === "choice" && /^[1-4]$/.test(e.key)) setPicked(Number(e.key) - 1);
      else if (picked !== null && e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 빈칸: 같은 상자에서 이미 맞힌 단어는 흐리게
  const usedIds = new Set(q.kind === "blank" ? answers.filter((a) => a.correct && a.q.kind === "blank" && a.q.box === q.box).map((a) => a.q.word.id) : []);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center gap-3">
        <button onClick={() => onExit(answers)} aria-label="그만하기" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
          <X size={22} />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-live transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
        </div>
        <span className="num w-14 text-right text-[13px] text-muted">
          {i + 1}/{questions.length}
        </span>
      </header>

      {limitMs > 0 && <Countdown remainingMs={remainingMs} limitMs={limitMs} stopped={picked !== null} />}

      {q.kind === "choice" ? (
        <>
          <div className="flex flex-1 flex-col justify-center py-6">
            <ChoicePrompt q={q} revealed={picked !== null} />
          </div>
          <ChoiceList q={q} picked={picked} onPick={setPicked} />
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-center py-6">
            <p className="text-[13px] text-faint">빈칸에 들어갈 단어를 고르세요 · {LEVEL_LABEL[q.sentence.level]}</p>
            <BlankLine s={q.sentence} revealed={picked !== null} correct={!!correct} />
            {picked !== null && (
              <>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{q.sentence.translation}</p>
                <p className="mt-3 text-[14px] text-muted">
                  <span className="font-semibold text-text">{q.word.word}</span> {q.word.meaning}
                </p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <p className="mb-2 px-1 text-[12px] font-medium text-faint">단어 상자</p>
            <div className="flex flex-wrap gap-2">
              {q.box.map((w) => {
                const state =
                  picked !== null && w.id === q.word.id
                    ? "correct"
                    : picked !== null && w.id === picked
                      ? "wrong"
                      : usedIds.has(w.id)
                        ? "used"
                        : picked === null
                          ? "idle"
                          : "dim";
                return (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => picked === null && setPicked(w.id)}
                    className={`rounded-xl border px-3 py-2 text-[15px] font-semibold transition-colors ${
                      {
                        idle: "border-line bg-surface-2 active:bg-line",
                        used: "border-transparent bg-surface-2 text-faint line-through",
                        correct: "border-live bg-live-soft text-live",
                        wrong: "border-danger bg-danger-soft text-danger",
                        dim: "border-transparent bg-surface-2 opacity-40",
                      }[state]
                    }`}
                  >
                    {w.word}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="mt-4 h-14">
        {picked !== null && (
          <PrimaryButton onClick={next} tone={correct ? "accent" : "danger"}>
            {correct ? "정답!" : timedOut ? "시간 초과" : "틀렸어요"} · {i + 1 >= questions.length ? "결과 보기" : "다음"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/** 퀴즈 결과 */
export function QuizResult({ title, answers, onRetryWrong, onRestart }: { title: string; answers: QuizAnswer[]; onRetryWrong: () => void; onRestart: () => void }) {
  const right = answers.filter((a) => a.correct).length;
  const wrong = answers.filter((a) => !a.correct);
  const timedOut = answers.filter((a) => a.timedOut).length;
  const score = Math.round((right / answers.length) * 100);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="text-center">
        <p className="text-[13px] text-muted">{title} 결과</p>
        <p className="num mt-2 text-[56px] font-bold leading-none">
          {score}
          <span className="text-[22px] text-muted">점</span>
        </p>
        <p className="mt-2 text-[14px] text-muted">
          {answers.length}문제 중 <span className="font-semibold text-live">{right}개</span> 맞힘
          {timedOut > 0 && <span className="text-danger"> · 시간 초과 {timedOut}개</span>}
        </p>
        {wrong.length > 0 && <p className="mt-1 text-[12px] text-faint">틀린 단어는 내일 복습에 나와요.</p>}
      </div>

      {wrong.length > 0 ? (
        <div className="mt-8 flex-1">
          <p className="mb-2 text-[15px] font-semibold">틀린 단어 {wrong.length}개</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {wrong.map(({ q, timedOut }, n) => (
              <li key={`${q.word.id}-${n}`} className="px-4 py-3">
                <p className="text-[15px]">
                  <span className="font-semibold">{q.word.word}</span> <span className="text-muted">{q.word.meaning}</span>
                  {timedOut && <span className="ml-1.5 whitespace-nowrap rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">시간 초과</span>}
                </p>
                {q.kind === "blank" && <p className="mt-1 text-[13px] leading-relaxed text-faint">{q.sentence.text}</p>}
                {q.kind === "choice" && q.mode === "relation" && (
                  <p className="mt-1 text-[13px] text-faint">
                    {q.rel}: {q.choices[q.answerIdx]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-10 flex-1 text-center text-[15px] font-semibold text-live">전부 맞혔어요! 🎉</p>
      )}

      <div className="mt-6 space-y-2.5">
        {wrong.length > 0 && (
          <PrimaryButton onClick={onRetryWrong}>
            <RotateCcw size={18} /> 틀린 것만 다시
          </PrimaryButton>
        )}
        <button onClick={onRestart} className="h-14 w-full rounded-2xl border border-line bg-surface text-[15px] font-semibold">
          다시 설정하기
        </button>
        <Link href="/words" className="block py-2 text-center text-[14px] text-muted">
          워마 처음으로
        </Link>
      </div>
    </div>
  );
}
