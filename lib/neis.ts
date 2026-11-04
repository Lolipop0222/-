/**
 * NEIS 교육정보 개방 포털 Open API — docs/NEIS_API.md 기준.
 * 서버에서만 쓴다 (인증키가 브라우저로 나가면 안 된다).
 * 환경변수: NEIS_API_KEY(필수), NEIS_SCHOOL_CODE(없으면 학교명으로 조회), NEIS_OFFICE_CODE(기본 G10)
 */
import { cacheLife } from "next/cache";
import type { Dish, Meal, MealDay } from "@/lib/meals";

const BASE = "https://open.neis.go.kr/hub";
const PAGE_SIZE = 1000; // NEIS 최대값 (문서 2장)
const SCHOOL_NAME = "대전고등학교";
const officeCode = () => process.env.NEIS_OFFICE_CODE || "G10"; // 대전광역시교육청

type NeisRow = Record<string, string>;
type NeisResult = { CODE: string; MESSAGE: string };

export class NeisError extends Error {
  constructor(
    readonly service: string,
    readonly code: string,
    message: string,
  ) {
    super(`NEIS ${service} ${code}: ${message}`);
  }
}

/**
 * 한 서비스를 호출해서 모든 행을 돌려준다 (문서 5장 파싱 규칙).
 * - 성공: { [service]: [{ head: [{ list_total_count }, { RESULT }] }, { row: [...] }] }
 * - 데이터 없음/오류: { RESULT } 만 온다. HTTP 상태는 200이라 res.ok로 판단하지 않는다.
 * - INFO-200(데이터 없음)은 빈 배열, INFO-000이 아닌 나머지는 NeisError.
 * - list_total_count가 pSize보다 크면 pIndex를 올려 반복한다.
 */
async function neis(service: string, params: Record<string, string>): Promise<NeisRow[]> {
  const key = process.env.NEIS_API_KEY;
  if (!key) throw new NeisError(service, "NO-KEY", "NEIS_API_KEY가 설정되지 않았습니다");

  const rows: NeisRow[] = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ KEY: key, Type: "json", pIndex: String(page), pSize: String(PAGE_SIZE), ...params });
    const res = await fetch(`${BASE}/${service}?${qs}`);
    if (!res.ok) throw new NeisError(service, `HTTP-${res.status}`, res.statusText);
    const data = await res.json();

    const body = data[service] as [{ head: [{ list_total_count: number }, { RESULT: NeisResult }] }, { row: NeisRow[] }] | undefined;
    const result: NeisResult | undefined = body ? body[0]?.head?.[1]?.RESULT : data.RESULT;
    if (!result) throw new NeisError(service, "BAD-RESPONSE", "응답 형식이 문서와 다릅니다");
    if (result.CODE === "INFO-200") return rows;
    if (result.CODE !== "INFO-000") throw new NeisError(service, result.CODE, result.MESSAGE);

    rows.push(...(body?.[1]?.row ?? []));
    const total = body?.[0]?.head?.[0]?.list_total_count ?? 0;
    if (rows.length >= total || page * PAGE_SIZE >= total) return rows;
  }
}

/** 대전고 표준학교코드. NEIS_SCHOOL_CODE가 없으면 schoolInfo로 찾는다 (이름이 정확히 같은 행) */
async function getSchoolCode(): Promise<string> {
  "use cache";
  cacheLife("max");
  if (process.env.NEIS_SCHOOL_CODE) return process.env.NEIS_SCHOOL_CODE;
  const rows = await neis("schoolInfo", { ATPT_OFCDC_SC_CODE: officeCode(), SCHUL_NM: SCHOOL_NAME });
  const school = rows.find((r) => r.SCHUL_NM === SCHOOL_NAME);
  if (!school) throw new NeisError("schoolInfo", "NOT-FOUND", `${SCHOOL_NAME}을 찾지 못했습니다`);
  return school.SD_SCHUL_CODE;
}

// ── 날짜 ──

/** 한국 시간 기준 YYYYMMDD. Vercel 서버는 UTC라 new Date()를 그대로 쓰면 오전 9시 전에 하루가 밀린다 */
export function kstYmd(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .replaceAll("-", "");
}

/** "202611" → ["20261101", "20261130"] (그 달의 진짜 마지막 날) */
function monthRange(yyyymm: string): [string, string] {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${yyyymm}01`, `${yyyymm}${String(last).padStart(2, "0")}`];
}

const dashed = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

// ── 급식 ──

const MEAL_KEY: Record<string, keyof MealDay> = { "1": "breakfast", "2": "lunch", "3": "dinner" };

/**
 * DDISH_NM 정제 (문서 4-2).
 * "현미밥<br/>된장찌개 (5.6.13.)<br/>제육볶음* (5.6.10.13.)" →
 * [{ name: "현미밥", allergens: [] }, { name: "된장찌개", allergens: [5, 6, 13] }, ...]
 */
export function parseDishes(raw: string): Dish[] {
  return raw
    .split(/<br\s*\/?>/i)
    .map((part) => {
      const allergens = [...part.matchAll(/\(([\d.,\s]+)\)/g)]
        .flatMap((m) => m[1].split(/[.,\s]+/))
        .filter(Boolean)
        .map(Number)
        .filter((n) => n >= 1 && n <= 19);
      const name = part
        .replace(/\s*\([\d.,\s]+\)/g, "") // 알레르기 번호
        .replace(/[\s*#ⓢ]+$/u, "") // 끝에 붙는 표시 기호
        .trim();
      return allergens.length ? { name, allergens: [...new Set(allergens)] } : { name };
    })
    .filter((d) => d.name);
}

/** 한 달 급식. yyyymm = "202611" → { "2026-11-04": { breakfast, lunch, dinner } } */
export async function getMonthMeals(yyyymm: string): Promise<Record<string, MealDay>> {
  "use cache";
  cacheLife("hours");

  const [from, to] = monthRange(yyyymm);
  const rows = await neis("mealServiceDietInfo", {
    ATPT_OFCDC_SC_CODE: officeCode(),
    SD_SCHUL_CODE: await getSchoolCode(),
    MLSV_FROM_YMD: from,
    MLSV_TO_YMD: to,
  });

  const out: Record<string, MealDay> = {};
  for (const r of rows) {
    const key = MEAL_KEY[r.MMEAL_SC_CODE];
    if (!key) continue;
    const kcal = parseFloat(r.CAL_INFO);
    const meal: Meal = { dishes: parseDishes(r.DDISH_NM ?? ""), ...(kcal ? { kcal: Math.round(kcal) } : {}) };
    (out[dashed(r.MLSV_YMD)] ??= {})[key] = meal;
  }
  return out;
}

// ── 학사일정 ──

export type SchoolEvent = { name: string; holiday: boolean; grades: number[] };
/** /api/schedule/[month] 응답 */
export type ScheduleResponse = { source: "neis" | "none"; events: Record<string, SchoolEvent[]> };

// 매주 토요일마다 들어 있어서 달력에 띄우면 소음만 된다
const SKIP_EVENTS = new Set(["토요휴업일"]);
const GRADE_FIELDS = ["ONE_GRADE_EVENT_YN", "TW_GRADE_EVENT_YN", "THREE_GRADE_EVENT_YN"];

/**
 * 한 달 학사일정 (문서 4-3). 같은 날 행사가 여러 개일 수 있어 날짜별 배열로 모은다.
 * yyyymm = "202611" → { "2026-11-19": [{ name: "대학수학능력시험", holiday: true, grades: [1, 2, 3] }] }
 */
export async function getMonthSchedule(yyyymm: string): Promise<Record<string, SchoolEvent[]>> {
  "use cache";
  cacheLife("hours");

  const [from, to] = monthRange(yyyymm);
  const rows = await neis("SchoolSchedule", {
    ATPT_OFCDC_SC_CODE: officeCode(),
    SD_SCHUL_CODE: await getSchoolCode(),
    AA_FROM_YMD: from,
    AA_TO_YMD: to,
  });

  const out: Record<string, SchoolEvent[]> = {};
  for (const r of rows) {
    const name = r.EVENT_NM?.trim();
    if (!name || SKIP_EVENTS.has(name)) continue;
    const grades = GRADE_FIELDS.flatMap((f, i) => (r[f] === "Y" ? [i + 1] : []));
    const holiday = r.SBTR_DD_SC_NM === "휴업일" || r.SBTR_DD_SC_NM === "공휴일";
    const list = (out[dashed(r.AA_YMD)] ??= []);
    if (!list.some((e) => e.name === name)) list.push({ name, holiday, grades });
  }
  return out;
}
