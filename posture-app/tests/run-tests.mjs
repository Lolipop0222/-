// Node.js로 테스트 돌리기:  node tests/run-tests.mjs
import { runAll } from "./cases.js";

const results = runAll();
for (const r of results) console.log(`${r.ok ? "통과" : "실패"}  ${r.name}${r.ok ? "" : `\n      → ${r.message}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length}개 중 ${results.length - failed}개 통과${failed ? `, ${failed}개 실패` : ""}`);
process.exit(failed ? 1 : 0);
