import { meals as fileMeals, type MealDay, type MealsResponse } from "@/lib/meals";
import { getMonthMeals, validMonth } from "@/lib/neis";

/**
 * GET /api/meals/202611 — 한 달 급식.
 * NEIS를 먼저 보고, 실패하거나 비어 있으면 학교에서 받은 식단표 파일(lib/meals.ts)을 쓴다.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/meals/[month]">) {
  const { month } = await ctx.params;
  if (!validMonth(month)) {
    return Response.json({ error: "month는 YYYYMM 형식" }, { status: 400 });
  }

  const prefix = `${month.slice(0, 4)}-${month.slice(4, 6)}`;
  const fromFile = Object.fromEntries(Object.entries(fileMeals).filter(([d]) => d.startsWith(prefix)));

  let body: MealsResponse;
  try {
    const fromNeis = await getMonthMeals(month);
    if (Object.keys(fromNeis).length > 0) {
      // NEIS에 없는 메모(슈퍼 프라이데이 등)는 파일에서 채운다
      for (const [d, day] of Object.entries(fromFile)) {
        for (const [k, meal] of Object.entries(day) as [keyof MealDay, MealDay[keyof MealDay]][]) {
          if (meal?.note && !fromNeis[d]?.[k]) (fromNeis[d] ??= {})[k] = meal;
        }
      }
      body = { source: "neis", meals: fromNeis };
    } else {
      body = { source: Object.keys(fromFile).length ? "file" : "none", meals: fromFile };
    }
  } catch (e) {
    console.error("[meals]", e);
    body = { source: Object.keys(fromFile).length ? "file" : "none", meals: fromFile };
  }

  return Response.json(body);
}
