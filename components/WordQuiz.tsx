"use client";

import { AppLoader } from "@/components/BrandLoader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { PrimaryButton, Segmented } from "@/components/ui";
import {
  LEVEL_LABEL,
  buildBlankQuiz,
  buildMeaningQuiz,
  loadDay,
  readBest,
  saveBest,
  shuffle,
  splitBlank,
  type Best,
  type LevelChoice,
  type QuizMode,
  type Question,
  type WmDay,
  type WmWord,
} from "@/lib/wordmaster";

const COUNTS = ["10문제", "20문제", "40문제"] as const;
const LEVELS = ["기본", "응용", "심화", "섞어서"] as const;
const LEVEL_VALUE: Record<(typeof LEVELS)[number], LevelChoice> = { 기본: "basic", 응용: "applied", 심화: "advanced", 섞어서: "mix" };
// 문제당 제한 시간 (셀프 옵션). 시간이 지나면 오답 처리
const LIMITS = ["끄기", "5초", "10초", "15초"] as const;
type Limit = (typeof LIMITS)[number];
const LIMIT_KEY = "wm:timeLimit";
const TIMEOUT = -1; // picked 값: 시간 초과

type Setup = { mode: QuizMode; level: LevelChoice; timeLimit: number }; // timeLimit: 초, 0이면 끄기
type Answer = { q: Question; correct: boolean; timedOut?: boolean };

function readLimit(): Limit {
  try {
    const v = localStorage.getItem(LIMIT_KEY) as Limit | null;
    return v && LIMITS.includes(v) ? v : "끄기";
  } catch {
    return "끄기";
  }
}

function saveLimit(v: Limit) {
  try {
    localStorage.setItem(LIMIT_KEY, v);
  } catch {
    // 저장소를 못 쓰면 매번 끄기로 시작
  }
}

export default function WordQuiz({ day }: { day: number }) {
  const [data, setData] = useState<WmDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup>({ mode: "meaning", level: "basic", timeLimit: 0 });
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    loadDay(day).then(setData, (e: Error) => setError(e.message));
  }, [day]);

  function start(targets: WmWord[], s: Setup) {
    if (!data) return;
    setSetup(s);
    setAnswers([]);
    setQuestions(s.mode === "meaning" ? buildMeaningQuiz(data.words, targets) : buildBlankQuiz(data.words, targets, s.level));
  }

  function finish(all: Answer[]) {
    setAnswers(all);
    saveBest(day, setup.mode, { correct: all.filter((a) => a.correct).length, total: all.length });
  }

  if (error) {
    return (
      <Shell day={day}>
        <p className="py-20 text-center text-[14px] text-danger">{error}</p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell day={day}>
        <div className="py-8"><AppLoader label="단어 불러오는 중…" /></div>
      </Shell>
    );
  }
  if (!questions) {
    return <SetupScreen data={data} onStart={start} />;
  }
  if (answers.length === questions.length && answers.length > 0) {
    return (
      <ResultScreen
        day={day}
        answers={answers}
        onRetryWrong={() => start(answers.filter((a) => !a.correct).map((a) => a.q.word), setup)}
        onRestart={() => setQuestions(null)}
      />
    );
  }
  return (
    <QuizScreen
      key={questions.map((q) => q.word.id).join()}
      questions={questions}
      timeLimit={setup.timeLimit}
      onDone={finish}
      onExit={() => setQuestions(null)}
    />
  );
}

function Shell({ day, children }: { day: number; children: React.ReactNode }) {
  return (
    <div className="px-5 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center gap-2">
        <Link href="/words" aria-label="뒤로" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-semibold">DAY {day}</h1>
      </header>
      {children}
    </div>
  );
}

// ───────────────────────── 시작 화면 ─────────────────────────

function SetupScreen({ data, onStart }: { data: WmDay; onStart: (targets: WmWord[], s: Setup) => void }) {
  const [mode, setMode] = useState<QuizMode>("meaning");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("기본");
  const [count, setCount] = useState<(typeof COUNTS)[number]>("20문제");
  // 이 화면은 브라우저에서만 그려지므로 바로 localStorage를 읽어도 된다
  const [limit, setLimit] = useState<Limit>(readLimit);
  const [showList, setShowList] = useState(false);
  // 이 화면은 단어를 받은 뒤 브라우저에서만 그려지므로 바로 localStorage를 읽어도 된다
  const [best] = useState<Record<QuizMode, Best | null>>(() => ({
    meaning: readBest(data.day, "meaning"),
    blank: readBest(data.day, "blank"),
  }));

  function begin() {
    const n = parseInt(count);
    // 문제 수만큼 무작위로 고른다 (40이면 DAY 전체)
    const pick = shuffle(data.words).slice(0, n);
    saveLimit(limit);
    onStart(pick, { mode, level: LEVEL_VALUE[level], timeLimit: limit === "끄기" ? 0 : parseInt(limit) });
  }

  return (
    <Shell day={data.day}>
      <p className="-mt-1 text-[13px] text-muted">워드마스터 수능 2000 · {data.words.length}단어</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <ModeCard
          active={mode === "meaning"}
          onClick={() => setMode("meaning")}
          title="뜻 고르기"
          desc="영단어를 보고 4개 중 뜻 고르기"
          best={best.meaning}
        />
        <ModeCard
          active={mode === "blank"}
          onClick={() => setMode("blank")}
          title="빈칸 채우기"
          desc="단어 상자에서 문장에 맞는 단어 고르기"
          best={best.blank}
        />
      </div>

      {mode === "blank" && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-muted">문장 난이도</p>
          <Segmented items={LEVELS} value={level} onChange={setLevel} />
          <p className="mt-2 text-[12px] text-faint">기본은 교재 예문, 심화는 수능 지문 수준이에요.</p>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-[13px] font-medium text-muted">문제 수</p>
        <Segmented items={COUNTS} value={count} onChange={setCount} />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[13px] font-medium text-muted">문제당 제한 시간</p>
        <Segmented items={LIMITS} value={limit} onChange={setLimit} />
        <p className="mt-2 text-[12px] text-faint">
          {limit === "끄기" ? "시간 제한 없이 풀어요." : "시간 안에 못 고르면 틀린 걸로 쳐요."}
          {limit === "5초" && mode === "blank" && " 빈칸 채우기는 10초 이상을 추천해요."}
        </p>
      </div>

      <PrimaryButton onClick={begin} className="mt-6">
        시작하기
      </PrimaryButton>

      <button
        onClick={() => setShowList((v) => !v)}
        className="mt-6 flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] font-semibold"
      >
        단어 목록 보기
        <ChevronDown size={18} className={`text-muted transition-transform ${showList ? "rotate-180" : ""}`} />
      </button>
      {showList && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {data.words.map((w) => (
            <li key={w.id} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="w-32 shrink-0 text-[15px] font-semibold">{w.word}</span>
              <span className="text-[13px] text-muted">{w.meaning}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="h-8" />
    </Shell>
  );
}

function ModeCard({ active, onClick, title, desc, best }: { active: boolean; onClick: () => void; title: string; desc: string; best: Best | null }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-2xl border p-4 text-left transition-colors ${
        active ? "border-accent bg-accent-soft" : "border-line bg-surface"
      }`}
    >
      <span className={`text-[16px] font-bold ${active ? "text-accent" : ""}`}>{title}</span>
      <span className="mt-1 text-[12px] leading-snug text-muted">{desc}</span>
      <span className="num mt-3 text-[12px] text-faint">
        {best ? `최고 ${Math.round((best.correct / best.total) * 100)}점` : "아직 안 풀었어요"}
      </span>
    </button>
  );
}

// ───────────────────────── 문제 화면 ─────────────────────────

function QuizScreen({
  questions,
  timeLimit,
  onDone,
  onExit,
}: {
  questions: Question[];
  timeLimit: number;
  onDone: (a: Answer[]) => void;
  onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // 뜻: 보기 번호, 빈칸: 단어 id, TIMEOUT: 시간 초과
  const [answers, setAnswers] = useState<Answer[]>([]);
  const q = questions[i];

  const correct = picked === null ? null : q.kind === "meaning" ? picked === q.answerIdx : picked === q.word.id;
  const timedOut = picked === TIMEOUT;

  // 제한 시간 — 문제마다 새로 잰다. 답을 고르면 멈춘다
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

  function pick(v: number) {
    if (picked !== null) return;
    setPicked(v);
  }

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

  // 빈칸: 같은 상자에서 이미 맞힌 단어는 흐리게
  const usedIds = new Set(
    q.kind === "blank" ? answers.filter((a) => a.correct && a.q.kind === "blank" && a.q.box === q.box).map((a) => a.q.word.id) : [],
  );

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 items-center gap-3">
        <button onClick={onExit} aria-label="그만하기" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
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

      {q.kind === "meaning" ? (
        <>
          <div className="flex flex-1 flex-col justify-center py-8 text-center">
            <p className="text-[13px] text-faint">알맞은 뜻을 고르세요</p>
            <p className="mt-4 break-words text-[40px] font-bold tracking-tight">{q.word.word}</p>
            {picked !== null && <Example sentence={q.word.sentences[0].blanked} answer={q.word.sentences[0].answer} />}
          </div>
          <ul className="space-y-2.5">
            {q.choices.map((c, n) => {
              const state = picked === null ? "idle" : n === q.answerIdx ? "correct" : n === picked ? "wrong" : "dim";
              return (
                <li key={n}>
                  <ChoiceButton state={state} onClick={() => pick(n)} num={n + 1}>
                    {c}
                  </ChoiceButton>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-center py-6">
            <p className="text-[13px] text-faint">
              빈칸에 들어갈 단어를 고르세요 · {LEVEL_LABEL[q.sentence.level]}
            </p>
            <BlankSentence q={q} revealed={picked !== null} correct={!!correct} />
            {picked !== null && (
              <p className="mt-3 text-[14px] text-muted">
                <span className="font-semibold text-text">{q.word.word}</span> {q.word.meaning}
              </p>
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
                    key={w.id}
                    onClick={() => pick(w.id)}
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

/** 남은 시간 막대 + 초. 마지막 3초는 빨간색 */
function Countdown({ remainingMs, limitMs, stopped }: { remainingMs: number; limitMs: number; stopped: boolean }) {
  const urgent = remainingMs <= 3000;
  return (
    <div className="flex items-center gap-3" aria-label="남은 시간">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${urgent ? "bg-danger" : "bg-accent"} ${stopped ? "opacity-40" : ""}`}
          style={{ width: `${(remainingMs / limitMs) * 100}%` }}
        />
      </div>
      <span className={`num w-10 text-right text-[13px] font-semibold ${urgent ? "text-danger" : "text-muted"}`}>
        {Math.ceil(remainingMs / 1000)}초
      </span>
    </div>
  );
}

function ChoiceButton({ state, onClick, num, children }: { state: string; onClick: () => void; num: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left text-[16px] font-medium transition-colors ${
        {
          idle: "border-line bg-surface active:bg-surface-2",
          correct: "border-live bg-live-soft text-live",
          wrong: "border-danger bg-danger-soft text-danger",
          dim: "border-line bg-surface opacity-40",
        }[state]
      }`}
    >
      <span className="num grid size-7 shrink-0 place-items-center rounded-lg bg-bg/50 text-[13px] text-muted">{num}</span>
      <span className="flex-1">{children}</span>
      {state === "correct" && <Check size={20} />}
      {state === "wrong" && <X size={20} />}
    </button>
  );
}

/** 빈칸 문장. 답을 고르면 빈칸에 실제 형태(provides 등)가 채워진다 */
function BlankSentence({ q, revealed, correct }: { q: Extract<Question, { kind: "blank" }>; revealed: boolean; correct: boolean }) {
  const [before, after] = splitBlank(q.sentence.blanked);
  return (
    <p className="mt-4 text-[19px] leading-relaxed">
      {before}
      {revealed ? (
        <span className={`rounded-md px-1 font-bold ${correct ? "bg-live-soft text-live" : "bg-danger-soft text-danger"}`}>{q.sentence.answer}</span>
      ) : (
        <span className="inline-block w-20 border-b-2 border-accent align-baseline" />
      )}
      {after}
    </p>
  );
}

function Example({ sentence, answer }: { sentence: string; answer: string }) {
  const [before, after] = splitBlank(sentence);
  return (
    <p className="mx-auto mt-5 max-w-sm text-[14px] leading-relaxed text-muted">
      {before}
      <span className="font-semibold text-text">{answer}</span>
      {after}
    </p>
  );
}

// ───────────────────────── 결과 화면 ─────────────────────────

function ResultScreen({ day, answers, onRetryWrong, onRestart }: { day: number; answers: Answer[]; onRetryWrong: () => void; onRestart: () => void }) {
  const right = answers.filter((a) => a.correct).length;
  const wrong = answers.filter((a) => !a.correct);
  const timedOut = answers.filter((a) => a.timedOut).length;
  const score = Math.round((right / answers.length) * 100);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="text-center">
        <p className="text-[13px] text-muted">DAY {day} 결과</p>
        <p className="num mt-2 text-[56px] font-bold leading-none">
          {score}
          <span className="text-[22px] text-muted">점</span>
        </p>
        <p className="mt-2 text-[14px] text-muted">
          {answers.length}문제 중 <span className="font-semibold text-live">{right}개</span> 맞힘
          {timedOut > 0 && <span className="text-danger"> · 시간 초과 {timedOut}개</span>}
        </p>
      </div>

      {wrong.length > 0 ? (
        <div className="mt-8 flex-1">
          <p className="mb-2 text-[15px] font-semibold">틀린 단어 {wrong.length}개</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {wrong.map(({ q, timedOut }) => (
              <li key={q.word.id} className="px-4 py-3">
                <p className="text-[15px]">
                  <span className="font-semibold">{q.word.word}</span> <span className="text-muted">{q.word.meaning}</span>
                  {timedOut && <span className="ml-1.5 rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">시간 초과</span>}
                </p>
                {q.kind === "blank" && <p className="mt-1 text-[13px] leading-relaxed text-faint">{q.sentence.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-10 flex-1 text-center text-[40px]">🎉</p>
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
          DAY 목록으로
        </Link>
      </div>
    </div>
  );
}
