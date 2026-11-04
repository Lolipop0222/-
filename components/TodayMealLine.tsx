"use client";

import Link from "next/link";
import { ChevronRight, Utensils } from "lucide-react";
import { ymd } from "@/lib/format";
import { MEAL_LABEL } from "@/lib/meals";
import { useMonthMeals } from "@/lib/useMonthly";
import { useToday } from "@/lib/useToday";

// 흰밥은 빼고 반찬만 보여준다
const PLAIN_RICE = /^(백미|쌀|현미|흑미|보리|잡곡|기장|귀리|수수|찹쌀|찰보리|찰옥수수|찰흑미|찰현미|혼합잡곡|\d+곡혼합|미니)밥$/;

/** 홈 상단 "오늘 점심" 한 줄. 점심이 없는 날은 그날 있는 다른 끼니를 보여준다 */
export default function TodayMealLine() {
  const today = useToday();
  const key0 = today ? ymd(today) : null;
  const month = useMonthMeals(key0 ? key0.slice(0, 7).replace("-", "") : null);
  const day = key0 && month ? month.meals[key0] : undefined;
  const key = day ? (["lunch", "dinner", "breakfast"] as const).find((k) => day[k]) : undefined;
  const meal = key && day ? day[key] : undefined;

  return (
    <Link href="/calendar" className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      <Utensils size={18} className="shrink-0 text-warn" />
      <p className="min-w-0 flex-1 truncate text-[14px]">
        {!month ? (
          <span className="invisible">급식</span>
        ) : meal && key ? (
          <>
            <span className="mr-2 font-semibold text-muted">{MEAL_LABEL[key]}</span>
            {meal.note ?? meal.dishes.map((d) => d.name).filter((n) => !PLAIN_RICE.test(n)).join(" · ")}
          </>
        ) : (
          <span className="text-muted">오늘은 급식이 없어요</span>
        )}
      </p>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </Link>
  );
}
