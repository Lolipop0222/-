// data/wordmaster/wordmaster_2000.json (v2) → public/wordmaster/day-01.json ~ day-50.json + index.json
// 원본(3.5MB)을 한 번에 받지 않도록 DAY별로 나눈다. 데이터를 고치면 `npm run wordmaster` 로 다시 만든다.
//  - day-NN.json: 그 DAY 40단어 전부 (예문·해석·관련어·어원). 필드 이름은 lib/wordmaster.ts의 WmWord
//  - index.json:  2000단어의 [id, day, word, meaning] — 단어 찾기·복습 목록용 (작게)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("data/wordmaster/wordmaster_2000.json", "utf8"));
mkdirSync("public/wordmaster", { recursive: true });

// 교재(textbook)에 있는 것만 tb: 1을 붙인다 (보충은 생략해서 용량을 줄임)
const rel = (list) => list.map((r) => ({ text: r.text, ...(r.meaning ? { meaning: r.meaning } : {}), ...(r.source === "textbook" ? { tb: 1 } : {}) }));

for (let day = 1; day <= src.meta.days; day++) {
  const words = src.words
    .filter((w) => w.day === day)
    .sort((a, b) => a.order - b.order)
    .map((w) => ({
      id: w.id,
      day: w.day,
      word: w.word,
      meaning: w.meaning,
      ety: w.etymology ? w.etymology.text : null,
      sentences: w.sentences.map(({ level, source, text, translation, answer, blanked }) => ({
        level,
        text,
        translation,
        answer,
        blanked,
        ...(source === "textbook" ? { tb: 1 } : {}),
      })),
      syn: rel(w.synonyms),
      ant: rel(w.antonyms),
      der: rel(w.derivatives),
      phr: rel(w.phrases),
    }));
  if (words.length !== 40) throw new Error(`DAY ${day}: ${words.length}단어`);
  writeFileSync(`public/wordmaster/day-${String(day).padStart(2, "0")}.json`, JSON.stringify({ day, words }));
}
const index = [...src.words].sort((a, b) => a.id - b.id).map((w) => [w.id, w.day, w.word, w.meaning]);
writeFileSync("public/wordmaster/index.json", JSON.stringify(index));
console.log(`DAY ${src.meta.days}개 파일 + index.json 생성 (단어 ${src.words.length}개)`);
