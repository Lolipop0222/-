import { getMonthSchedule, validMonth, type ScheduleResponse } from "@/lib/neis";

/** GET /api/schedule/202611 — 한 달 학사일정 (NEIS). 실패하면 빈 일정 */
export async function GET(_req: Request, ctx: RouteContext<"/api/schedule/[month]">) {
  const { month } = await ctx.params;
  if (!validMonth(month)) {
    return Response.json({ error: "month는 YYYYMM 형식" }, { status: 400 });
  }
  let body: ScheduleResponse;
  try {
    body = { source: "neis", events: await getMonthSchedule(month) };
  } catch (e) {
    console.error("[schedule]", e);
    body = { source: "none", events: {} };
  }
  return Response.json(body);
}
