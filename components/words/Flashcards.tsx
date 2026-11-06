"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { BoxBadge, Meaning, SpeakButton, WordDetail } from "@/components/words/parts";
import { sentenceFor, shuffle, speak, type WmWord } from "@/lib/wordmaster";
import { recordAnswers, type Progress } from "@/lib/wordProgress";

export type CardDir = "en" | "ko"; // 앞면: 영단어 / 뜻

const SWIPE = 90; // 이만큼 밀면 답한 것으로

/**
 * 암기 카드. 앞면을 보고 떠올린 뒤 눌러서 뒤집고, 알아요/몰라요를 고른다 (옆으로 밀어도 됨).
 * 고를 때마다 바로 복습 상자에 기록한다 — 알면 2단계(3일 뒤), 모르면 1단계(내일)부터.
 * 키보드: Space 뒤집기, ← 몰라요, → 알아요
 */
export default function Flashcards({
  title,
  words,
  progress,
  dir,
  onExit,
  onQuiz,
}: {
  title: string;
  words: WmWord[];
  progress: ReadonlyMap<number, Progress>;
  dir: CardDir;
  onExit: () => void;
  onQuiz?: (words: WmWord[]) => void;
}) {
  const [deck, setDeck] = useState(words);
  const [round, setRound] = useState(1);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<{ word: WmWord; ok: boolean }[]>([]);
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  // 카드를 처음 뽑았을 때의 단계 (기록하면 바뀌므로 그 전 것으로 예문을 고른다)
  const [boxAtStart] = useState(() => new Map([...progress].map(([id, p]) => [id, p.box])));

  const word = deck[i] as WmWord | undefined;
  const done = i >= deck.length;

  const answer = useCallback(
    (ok: boolean) => {
      if (!word || !flipped) return;
      setResults((r) => [...r, { word, ok }]);
      void recordAnswers([{ id: word.id, ok }]);
      setSettling(true);
      setDx(ok ? 480 : -480);
      window.setTimeout(() => {
        setSettling(false);
        setDx(0);
        setFlipped(false);
        setI((n) => n + 1);
      }, 200);
    },
    [word, flipped],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") answer(true);
      else if (e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, done]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !flipped) return;
    const mx = e.clientX - d.x;
    if (!d.moved && Math.abs(mx) < 8) return;
    if (!d.moved && Math.abs(e.clientY - d.y) > Math.abs(mx)) {
      drag.current = null; // 세로로 움직이면 스크롤
      return;
    }
    d.moved = true;
    setDx(mx);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      // 그냥 누름 → 뒤집기 (뒷면 안의 버튼·스크롤은 제외)
      if ((e.target as HTMLElement).closest("button")) return;
      setFlipped((f) => !f);
      return;
    }
    if (Math.abs(dx) > SWIPE) answer(dx > 0);
    else {
      setSettling(true);
      setDx(0);
      window.setTimeout(() => setSettling(false), 220);
    }
  }

  if (done) {
    const thisRound = results.slice(-deck.length);
    const unknown = thisRound.filter((r) => !r.ok).map((r) => r.word);
    const known = thisRound.length - unknown.length;
    return (
      <div className="flex min-h-dvh flex-col px-5 pb-6 pt-[calc(env(safe-area-inset-top)+24px)]">
        <div className="text-center">
          <p className="text-[13px] text-muted">
            {title} · 암기 카드{round > 1 ? ` ${round}회차` : ""}
          </p>
          <p className="mt-3 text-[15px]">
            <span className="num text-[44px] font-bold text-live">{known}</span>
            <span className="mx-2 text-muted">알아요</span>
            <span className="num text-[44px] font-bold text-danger">{unknown.length}</span>
            <span className="ml-2 text-muted">몰라요</span>
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            모르는 단어는 <b className="text-text">내일</b>, 아는 단어는 <b className="text-text">3일 뒤</b> 복습에 나와요.
          </p>
        </div>
        {unknown.length > 0 && (
          <ul className="mt-6 flex-1 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {unknown.map((w) => (
              <li key={w.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="w-28 shrink-0 break-words text-[15px] font-semibold">{w.word}</span>
                <span className="min-w-0 text-[13px] text-muted">{w.meaning}</span>
              </li>
            ))}
          </ul>
        )}
        {unknown.length === 0 && <div className="flex-1" />}
        <div className="mt-6 space-y-2.5">
          {unknown.length > 0 && (
            <PrimaryButton
              onClick={() => {
                setDeck(shuffle(unknown));
                setRound((r) => r + 1);
                setI(0);
              }}
            >
              <RotateCcw size={18} /> 모르는 것만 한 번 더
            </PrimaryButton>
          )}
          {onQuiz && (
            <button
              onClick={() => onQuiz([...new Map(results.map((r) => [r.word.id, r.word])).values()])}
              className="h-14 w-full rounded-2xl border border-line bg-surface text-[15px] font-semibold"
            >
              방금 본 단어로 퀴즈
            </button>
          )}
          <button onClick={onExit} className="block w-full py-2 text-center text-[14px] text-muted">
            그만하기
          </button>
        </div>
      </div>
    );
  }

  const w = word!;
  const p = progress.get(w.id);
  const sentence = sentenceFor(w, boxAtStart.get(w.id));
  const tilt = Math.max(-12, Math.min(12, dx / 18));
  const hint = dx > 30 ? "know" : dx < -30 ? "dont" : null;

  return (
    <div className="flex h-dvh flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[env(safe-area-inset-top)]">
      <header className="flex h-14 shrink-0 items-center gap-3">
        <button onClick={onExit} aria-label="그만하기" className="-ml-2 grid size-10 place-items-center rounded-full text-muted">
          <X size={22} />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-live transition-all" style={{ width: `${(i / deck.length) * 100}%` }} />
        </div>
        <span className="num w-14 text-right text-[13px] text-muted">
          {i + 1}/{deck.length}
        </span>
      </header>

      <div className="wm-scene relative min-h-0 flex-1 py-2">
        <div
          key={`${round}-${i}`}
          className={`wm-drag wm-enter relative h-full select-none ${settling ? "is-settling" : ""}`}
          style={{ transform: `translateX(${dx}px) rotate(${tilt}deg)`, opacity: Math.abs(dx) > 300 ? 0 : 1 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDx(0);
          }}
        >
          <div className={`wm-card relative h-full ${flipped ? "is-flipped" : ""}`}>
            {/* 앞면 */}
            <div
              className="wm-face absolute inset-0 flex cursor-pointer select-none flex-col rounded-3xl border border-line bg-surface p-5"
              aria-hidden={flipped}
            >
              <div className="flex items-center justify-between">
                <BoxBadge p={p} />
                <span className="text-[11px] text-faint">DAY {w.day}</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                {dir === "en" ? (
                  <>
                    <p className="break-all text-[clamp(30px,10vw,44px)] font-bold tracking-tight">{w.word}</p>
                    <SpeakButton text={w.word} size={22} className="mt-2" />
                  </>
                ) : (
                  <Meaning meaning={w.meaning} className="text-[clamp(20px,6.4vw,28px)] font-bold leading-snug" />
                )}
              </div>
              <p className="text-center text-[12px] text-faint">눌러서 {dir === "en" ? "뜻" : "단어"} 보기</p>
            </div>
            {/* 뒷면 */}
            <div
              className="wm-face wm-back absolute inset-0 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface"
              aria-hidden={!flipped}
            >
              <div className="flex shrink-0 items-center gap-1 border-b border-line px-5 py-3">
                <p className="min-w-0 flex-1 break-words text-[24px] font-bold tracking-tight">{w.word}</p>
                <SpeakButton text={w.word} />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <WordDetail word={w} sentence={sentence} />
              </div>
            </div>
          </div>
          {hint && (
            <span
              className={`pointer-events-none absolute top-20 rounded-xl border-2 px-3 py-1 text-[15px] font-bold ${
                hint === "know" ? "left-5 -rotate-12 border-live text-live" : "right-5 rotate-12 border-danger text-danger"
              }`}
            >
              {hint === "know" ? "알아요" : "몰라요"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 shrink-0">
        {flipped ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => answer(false)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-bold text-danger active:scale-[0.98]"
            >
              <X size={20} /> 몰라요
            </button>
            <button
              onClick={() => answer(true)}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-live-soft text-[16px] font-bold text-live active:scale-[0.98]"
            >
              <Check size={20} /> 알아요
            </button>
          </div>
        ) : (
          <PrimaryButton
            onClick={() => {
              setFlipped(true);
              if (dir === "ko") speak(w.word);
            }}
          >
            {dir === "en" ? "뜻 보기" : "단어 보기"}
          </PrimaryButton>
        )}
        <p className="mt-2 text-center text-[11px] text-faint">{flipped ? "옆으로 밀어도 돼요 · 오른쪽 알아요, 왼쪽 몰라요" : "먼저 떠올려 본 다음 확인해요"}</p>
      </div>
    </div>
  );
}
