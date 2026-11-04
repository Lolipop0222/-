"use client";

import Link from "next/link";
import { ChevronRight, Utensils } from "lucide-react";
import { ymd } from "@/lib/format";
import { MEAL_LABEL, meals } from "@/lib/meals";
import { useToday } from "@/lib/useToday";

// 흰밥은 빼고 반찬만 보여준다
const PLAIN_RICE = /^(찹쌀|찰보리|찰옥수수|찰흑미|찰현미|기장|15곡혼합|미니)밥$/;

/** 홈 상단 "오늘 점심" 한 줄. 점심이 없는 날은 그날 있는 다른 끼니를 보여준다 */
export default function TodayMealLine() {
  const today = useToday();
  const day = today ? meals[ymd(today)] : undefined;
  const key = day ? (["lunch", "dinner", "breakfast"] as const).find((k) => day[k]) : undefined;
  const meal = key && day ? day[key] : undefined;

  return (
    <Link href="/calendar" className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      <Utensils size={18} className="shrink-0 text-warn" />
      <p className="min-w-0 flex-1 truncate text-[14px]">
        {!today ? (
          <span className="invisible">급식</span>
        ) : meal && key ? (
          <>
            <span className="mr-2 font-semibold text-muted">{MEAL_LABEL[key]}</span>
            {meal.note ?? meal.items.filter((i) => !PLAIN_RICE.test(i)).join(" · ")}
          </>
        ) : (
          <span className="text-muted">오늘은 급식이 없어요</span>
        )}
      </p>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </Link>
  );
}
