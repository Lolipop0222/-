// data/wordmaster/wordmaster_2000.json → public/wordmaster/day-01.json ~ day-50.json
// 원본(1.9MB)을 한 번에 받지 않도록 DAY별로 나눈다. 데이터를 고치면 `npm run wordmaster` 로 다시 만든다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("data/wordmaster/wordmaster_2000.json", "utf8"));
mkdirSync("public/wordmaster", { recursive: true });

for (let day = 1; day <= src.meta.days; day++) {
  const words = src.words
    .filter((w) => w.day === day)
    .sort((a, b) => a.order - b.order)
    .map((w) => ({
      id: w.id,
      word: w.word,
      meaning: w.meaning,
      sentences: w.sentences.map(({ level, text, answer, blanked }) => ({ level, text, answer, blanked })),
    }));
  writeFileSync(`public/wordmaster/day-${String(day).padStart(2, "0")}.json`, JSON.stringify({ day, words }));
}
console.log(`DAY ${src.meta.days}개 파일 생성 (단어 ${src.words.length}개)`);
