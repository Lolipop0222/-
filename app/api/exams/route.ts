import { connection } from "next/server";
import { getMonthSchedule, kstYmd, type SchoolEvent } from "@/lib/neis";
import type { Exam, ExamsResponse } from "@/lib/dday";

const MONTHS_AHEAD = 6;

// 시험으로 칠 행사 / 이름에 시험이 들어가도 시험 날이 아닌 행사
const EXAM = /고사|학력평가|모의평가|모의고사|수학능력시험|수능/;
const NOT_EXAM = /예비소집|감독|성적|발표|접수|원서|결과|확인|채점/;

/**
 * GET /api/exams — 오늘부터 6개월 안의 시험 (NEIS 학사일정에서 자동으로 찾는다).
 * 며칠 이어지는 시험(기말고사 12/14~18)은 하나로 묶는다. 학년 거르기는 화면에서 한다.
 */
export async function GET() {
  await connection(); // "오늘"에 따라 결과가 달라지므로 빌드할 때 미리 만들지 않고 요청마다 실행
  const today = kstYmd(); // "20261105"
  const months = Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(4, 6)) - 1 + i, 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  let body: ExamsResponse;
  try {
    const schedules = await Promise.all(months.map((m) => getMonthSchedule(m)));
    const days: [string, SchoolEvent][] = schedules
      .flatMap((s) => Object.entries(s).flatMap(([date, events]) => events.map((e) => [date, e] as [string, SchoolEvent])))
      .filter(([, e]) => EXAM.test(e.name) && !NOT_EXAM.test(e.name))
      .sort(([a], [b]) => a.localeCompare(b));

    // 같은 이름이 며칠 안에(주말 포함 3일) 이어지면 하나로 묶는다
    const exams: Exam[] = [];
    for (const [date, e] of days) {
      const last = exams.findLast((x) => x.name === e.name);
      if (last && daysBetween(last.end, date) <= 3) last.end = date;
      else exams.push({ name: e.name, start: date, end: date, grades: e.grades });
    }
    const todayDashed = `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}`;
    body = { source: "neis", exams: exams.filter((x) => x.end >= todayDashed) };
  } catch (e) {
    console.error("[exams]", e);
    body = { source: "none", exams: [] };
  }
  return Response.json(body);
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
