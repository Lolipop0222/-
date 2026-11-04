// NEIS 인증키와 학교코드가 제대로 동작하는지 확인하는 스크립트
// 실행: 프로젝트 루트에서  node scripts/test-neis.mjs
// 필요: Node 18 이상, 프로젝트 루트의 .env.local 에 NEIS_API_KEY

import { readFileSync, existsSync } from 'node:fs';

// .env.local 읽기 (추가 패키지 없이)
const envPath = '.env.local';
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const KEY = process.env.NEIS_API_KEY;
const OFFICE = process.env.NEIS_OFFICE_CODE || 'G10';
let SCHOOL = process.env.NEIS_SCHOOL_CODE;

if (!KEY) {
  console.error('✗ .env.local 에 NEIS_API_KEY 가 없습니다.');
  process.exit(1);
}

async function call(service, params) {
  const qs = new URLSearchParams({ KEY, Type: 'json', pIndex: '1', pSize: '100', ...params });
  const res = await fetch(`https://open.neis.go.kr/hub/${service}?${qs}`);
  const data = await res.json();
  const body = data[service];
  if (!body) {
    const code = data.RESULT?.CODE;
    if (code === 'INFO-200') return [];
    throw new Error(`${service}: ${code} ${data.RESULT?.MESSAGE}`);
  }
  const code = body[0].head[1].RESULT.CODE;
  if (code !== 'INFO-000') throw new Error(`${service}: ${code}`);
  return body[1].row;
}

const kstYmd = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).replaceAll('-', '');

try {
  // 1) 학교코드 조회
  const schools = await call('schoolInfo', { ATPT_OFCDC_SC_CODE: OFFICE, SCHUL_NM: '대전고등학교' });
  console.log('✓ 인증키 정상 동작');
  console.log('\n[학교 검색 결과]');
  for (const s of schools) console.log(`  ${s.SCHUL_NM}  →  SD_SCHUL_CODE=${s.SD_SCHUL_CODE}  (${s.ORG_RDNMA})`);
  const exact = schools.find((s) => s.SCHUL_NM === '대전고등학교');
  if (!SCHOOL && exact) {
    SCHOOL = exact.SD_SCHUL_CODE;
    console.log(`\n→ .env.local 에 다음 줄을 추가하세요:  NEIS_SCHOOL_CODE=${SCHOOL}`);
  }
  if (!SCHOOL) throw new Error('학교코드를 찾지 못했습니다.');

  // 2) 이번 주 급식
  const today = new Date();
  const from = kstYmd(today);
  const to = kstYmd(new Date(today.getTime() + 7 * 86400000));
  const meals = await call('mealServiceDietInfo', {
    ATPT_OFCDC_SC_CODE: OFFICE, SD_SCHUL_CODE: SCHOOL, MLSV_FROM_YMD: from, MLSV_TO_YMD: to,
  });
  console.log(`\n[급식 ${from}~${to}] ${meals.length}건`);
  for (const m of meals.slice(0, 3)) {
    const menu = m.DDISH_NM.split(/<br\s*\/?>/i).map((x) => x.replace(/\s*\([\d.]+\)\s*$/, '').trim());
    console.log(`  ${m.MLSV_YMD} ${m.MMEAL_SC_NM}: ${menu.join(', ')}`);
  }
  if (meals[0]) console.log('\n[급식 원본 1건]\n' + JSON.stringify(meals[0], null, 2));

  // 3) 이번 달 학사일정
  const ym = from.slice(0, 6);
  const events = await call('SchoolSchedule', {
    ATPT_OFCDC_SC_CODE: OFFICE, SD_SCHUL_CODE: SCHOOL, AA_FROM_YMD: ym + '01', AA_TO_YMD: ym + '31',
  });
  console.log(`\n[학사일정 ${ym}] ${events.length}건`);
  for (const e of events.slice(0, 10)) console.log(`  ${e.AA_YMD} ${e.EVENT_NM}`);

  console.log('\n✓ 모두 정상. 위 원본 형식이 docs/NEIS_API.md 와 다르면 문서를 수정하세요.');
} catch (err) {
  console.error('✗', err.message);
  if (String(err.message).includes('ERROR-290')) console.error('  → 인증키가 틀렸습니다. 마이페이지에서 키를 다시 복사하세요.');
  process.exit(1);
}
