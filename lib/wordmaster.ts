/**
 * 워드마스터 수능 2000 퀴즈.
 * 데이터는 public/wordmaster/day-NN.json (data/wordmaster/README.md 참고).
 */

export type WmLevel = "basic" | "applied" | "advanced";
export type WmSentence = { level: WmLevel; text: string; answer: string; blanked: string };
export type WmWord = { id: number; word: string; meaning: string; sentences: WmSentence[] };
export type WmDay = { day: number; words: WmWord[] };

export const WM_DAYS = 50;
export const LEVEL_LABEL: Record<WmLevel, string> = { basic: "기본", applied: "응용", advanced: "심화" };

export type QuizMode = "meaning" | "blank";
export type LevelChoice = WmLevel | "mix";

export type MeaningQ = { kind: "meaning"; word: WmWord; choices: string[]; answerIdx: number };
/** 단어 상자(box)에서 빈칸에 맞는 단어를 고른다 — PDF 퀴즈북 형식 */
export type BlankQ = { kind: "blank"; word: WmWord; sentence: WmSentence; box: WmWord[] };
export type Question = MeaningQ | BlankQ;

const BOX_SIZE = 10;

export async function loadDay(day: number): Promise<WmDay> {
  const res = await fetch(`/wordmaster/day-${String(day).padStart(2, "0")}.json`);
  if (!res.ok) throw new Error(`DAY ${day} 데이터를 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 뜻 고르기 — 오답 보기는 같은 DAY의 다른 단어 뜻에서 뽑는다 */
export function buildMeaningQuiz(dayWords: WmWord[], targets: WmWord[]): MeaningQ[] {
  return shuffle(targets).map((word) => {
    const wrong = shuffle(dayWords.filter((w) => w.id !== word.id)).slice(0, 3).map((w) => w.meaning);
    const choices = shuffle([word.meaning, ...wrong]);
    return { kind: "meaning", word, choices, answerIdx: choices.indexOf(word.meaning) };
  });
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
      const sentence = level === "mix" ? shuffle(word.sentences)[0] : word.sentences.find((s) => s.level === level)!;
      out.push({ kind: "blank", word, sentence, box });
    }
  }
  return out;
}

/** "The fossil record _____ evidence." → ["The fossil record ", " evidence."] */
export function splitBlank(blanked: string): [string, string] {
  const i = blanked.indexOf("_____");
  return [blanked.slice(0, i), blanked.slice(i + 5)];
}

// ── DAY별 최고 점수 (이 기기에만 저장. 나중에 Supabase attempts 테이블로 옮긴다) ──

export type Best = { correct: number; total: number };

const bestKey = (day: number, mode: QuizMode) => `wm:best:${day}:${mode}`;

export function readBest(day: number, mode: QuizMode): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(day, mode));
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}

export function saveBest(day: number, mode: QuizMode, result: Best) {
  try {
    const prev = readBest(day, mode);
    if (!prev || result.correct / result.total > prev.correct / prev.total) {
      localStorage.setItem(bestKey(day, mode), JSON.stringify(result));
    }
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 기록 없이 진행
  }
}
