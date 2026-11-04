/**
 * NEIS 오픈 API (서버에서만 쓴다 — 인증키가 브라우저로 나가면 안 된다).
 * 키는 환경변수 NEIS_API_KEY. 로컬은 .env.local, 배포는 Vercel 설정 화면에 넣는다.
 */
import { cacheLife } from "next/cache";
import type { Meal, MealDay } from "@/lib/meals";

const BASE = "https://open.neis.go.kr/hub";
const OFFICE_CODE = "G10"; // 대전광역시교육청
const SCHOOL_NAME = "대전고등학교";

type NeisRow = Record<string, string>;

async function neis(service: string, params: Record<string, string>): Promise<NeisRow[]> {
  const key = process.env.NEIS_API_KEY;
  if (!key) throw new Error("NEIS_API_KEY가 설정되지 않았습니다");

  const url = new URL(`${BASE}/${service}`);
  url.search = new URLSearchParams({ KEY: key, Type: "json", pIndex: "1", pSize: "200", ...params }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NEIS ${service} HTTP ${res.status}`);
  const json = await res.json();

  // 데이터가 없으면 { RESULT: { CODE: "INFO-200" } } 만 온다
  if (json.RESULT) {
    if (json.RESULT.CODE === "INFO-200") return [];
    throw new Error(`NEIS ${service} ${json.RESULT.CODE}: ${json.RESULT.MESSAGE}`);
  }
  const body = json[service] as [{ head: unknown[] }, { row: NeisRow[] }];
  return body?.[1]?.row ?? [];
}

/** 대전고 학교 코드. 환경변수로 직접 줄 수도 있다 (NEIS_SCHOOL_CODE) */
async function getSchoolCode(): Promise<string> {
  "use cache";
  cacheLife("max");
  if (process.env.NEIS_SCHOOL_CODE) return process.env.NEIS_SCHOOL_CODE;
  const rows = await neis("schoolInfo", { ATPT_OFCDC_SC_CODE: OFFICE_CODE, SCHUL_NM: SCHOOL_NAME });
  const school = rows.find((r) => r.SCHUL_NM === SCHOOL_NAME);
  if (!school) throw new Error(`NEIS에서 ${SCHOOL_NAME}을 찾지 못했습니다`);
  return school.SD_SCHUL_CODE;
}

const MEAL_KEY: Record<string, keyof MealDay> = { "1": "breakfast", "2": "lunch", "3": "dinner" };

/** "찹쌀밥 <br/>홍합살미역국 (18.)<br/>..." → ["찹쌀밥", "홍합살미역국", ...] */
function parseDishes(raw: string): string[] {
  return raw
    .split(/<br\s*\/?>/i)
    .map((d) =>
      d
        .replace(/\s*\([\d.,\s]+\)/g, "") // 알레르기 번호 (1.2.5.)
        .replace(/[\d.]+$/, "") // 괄호 없이 붙은 번호
        .trim(),
    )
    .filter(Boolean);
}

/** 한 달 급식. yyyymm = "202611" */
export async function getMonthMeals(yyyymm: string): Promise<Record<string, MealDay>> {
  "use cache";
  cacheLife("hours");

  const school = await getSchoolCode();
  const rows = await neis("mealServiceDietInfo", {
    ATPT_OFCDC_SC_CODE: OFFICE_CODE,
    SD_SCHUL_CODE: school,
    MLSV_FROM_YMD: `${yyyymm}01`,
    MLSV_TO_YMD: `${yyyymm}31`,
  });

  const out: Record<string, MealDay> = {};
  for (const r of rows) {
    const key = MEAL_KEY[r.MMEAL_SC_CODE];
    if (!key) continue;
    const ymd = `${r.MLSV_YMD.slice(0, 4)}-${r.MLSV_YMD.slice(4, 6)}-${r.MLSV_YMD.slice(6, 8)}`;
    const kcal = parseFloat(r.CAL_INFO);
    const meal: Meal = { items: parseDishes(r.DDISH_NM), ...(kcal ? { kcal: Math.round(kcal) } : {}) };
    (out[ymd] ??= {})[key] = meal;
  }
  return out;
}

export type SchoolEvent = { name: string; holiday: boolean; grades: number[] };
/** /api/schedule/[month] 응답 */
export type ScheduleResponse = { source: "neis" | "none"; events: Record<string, SchoolEvent[]> };

// 매주 토요일마다 들어 있어서 달력에 띄우면 소음만 된다
const SKIP_EVENTS = new Set(["토요휴업일"]);
const GRADE_FIELDS = ["ONE_GRADE_EVENT_YN", "TW_GRADE_EVENT_YN", "THREE_GRADE_EVENT_YN"];

/** 한 달 학사일정. yyyymm = "202611" → { "2026-11-19": [{ name: "대학수학능력시험", holiday: true, grades: [1,2,3] }] } */
export async function getMonthSchedule(yyyymm: string): Promise<Record<string, SchoolEvent[]>> {
  "use cache";
  cacheLife("hours");

  const school = await getSchoolCode();
  const rows = await neis("SchoolSchedule", {
    ATPT_OFCDC_SC_CODE: OFFICE_CODE,
    SD_SCHUL_CODE: school,
    AA_FROM_YMD: `${yyyymm}01`,
    AA_TO_YMD: `${yyyymm}31`,
  });

  const out: Record<string, SchoolEvent[]> = {};
  for (const r of rows) {
    const name = r.EVENT_NM?.trim();
    if (!name || SKIP_EVENTS.has(name)) continue;
    const ymd = `${r.AA_YMD.slice(0, 4)}-${r.AA_YMD.slice(4, 6)}-${r.AA_YMD.slice(6, 8)}`;
    const grades = GRADE_FIELDS.flatMap((f, i) => (r[f] === "Y" ? [i + 1] : []));
    const holiday = r.SBTR_DD_SC_NM === "휴업일" || r.SBTR_DD_SC_NM === "공휴일";
    const list = (out[ymd] ??= []);
    if (!list.some((e) => e.name === name)) list.push({ name, holiday, grades });
  }
  return out;
}
