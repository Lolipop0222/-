"use client";

import { WEEKDAYS } from "@/lib/format";
import { useToday } from "@/lib/useToday";

export default function TodayLabel({ prefix = "" }: { prefix?: string }) {
  const today = useToday();
  if (!today) return <span className="invisible">0월 0일 (월)</span>;
  return (
    <span>
      {prefix}
      {today.getMonth() + 1}월 {today.getDate()}일 ({WEEKDAYS[today.getDay()]})
    </span>
  );
}
