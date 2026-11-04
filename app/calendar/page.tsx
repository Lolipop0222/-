"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Flag, Plus, Utensils } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { WEEKDAYS, fromYmd, ymd } from "@/lib/format";
import { ALLERGENS, MEAL_LABEL, type Meal } from "@/lib/meals";
import { SUBJECT_COLOR, assessments } from "@/lib/mock";
import { useMonthMeals, useMonthSchedule } from "@/lib/useMonthly";
import { useToday } from "@/lib/useToday";

export default function CalendarPage() {
  const today = useToday();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = today ? new Date(today.getFullYear(), today.getMonth() + offset, 1) : null;
  const ym = shown ? ymd(shown).slice(0, 7).replace("-", "") : null;
  const monthMeals = useMonthMeals(ym);
  const schedule = useMonthSchedule(ym);

  if (!today) return <PageHeader title="캘린더" sub="급식 · 학사일정 · 수행평가" />;

  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDow = base.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  const todayKey = ymd(today);
  const selKey = selected ?? (offset === 0 ? todayKey : ymd(base));
  const selDate = fromYmd(selKey);
  const selDow = selDate.getDay();
  const selMeals = monthMeals?.meals[selKey];
  // 식단이 들어온 달인지 (급식 없는 날 vs 아직 안 나온 달 구분)
  const hasMonthMenu = monthMeals ? Object.keys(monthMeals.meals).length > 0 : false;
  const selEvents = schedule?.events[selKey] ?? [];
  const selAssess = assessments.filter((a) => a.date === selKey);

  return (
    <>
      <PageHeader title="캘린더" sub="급식 · 학사일정 · 수행평가" />

      <div className="space-y-4 px-5">
        <Card className="px-3 pb-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <button aria-label="이전 달" onClick={() => { setOffset((o) => o - 1); setSelected(null); }} className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2">
              <ChevronLeft size={20} />
            </button>
            <p className="num text-[17px] font-bold">
              {year}년 {month + 1}월
            </p>
            <button aria-label="다음 달" onClick={() => { setOffset((o) => o + 1); setSelected(null); }} className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[12px] font-medium text-faint">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={`py-2 ${i === 0 ? "text-danger/70" : i === 6 ? "text-accent/70" : ""}`}>
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const key = ymd(d);
              const isToday = key === todayKey;
              const isSel = key === selKey;
              const events = schedule?.events[key] ?? [];
              const holiday = events.some((e) => e.holiday);
              const dayAssess = assessments.filter((a) => a.date === key);
              const dow = d.getDay();
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-[15px] transition-colors ${
                    isSel ? "bg-accent font-bold text-bg" : isToday ? "bg-accent-soft font-bold text-accent" : ""
                  } ${!isSel && !isToday && (dow === 0 || holiday) ? "text-danger/80" : ""}`}
                >
                  <span className="num">{d.getDate()}</span>
                  <span className="mt-0.5 flex h-1.5 gap-0.5">
                    {events.length > 0 && <span className={`size-1.5 rounded-full ${isSel ? "bg-bg" : holiday ? "bg-danger" : "bg-accent"}`} />}
                    {dayAssess.map((a) => (
                      <span key={a.id} className="size-1.5 rounded-full" style={{ background: isSel ? "var(--bg)" : SUBJECT_COLOR[a.subject] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <h2 className="pt-1 text-[17px] font-bold">
          {selDate.getMonth() + 1}월 {selDate.getDate()}일 ({WEEKDAYS[selDow]})
        </h2>

        {(selEvents.length > 0 || selAssess.length > 0) && (
          <Card className="space-y-3">
            {selEvents.map((e) => (
              <p key={e.name} className="flex items-center gap-2.5 text-[15px]">
                <Flag size={16} className={e.holiday ? "text-danger" : "text-accent"} />
                <span className="flex-1">{e.name}</span>
                {e.holiday && <Badge tone="danger">쉬는 날</Badge>}
                {e.grades.length > 0 && e.grades.length < 3 && <Badge>{e.grades.join("·")}학년</Badge>}
              </p>
            ))}
            {selAssess.map((a) => (
              <p key={a.id} className="flex items-center gap-2.5 text-[15px]">
                <ClipboardList size={16} style={{ color: SUBJECT_COLOR[a.subject] }} />
                <span className="flex-1">
                  <span className="text-muted">{a.subject}</span> {a.title}
                </span>
                <Badge>{a.target}</Badge>
              </p>
            ))}
          </Card>
        )}

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <Utensils size={16} className="text-warn" /> 급식
            </p>
            {monthMeals && monthMeals.source !== "none" && (
              <span className="text-[11px] text-faint">{monthMeals.source === "neis" ? "NEIS" : "학교 식단표 파일"}</span>
            )}
          </div>
          {!monthMeals ? (
            <p className="text-[14px] text-faint">불러오는 중…</p>
          ) : selMeals ? (
            <>
              <div className="space-y-2.5">
                {(Object.keys(MEAL_LABEL) as (keyof typeof MEAL_LABEL)[]).map((k) => (
                  <MealRow key={k} title={MEAL_LABEL[k]} meal={selMeals[k]} />
                ))}
              </div>
              <details className="mt-3 text-[12px] text-faint">
                <summary className="cursor-pointer">알레르기 번호 안내</summary>
                <p className="mt-1.5 leading-relaxed">
                  {Object.entries(ALLERGENS)
                    .map(([n, name]) => `${n} ${name}`)
                    .join(" · ")}
                </p>
              </details>
            </>
          ) : (
            <p className="text-[14px] text-faint">{hasMonthMenu ? "급식이 없는 날이에요" : "아직 이 달 식단표가 없어요"}</p>
          )}
        </Card>

        <button className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-3.5 text-[14px] text-muted">
          <Plus size={16} /> 수행평가 등록 <span className="text-faint">(반장·과목부장)</span>
        </button>
      </div>
    </>
  );
}

function MealRow({ title, meal }: { title: string; meal?: Meal }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-muted">{title}</p>
        {meal?.kcal && <p className="num text-[11px] text-faint">{meal.kcal} kcal</p>}
      </div>
      {meal?.note ? (
        <p className="text-[14px] font-semibold text-warn">{meal.note}</p>
      ) : meal ? (
        <p className="text-[14px] leading-relaxed">
          {meal.dishes.map((d, i) => (
            <span key={i}>
              {i > 0 && <span className="text-faint"> · </span>}
              <span className="whitespace-nowrap">
                {d.name}
                {d.allergens && <sup className="num ml-0.5 text-[9px] text-faint">{d.allergens.join(".")}</sup>}
              </span>
            </span>
          ))}
        </p>
      ) : (
        <p className="text-[14px] text-faint">없음</p>
      )}
    </div>
  );
}
