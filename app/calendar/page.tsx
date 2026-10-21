"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Flag, Plus, Utensils } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { WEEKDAYS, fromYmd, ymd } from "@/lib/format";
import { SUBJECT_COLOR, assessments, schoolEvents, todayMeal } from "@/lib/mock";
import { useToday } from "@/lib/useToday";

export default function CalendarPage() {
  const today = useToday();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

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
  const isWeekend = selDow === 0 || selDow === 6;
  const selEvents = schoolEvents[selKey] ?? [];
  const selAssess = assessments.filter((a) => a.date === selKey);

  return (
    <>
      <PageHeader title="캘린더" sub="급식 · 학사일정 · 수행평가" />

      <div className="space-y-4 px-5">
        <Card className="px-3 pb-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <button aria-label="이전 달" onClick={() => setOffset((o) => o - 1)} className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2">
              <ChevronLeft size={20} />
            </button>
            <p className="num text-[17px] font-bold">
              {year}년 {month + 1}월
            </p>
            <button aria-label="다음 달" onClick={() => setOffset((o) => o + 1)} className="grid size-9 place-items-center rounded-full text-muted active:bg-surface-2">
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
              const hasEvent = !!schoolEvents[key];
              const dayAssess = assessments.filter((a) => a.date === key);
              const dow = d.getDay();
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-[15px] transition-colors ${
                    isSel ? "bg-accent font-bold text-bg" : isToday ? "bg-accent-soft font-bold text-accent" : ""
                  } ${!isSel && !isToday && (dow === 0 || hasEvent) ? "text-danger/80" : ""}`}
                >
                  <span className="num">{d.getDate()}</span>
                  <span className="mt-0.5 flex h-1.5 gap-0.5">
                    {hasEvent && <span className={`size-1.5 rounded-full ${isSel ? "bg-bg" : "bg-danger"}`} />}
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
              <p key={e} className="flex items-center gap-2.5 text-[15px]">
                <Flag size={16} className="text-danger" />
                {e}
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
          <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Utensils size={16} className="text-warn" /> 급식
          </p>
          {isWeekend ? (
            <p className="text-[14px] text-faint">급식이 없는 날이에요</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Meal title="중식" items={todayMeal.lunch} />
              <Meal title="석식" items={todayMeal.dinner} />
            </div>
          )}
        </Card>

        <button className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-3.5 text-[14px] text-muted">
          <Plus size={16} /> 수행평가 등록 <span className="text-faint">(반장·과목부장)</span>
        </button>
      </div>
    </>
  );
}

function Meal({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="mb-1.5 text-[12px] font-semibold text-muted">{title}</p>
      <ul className="space-y-0.5 text-[14px] leading-relaxed">
        {items.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
