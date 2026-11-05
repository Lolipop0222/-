// supabase/parts/*.sql(번호 순)을 이어 붙여 supabase/schema.sql(전체본)을 만든다.
//   npm run schema          → 다시 만들기
//   node scripts/schema.mjs --check → 전체본이 조각들과 같은지만 확인 (npm run lint에서 실행)
// 원본은 parts 쪽이다. schema.sql은 새 Supabase 프로젝트에 처음 한 번 넣을 때·로컬 테스트용.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "supabase");
const partsDir = join(dir, "parts");
const files = readdirSync(partsDir).filter((f) => /^\d{2}-.+\.sql$/.test(f)).sort();

const out =
  `-- 대고 일품타 · Supabase 스키마 전체본 (자동 생성 — 직접 고치지 말 것)\n` +
  `-- 원본: supabase/parts/${files.join(", ")}\n` +
  `-- 고칠 때는 parts의 파일을 고치고 \`npm run schema\`. 평소에는 바뀐 parts 파일만 SQL Editor에서 실행하면 된다.\n` +
  `-- 새 프로젝트에 처음 넣을 때만 이 파일을 통째로 실행한다 (여러 번 실행해도 안전).\n\n` +
  files.map((f) => readFileSync(join(partsDir, f), "utf8").trimEnd() + "\n").join("\n");

const target = join(dir, "schema.sql");
if (process.argv.includes("--check")) {
  const now = readFileSync(target, "utf8");
  if (now !== out) {
    console.error("supabase/schema.sql이 supabase/parts와 다릅니다. `npm run schema`를 실행하세요.");
    process.exit(1);
  }
  console.log(`schema.sql OK (${files.length}개 조각)`);
} else {
  writeFileSync(target, out);
  console.log(`supabase/schema.sql ← ${files.join(" + ")}`);
}
