"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpenCheck, ChevronDown, Layers, Timer } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { useProfile } from "@/components/AuthProvider";
import { Card, PrimaryButton, Segmented } from "@/components/ui";
import Flashcards, { type CardDir } from "@/components/words/Flashcards";
import { QuizResult, QuizRunner, type QuizAnswer } from "@/components/words/Quiz";
import { BoxBadge, SpeakButton, WordDetail } from "@/components/words/parts";
import {
  MODE_LABEL,
  buildBlankQuiz,
  buildChoiceQuiz,
  hasRelation,
  loadDay,
  shuffle,
  type LevelChoice,
  type QuizMode,
  type Question,
  type WmDay,
  type WmWord,
} from "@/lib/wordmaster";
import { MASTERED, getBest, isDue, recordAnswers, resetProgress, saveQuizResult, useWordStore, type WordStore } from "@/lib/wordProgress";

const COUNTS = ["10문제", "20문제", "40문제"] as const;
const LEVELS = ["기본", "응용", "심화", "섞어서"] as const;
const LEVEL_VALUE: Record<(typeof LEVELS)[number], LevelChoice> = { 기본: "basic", 응용: "applied", 심화: "advanced", 섞어서: "mix" };
// 문제당 제한 시간 (셀프 옵션, 기본 끄기). 시간이 지나면 오답
const LIMITS = ["끄기", "5초", "10초", "15초"] as const;
type Limit = (typeof LIMITS)[number];
const LIMIT_KEY = "wm:timeLimit";
const DIRS = ["영어 → 뜻", "뜻 → 영어"] as const;
const DIR_KEY = "wm:cardDir";

type Pick = "new" | "weak" | "all";
type Setup = { mode: QuizMode; level: LevelChoice; timeLimit: number };
type View =
  | { kind: "home" }
  | { kind: "cards"; words: WmWord[]; dir: CardDir; key: number }
  | { kind: "quiz"; questions: Question[]; setup: Setup; key: number }
  | { kind: "result"; answers: QuizAnswer[]; setup: Setup };

function readPref<T extends string>(key: string, items: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && items.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // 저장소를 못 쓰면 매번 기본값
  }
}

/** DAY 화면: 진도 + 암기 카드 + 퀴즈 + 단어 목록 */
export default function DayView({ day }: { day: number }) {
  const profile = useProfile();
  const store = useWordStore(profile.id);
  const [data, setData] = useState<WmDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });

  useEffect(() => {
    loadDay(day).then(setData, (e: Error) => setError(e.message));
  }, [day]);

  // 카드·퀴즈·결과로 넘어갈 때 맨 위에서 시작
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view.kind]);

  if (error || !data || store.status !== "ready") {
    return (
      <Shell day={day}>
        {error ? <p className="py-20 text-center text-[14px] text-danger">{error}</p> : <div className="py-8"><AppLoader label="단어 불러오는 중…" /></div>}
      </Shell>
    );
  }

  function startQuiz(targets: WmWord[], setup: Setup) {
    const questions = setup.mode === "blank" ? buildBlankQuiz(data!.words, targets, setup.level) : buildChoiceQuiz(setup.mode, data!.words, targets);
    if (questions.length) setView({ kind: "quiz", questions, setup, key: Date.now() });
  }

  /** 퀴즈 답을 복습 상자에 기록 (틀리면 1단계로, 처음 본 단어를 맞히면 2단계) */
  function recordQuiz(answers: QuizAnswer[]) {
    void recordAnswers(answers.map((a) => ({ id: a.q.word.id, ok: a.correct })));
  }

  if (view.kind === "cards") {
    return (
      <Flashcards
        key={view.key}
        title={`DAY ${day}`}
        words={view.words}
        progress={store.progress}
        dir={view.dir}
        onExit={() => setView({ kind: "home" })}
        onQuiz={(ws) => startQuiz(ws, { mode: "meaning", level: "basic", timeLimit: 0 })}
      />
    );
  }
  if (view.kind === "quiz") {
    return (
      <QuizRunner
        key={view.key}
        questions={view.questions}
        timeLimit={view.setup.timeLimit}
        onExit={(answered) => {
          recordQuiz(answered);
          setView({ kind: "home" });
        }}
        onDone={(answers) => {
          recordQuiz(answers);
          // 40문제 넘는 경우는 없지만 서버 제한(40)에 맞춘다
          if (answers.length <= 40) void saveQuizResult(day, view.setup.mode, { correct: answers.filter((a) => a.correct).length, total: answers.length });
          setView({ kind: "result", answers, setup: view.setup });
        }}
      />
    );
  }
  if (view.kind === "result") {
    return (
      <QuizResult
        title={`DAY ${day} ${MODE_LABEL[view.setup.mode]}`}
        answers={view.answers}
        onRetryWrong={() => startQuiz(view.answers.filter((a) => !a.correct).map((a) => a.q.word), view.setup)}
        onRestart={() => setView({ kind: "home" })}
      />
    );
  }

  return (
    <DayHome
      data={data}
      store={store}
      onCards={(words, dir) => setView({ kind: "cards", words, dir, key: Date.now() })}
      onQuiz={startQuiz}
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

// ───────────────────────── DAY 첫 화면 ─────────────────────────

function DayHome({
  data,
  store,
  onCards,
  onQuiz,
}: {
  data: WmDay;
  store: WordStore;
  onCards: (words: WmWord[], dir: CardDir) => void;
  onQuiz: (targets: WmWord[], s: Setup) => void;
}) {
  const words = data.words;
  const prog = (w: WmWord) => store.progress.get(w.id);
  const fresh = words.filter((w) => !prog(w));
  const weak = words.filter((w) => {
    const p = prog(w);
    return !!p && (p.box <= 2 || isDue(p, store.today));
  });
  const mastered = words.filter((w) => prog(w)?.box === MASTERED).length;
  const strong = words.filter((w) => (prog(w)?.box ?? 0) >= 4 && prog(w)?.box !== MASTERED).length;
  const learning = words.length - fresh.length - mastered - strong;
  const due = words.filter((w) => isDue(prog(w), store.today)).length;

  const [pick, setPick] = useState<Pick>(fresh.length ? "new" : weak.length ? "weak" : "all");
  const [dir, setDir] = useState<(typeof DIRS)[number]>(() => readPref(DIR_KEY, DIRS, "영어 → 뜻"));
  const pickWords = pick === "new" ? fresh : pick === "weak" ? weak : words;

  return (
    <Shell day={data.day}>
      <p className="-mt-1 text-[13px] text-muted">워드마스터 수능 2000 · {words.length}단어</p>

      {/* 진도 */}
      <Card className="mt-4">
        <div className="flex items-end justify-between">
          <p className="text-[13px] text-muted">이 DAY 진도</p>
          <p className="num text-[13px]">
            <b className="text-[20px] text-live">{mastered}</b>
            <span className="text-muted"> / {words.length} 외움</span>
          </p>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className="bg-live" style={{ width: `${(mastered / words.length) * 100}%` }} />
          <span className="bg-accent" style={{ width: `${(strong / words.length) * 100}%` }} />
          <span className="bg-warn" style={{ width: `${(learning / words.length) * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <Legend cls="bg-live" label={`외움 ${mastered}`} />
          <Legend cls="bg-accent" label={`4·5단계 ${strong}`} />
          <Legend cls="bg-warn" label={`1~3단계 ${learning}`} />
          <Legend cls="bg-surface-2 border border-line" label={`새 단어 ${fresh.length}`} />
        </div>
        {due > 0 && (
          <Link href="/words/review" className="mt-3 block rounded-xl bg-live-soft px-3 py-2 text-[12px] font-semibold text-live">
            이 DAY에서 오늘 복습할 단어 {due}개 → 복습하러 가기
          </Link>
        )}
      </Card>

      {/* 외우기 */}
      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">
          <Layers size={17} className="text-accent" /> 암기 카드
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <PickChip on={pick === "new"} onClick={() => setPick("new")} label="새 단어" n={fresh.length} />
          <PickChip on={pick === "weak"} onClick={() => setPick("weak")} label="약한 단어" n={weak.length} />
          <PickChip on={pick === "all"} onClick={() => setPick("all")} label="전체" n={words.length} />
        </div>
        <div className="mt-2">
          <Segmented items={DIRS} value={dir} onChange={setDir} />
        </div>
        <PrimaryButton
          className="mt-3"
          disabled={!pickWords.length}
          onClick={() => {
            savePref(DIR_KEY, dir);
            onCards(shuffle(pickWords), dir === "영어 → 뜻" ? "en" : "ko");
          }}
        >
          {pickWords.length ? `${pickWords.length}장 외우기` : pick === "new" ? "새 단어를 다 봤어요" : "약한 단어가 없어요"}
        </PrimaryButton>
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          알면 3일 뒤, 모르면 내일 복습에 나와요. 맞힐수록 간격이 1·3·7·16·35일로 늘어나고, 5단계까지 맞히면 &lsquo;외움&rsquo;이에요.
        </p>
      </section>

      <QuizSetup data={data} store={store} onStart={onQuiz} />

      <WordList words={words} store={store} />

      <ResetDay day={data.day} seen={words.length - fresh.length} />
      <div className="h-10" />
    </Shell>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className={`size-2 rounded-full ${cls}`} />
      {label}
    </span>
  );
}

function PickChip({ on, onClick, label, n }: { on: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl border py-2 transition-colors ${on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted"}`}
    >
      <span className="num text-[18px] font-bold leading-tight">{n}</span>
      <span className="text-[12px] font-semibold">{label}</span>
    </button>
  );
}

// ───────────────────────── 퀴즈 설정 ─────────────────────────

const MODE_DESC: Record<QuizMode, string> = {
  meaning: "영단어 보고 뜻 4지선다",
  reverse: "뜻 보고 영단어 4지선다",
  blank: "단어 상자에서 빈칸 채우기",
  relation: "유의어·반의어 4지선다",
};

function QuizSetup({ data, store, onStart }: { data: WmDay; store: WordStore; onStart: (targets: WmWord[], s: Setup) => void }) {
  const [mode, setMode] = useState<QuizMode>("meaning");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("기본");
  const [count, setCount] = useState<(typeof COUNTS)[number]>("20문제");
  const [limit, setLimit] = useState<Limit>(() => readPref(LIMIT_KEY, LIMITS, "끄기"));

  const pool = mode === "relation" ? data.words.filter(hasRelation) : data.words;

  function begin() {
    const pick = shuffle(pool).slice(0, parseInt(count));
    savePref(LIMIT_KEY, limit);
    onStart(pick, { mode, level: LEVEL_VALUE[level], timeLimit: limit === "끄기" ? 0 : parseInt(limit) });
  }

  return (
    <section className="mt-7">
      <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">
        <BookOpenCheck size={17} className="text-live" /> 퀴즈
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {(["meaning", "reverse", "blank", "relation"] as const).map((m) => {
          const best = getBest(store, data.day, m);
          const on = mode === m;
          return (
            <button
              type="button"
              key={m}
              aria-pressed={on}
              onClick={() => setMode(m)}
              className={`flex flex-col rounded-2xl border p-3 text-left transition-colors ${on ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}
            >
              <span className={`text-[15px] font-bold ${on ? "text-accent" : ""}`}>{MODE_LABEL[m]}</span>
              <span className="mt-0.5 text-[11px] leading-snug text-muted">{MODE_DESC[m]}</span>
              <span className="num mt-2 text-[11px] text-faint">{best ? `최고 ${Math.round((best.correct / best.total) * 100)}점` : "아직 안 풀었어요"}</span>
            </button>
          );
        })}
      </div>

      {mode === "blank" && (
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-medium text-muted">문장 난이도</p>
          <Segmented items={LEVELS} value={level} onChange={setLevel} />
          <p className="mt-2 text-[12px] text-faint">기본은 교재 예문, 심화는 수능 지문 수준이에요.</p>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[13px] font-medium text-muted">문제 수{mode === "relation" && ` (유의어·반의어가 있는 ${pool.length}단어 중)`}</p>
        <Segmented items={COUNTS} value={count} onChange={setCount} />
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1 text-[13px] font-medium text-muted">
          <Timer size={14} /> 문제당 제한 시간
        </p>
        <Segmented items={LIMITS} value={limit} onChange={setLimit} />
        <p className="mt-2 text-[12px] text-faint">
          {limit === "끄기" ? "시간 제한 없이 풀어요." : "시간 안에 못 고르면 틀린 걸로 쳐요."}
          {limit === "5초" && mode === "blank" && " 빈칸 채우기는 10초 이상을 추천해요."}
        </p>
      </div>

      <PrimaryButton onClick={begin} className="mt-4" tone="live">
        퀴즈 시작
      </PrimaryButton>
      <p className="mt-2 text-[12px] text-faint">퀴즈에서 틀린 단어도 복습 상자 1단계로 들어가요.</p>
    </section>
  );
}

// ───────────────────────── 단어 목록 ─────────────────────────

function WordList({ words, store }: { words: WmWord[]; store: WordStore }) {
  const [open, setOpen] = useState(false);
  const [hideMeaning, setHideMeaning] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <section className="mt-7">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] font-semibold"
      >
        단어 목록 {words.length}개
        <ChevronDown size={18} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <label className="mt-2 flex items-center justify-end gap-2 px-1 text-[12px] text-muted">
            <input type="checkbox" checked={hideMeaning} onChange={(e) => setHideMeaning(e.target.checked)} className="accent-accent" />
            뜻 가리기
          </label>
          <ul className="mt-1 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {words.map((w) => {
              const isOpen = expanded === w.id;
              return (
                <li key={w.id}>
                  <div className="flex items-center gap-2 pl-4 pr-2">
                    <button type="button" onClick={() => setExpanded(isOpen ? null : w.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-baseline gap-3 py-2.5 text-left">
                      <span className="max-w-[60%] shrink-0 text-[15px] font-semibold">{w.word}</span>
                      <span className={`min-w-0 text-[13px] text-muted ${hideMeaning && !isOpen ? "blur-[5px] select-none" : ""}`}>{w.meaning}</span>
                    </button>
                    <BoxBadge p={store.progress.get(w.id)} />
                    <SpeakButton text={w.word} size={16} />
                  </div>
                  {isOpen && (
                    <div className="border-t border-line bg-surface-2/40 px-4 py-4">
                      <WordDetail word={w} allSentences hideMeaning />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function ResetDay({ day, seen }: { day: number; seen: number }) {
  const [busy, setBusy] = useState(false);
  if (!seen) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`DAY ${day}의 진도(${seen}단어)를 지우고 처음부터 할까요? 되돌릴 수 없어요.`)) return;
        setBusy(true);
        const ok = await resetProgress(day);
        setBusy(false);
        if (!ok) window.alert("지우지 못했어요. 잠시 뒤 다시 해 주세요.");
      }}
      className="mx-auto mt-8 block text-[12px] text-faint underline underline-offset-2"
    >
      {busy ? "지우는 중…" : "이 DAY 진도 처음부터"}
    </button>
  );
}
