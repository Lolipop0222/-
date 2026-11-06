"use client";

import { useState, useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { canSpeak, speak, type WmRel, type WmSentence, type WmWord } from "@/lib/wordmaster";
import { MASTERED, type Progress } from "@/lib/wordProgress";

/** 상자 단계 이름·색 (토큰만) */
export const BOX_STYLE: Record<number, { label: string; cls: string }> = {
  1: { label: "1단계", cls: "bg-danger-soft text-danger" },
  2: { label: "2단계", cls: "bg-warn-soft text-warn" },
  3: { label: "3단계", cls: "bg-accent-soft text-accent" },
  4: { label: "4단계", cls: "bg-accent-soft text-accent" },
  5: { label: "5단계", cls: "bg-live-soft text-live" },
  [MASTERED]: { label: "외움", cls: "bg-live text-bg" },
};

export function BoxBadge({ p }: { p: Progress | undefined }) {
  if (!p) return <span className="shrink-0 whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-faint">새 단어</span>;
  const s = BOX_STYLE[p.box];
  return <span className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
}

const noop = () => () => {};
/** 이 기기가 발음 듣기를 할 수 있는지 (서버에서는 false) */
export function useCanSpeak() {
  return useSyncExternalStore(noop, canSpeak, () => false);
}

export function SpeakButton({ text, size = 18, className = "" }: { text: string; size?: number; className?: string }) {
  const ok = useCanSpeak();
  if (!ok) return null;
  return (
    <button
      type="button"
      aria-label={`${text} 발음 듣기`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={`grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-surface-2 ${className}`}
    >
      <Volume2 size={size} />
    </button>
  );
}

/** 문장에서 정답 형태(answer)를 찾아 굵게 */
export function Marked({ text, answer, className = "" }: { text: string; answer: string; className?: string }) {
  let i = text.indexOf(answer);
  if (i < 0) i = text.toLowerCase().indexOf(answer.toLowerCase());
  if (i < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, i)}
      <b className="font-bold text-accent">{text.slice(i, i + answer.length)}</b>
      {text.slice(i + answer.length)}
    </span>
  );
}

const TextbookTag = () => <span className="ml-1 whitespace-nowrap rounded bg-surface-2 px-1 py-px align-[1px] text-[9px] font-semibold text-faint">교재</span>;

export function Example({ s, showTranslation = true }: { s: WmSentence; showTranslation?: boolean }) {
  return (
    <div>
      <p className="text-[15px] leading-relaxed">
        <Marked text={s.text} answer={s.answer} />
        {s.tb && <TextbookTag />}
      </p>
      {showTranslation && <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.translation}</p>}
    </div>
  );
}

function Chips({ label, list }: { label: string; list: WmRel[] }) {
  if (!list.length) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-12 shrink-0 text-[11px] font-semibold text-faint">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {list.map((r) => (
          <span key={r.text} className="rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-[13px] font-medium">
            {r.text}
            {r.tb && <TextbookTag />}
          </span>
        ))}
      </div>
    </div>
  );
}

function MeaningList({ label, list }: { label: string; list: WmRel[] }) {
  if (!list.length) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-12 shrink-0 text-[11px] font-semibold text-faint">{label}</span>
      <ul className="min-w-0 flex-1 space-y-1">
        {list.map((r) => (
          <li key={r.text} className="text-[13px] leading-snug">
            <span className="font-semibold">{r.text}</span>
            {r.tb && <TextbookTag />}
            {r.meaning && <span className="text-muted"> {r.meaning}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 뜻을 품사별로 (";"로 나뉨) */
export function Meaning({ meaning, className = "" }: { meaning: string; className?: string }) {
  const parts = meaning.split(";").map((s) => s.trim()).filter(Boolean);
  return (
    <div className={className}>
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/**
 * 단어 설명 전체 — 암기 카드 뒷면, 복습 정답 확인, 단어 찾기에서 쓴다.
 * 1단 뜻·어원 / 2단 예문(정답 굵게)·해석 / 3단 유의어·반의어 칩, 파생어·숙어 목록
 */
export function WordDetail({
  word,
  sentence,
  allSentences = false,
  hideMeaning = false,
}: {
  word: WmWord;
  sentence?: WmSentence;
  allSentences?: boolean;
  hideMeaning?: boolean;
}) {
  const [more, setMore] = useState(false);
  const main = sentence ?? word.sentences[0];
  const sentences = allSentences || more ? [main, ...word.sentences.filter((s) => s !== main)] : [main];
  return (
    <div className="space-y-4 text-left">
      {!hideMeaning && <Meaning meaning={word.meaning} className="text-[17px] font-semibold leading-snug" />}
      {word.ety && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-muted">
          <span className="mr-1 font-semibold text-faint">어원</span>
          {word.ety}
        </p>
      )}
      <div className="space-y-3">
        {sentences.map((s) => (
          <Example key={s.level} s={s} />
        ))}
        {!allSentences && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMore((v) => !v);
            }}
            className="text-[12px] font-semibold text-accent"
          >
            {more ? "예문 접기" : `예문 ${word.sentences.length - 1}개 더 보기 (응용·심화)`}
          </button>
        )}
      </div>
      {(word.syn.length > 0 || word.ant.length > 0 || word.der.length > 0 || word.phr.length > 0) && (
        <div className="space-y-2 border-t border-line pt-3">
          <Chips label="유의어" list={word.syn} />
          <Chips label="반의어" list={word.ant} />
          <MeaningList label="파생어" list={word.der} />
          <MeaningList label="숙어" list={word.phr} />
        </div>
      )}
    </div>
  );
}
