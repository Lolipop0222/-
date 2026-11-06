/**
 * 워드마스터 수능 2000 — 데이터 읽기, 퀴즈·복습 문제 만들기.
 * 데이터는 public/wordmaster/day-NN.json + index.json (data/wordmaster/README.md, `npm run wordmaster`).
 * 학생별 진도(복습 상자)는 lib/wordProgress.ts.
 */

export type WmLevel = "basic" | "applied" | "advanced";
/** tb: 교재에 실린 것 (없으면 새로 보충한 것) */
export type WmSentence = { level: WmLevel; text: string; translation: string; answer: string; blanked: string; tb?: 1 };
export type WmRel = { text: string; meaning?: string; tb?: 1 };
export type WmWord = {
  id: number;
  day: number;
  word: string;
  meaning: string;
  ety: string | null; // 어원 (교재에 있는 191개만)
  sentences: WmSentence[]; // 항상 basic → applied → advanced
  syn: WmRel[]; // 유의어
  ant: WmRel[]; // 반의어
  der: WmRel[]; // 파생어 (뜻 있음)
  phr: WmRel[]; // 숙어·연어 (뜻 있음)
};
export type WmDay = { day: number; words: WmWord[] };
/** index.json 한 줄: [id, day, word, meaning] */
export type WmIndexEntry = [number, number, string, string];

export const WM_DAYS = 50;
export const WM_WORDS = 2000;
export const WORDS_PER_DAY = 40;
export const LEVEL_LABEL: Record<WmLevel, string> = { basic: "기본", applied: "응용", advanced: "심화" };
export const dayOf = (wordId: number) => Math.floor((wordId - 1) / WORDS_PER_DAY) + 1;

// ───────────────────────── 데이터 읽기 (한 번 받은 DAY는 다시 안 받음) ─────────────────────────

const dayCache = new Map<number, Promise<WmDay>>();
let indexCache: Promise<WmIndexEntry[]> | null = null;

export function loadDay(day: number): Promise<WmDay> {
  let p = dayCache.get(day);
  if (!p) {
    p = fetch(`/wordmaster/day-${String(day).padStart(2, "0")}.json`).then((res) => {
      if (!res.ok) throw new Error(`DAY ${day} 단어를 불러오지 못했어요 (${res.status})`);
      return res.json() as Promise<WmDay>;
    });
    p.catch(() => dayCache.delete(day)); // 실패하면 다음에 다시 시도
    dayCache.set(day, p);
  }
  return p;
}

/** 여러 DAY를 한꺼번에 (복습처럼 여러 DAY 단어가 섞일 때) */
export async function loadDays(days: Iterable<number>): Promise<Map<number, WmDay>> {
  const list = [...new Set(days)];
  const loaded = await Promise.all(list.map(loadDay));
  return new Map(loaded.map((d) => [d.day, d]));
}

export function loadIndex(): Promise<WmIndexEntry[]> {
  if (!indexCache) {
    indexCache = fetch("/wordmaster/index.json").then((res) => {
      if (!res.ok) throw new Error(`단어 목록을 불러오지 못했어요 (${res.status})`);
      return res.json() as Promise<WmIndexEntry[]>;
    });
    indexCache.catch(() => (indexCache = null));
  }
  return indexCache;
}

// ───────────────────────── 보조 ─────────────────────────

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pickOne = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** "The fossil record _____ evidence." → ["The fossil record ", " evidence."] */
export function splitBlank(blanked: string): [string, string] {
  const i = blanked.indexOf("_____");
  if (i < 0) return [blanked, ""];
  return [blanked.slice(0, i), blanked.slice(i + 5)];
}

/** 복습 단계에 따라 다른 예문을 보여 준다 — 같은 문장만 외우는 것을 막기 (처음·1단계는 교재 예문) */
export function sentenceFor(word: WmWord, box?: number | null): WmSentence {
  const i = !box || box <= 1 ? 0 : (box - 1) % 3;
  return word.sentences[i] ?? word.sentences[0];
}

// ───────────────────────── 문제 ─────────────────────────

/**
 * 퀴즈 방식
 *  - meaning:  영단어 → 뜻 4지선다
 *  - reverse:  뜻 → 영단어 4지선다
 *  - blank:    단어 상자(10개)에서 빈칸에 맞는 단어 고르기 — PDF 퀴즈북 형식
 *  - relation: 유의어·반의어 고르기
 */
export type QuizMode = "meaning" | "reverse" | "blank" | "relation";
export type LevelChoice = WmLevel | "mix";

export const MODE_LABEL: Record<QuizMode, string> = { meaning: "뜻 고르기", reverse: "단어 고르기", blank: "빈칸 채우기", relation: "유의어·반의어" };

/** 보기 4개 중 하나를 고르는 문제 (sentence: 빈칸 문장을 4지선다로 — 복습용) */
export type ChoiceQ = {
  kind: "choice";
  mode: "meaning" | "reverse" | "relation" | "sentence";
  word: WmWord;
  choices: string[];
  answerIdx: number;
  rel?: "유의어" | "반의어";
  sentence?: WmSentence;
};
export type BlankQ = { kind: "blank"; word: WmWord; sentence: WmSentence; box: WmWord[] };
export type Question = ChoiceQ | BlankQ;

const BOX_SIZE = 10;

/** 정답 하나 + 겹치지 않는 오답 3개 → 섞은 보기 */
function makeChoices(answer: string, pool: string[]): { choices: string[]; answerIdx: number } {
  const seen = new Set([answer.toLowerCase()]);
  const wrong: string[] = [];
  for (const c of shuffle(pool)) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push(c);
    if (wrong.length === 3) break;
  }
  const choices = shuffle([answer, ...wrong]);
  return { choices, answerIdx: choices.indexOf(answer) };
}

export function meaningQ(word: WmWord, dayWords: WmWord[]): ChoiceQ {
  return { kind: "choice", mode: "meaning", word, ...makeChoices(word.meaning, dayWords.filter((w) => w.id !== word.id).map((w) => w.meaning)) };
}

export function reverseQ(word: WmWord, dayWords: WmWord[]): ChoiceQ {
  return { kind: "choice", mode: "reverse", word, ...makeChoices(word.word, dayWords.filter((w) => w.id !== word.id).map((w) => w.word)) };
}

/** 빈칸 문장 + 같은 DAY 단어 4개 중 고르기 (복습 5단계용) */
export function sentenceQ(word: WmWord, dayWords: WmWord[], sentence: WmSentence): ChoiceQ {
  return {
    kind: "choice",
    mode: "sentence",
    word,
    sentence,
    ...makeChoices(word.word, dayWords.filter((w) => w.id !== word.id).map((w) => w.word)),
  };
}

/** 유의어·반의어가 있는 단어인지 */
export const hasRelation = (w: WmWord) => w.syn.length > 0 || w.ant.length > 0;

/**
 * 유의어·반의어 고르기 — 정답은 그 단어의 유의어(또는 반의어), 오답은 같은 DAY 다른 단어의 관련어.
 * 그 단어의 다른 유의어·반의어는 오답 보기에 넣지 않는다.
 */
export function relationQ(word: WmWord, dayWords: WmWord[]): ChoiceQ | null {
  const useAnt = word.ant.length > 0 && (word.syn.length === 0 || Math.random() < 0.35);
  const list = useAnt ? word.ant : word.syn;
  if (list.length === 0) return null;
  const answer = pickOne(list).text;
  const mine = new Set([word.word, ...word.syn.map((r) => r.text), ...word.ant.map((r) => r.text)].map((s) => s.toLowerCase()));
  const pool = dayWords
    .filter((w) => w.id !== word.id)
    .flatMap((w) => [...w.syn, ...w.ant].map((r) => r.text))
    .filter((t) => !mine.has(t.toLowerCase()));
  return { kind: "choice", mode: "relation", word, rel: useAnt ? "반의어" : "유의어", ...makeChoices(answer, pool) };
}

/** 4지선다 퀴즈 (뜻·단어·유의어) */
export function buildChoiceQuiz(mode: "meaning" | "reverse" | "relation", dayWords: WmWord[], targets: WmWord[]): ChoiceQ[] {
  const out: ChoiceQ[] = [];
  for (const w of shuffle(targets)) {
    const q = mode === "meaning" ? meaningQ(w, dayWords) : mode === "reverse" ? reverseQ(w, dayWords) : relationQ(w, dayWords);
    if (q) out.push(q);
  }
  return out;
}

/**
 * 빈칸 채우기 — 10개씩 묶어 단어 상자로 보여 주고 그 묶음의 문장을 섞는다.
 * 묶음이 10개보다 작으면(틀린 것만 다시 등) 같은 DAY의 다른 단어로 상자를 채운다.
 */
export function buildBlankQuiz(dayWords: WmWord[], targets: WmWord[], level: LevelChoice): BlankQ[] {
  const order = shuffle(targets);
  const out: BlankQ[] = [];
  for (let i = 0; i < order.length; i += BOX_SIZE) {
    const group = order.slice(i, i + BOX_SIZE);
    const filler = shuffle(dayWords.filter((w) => !group.some((g) => g.id === w.id))).slice(0, BOX_SIZE - group.length);
    const box = [...group, ...filler].sort((a, b) => a.word.localeCompare(b.word));
    for (const word of shuffle(group)) {
      const sentence = level === "mix" ? pickOne(word.sentences) : (word.sentences.find((s) => s.level === level) ?? word.sentences[0]);
      out.push({ kind: "blank", word, sentence, box });
    }
  }
  return out;
}

/**
 * 복습 문제 — 상자가 올라갈수록 어려워진다.
 *  1·2단계: 영단어 → 뜻 / 3·4단계: 뜻 → 영단어 / 5단계: 응용·심화 예문 빈칸
 */
export function reviewQuestion(word: WmWord, dayWords: WmWord[], box: number): ChoiceQ {
  if (box >= 5) return sentenceQ(word, dayWords, word.sentences[1 + Math.floor(Math.random() * 2)] ?? word.sentences[0]);
  if (box >= 3) return reverseQ(word, dayWords);
  return meaningQ(word, dayWords);
}

// ───────────────────────── 발음 듣기 (기기의 음성 합성, 안 되면 버튼 숨김) ─────────────────────────

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    // 음성 합성이 막힌 기기는 조용히 넘어간다
  }
}
