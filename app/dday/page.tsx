"use client";

import { useState } from "react";
import { CalendarPlus, School, Trash2 } from "lucide-react";
import { Card, SubHeader } from "@/components/ui";
import { daysUntil, ddayLabel, type DdayItem } from "@/lib/dday";
import { WEEKDAYS, fromYmd } from "@/lib/format";
import { useDdays } from "@/lib/useDdays";

export default function DdayPage() {
  const d = useDdays();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const upcoming = d.items.filter((i) => i.kind === "exam" || daysUntil(i.date, d.today) >= 0);
  const past = d.items.filter((i) => i.kind === "custom" && daysUntil(i.date, d.today) < 0).reverse();
  const canAdd = title.trim().length > 0 && !!date && date >= d.today && !busy;

  async function add() {
    if (!canAdd) return;
    setBusy(true);
    if (await d.add(title, date)) {
      setTitle("");
      setDate("");
    }
    setBusy(false);
  }

  return (
    <>
      <SubHeader title="디데이" back="/" />
      <div className="space-y-4 px-5 pt-1">
        {/* 직접 추가 */}
        <Card>
          <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <CalendarPlus size={17} className="text-accent" /> 디데이 추가
          </p>
          {d.customUnavailable ? (
            <p className="text-[13px] leading-relaxed text-faint">디데이 직접 추가는 아직 준비 중이에요. 학교 시험은 아래에 자동으로 나와요.</p>
          ) : (
            <form
              className="space-y-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={30}
                placeholder="예: 11월 학평, 토익, 수행평가 발표"
                className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none placeholder:text-faint focus:border-accent"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  min={d.today}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="날짜"
                  className="num h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 text-[15px] outline-none focus:border-accent"
                />
                <button
                  disabled={!canAdd}
                  className="h-12 w-24 shrink-0 rounded-xl bg-accent text-[15px] font-bold text-bg active:scale-[0.98] disabled:opacity-40"
                >
                  {busy ? "…" : "추가"}
                </button>
              </div>
            </form>
          )}
          {d.error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{d.error}</p>}
        </Card>

        {/* 다가오는 디데이 */}
        {!d.ready ? (
          <p className="py-10 text-center text-[14px] text-faint">불러오는 중…</p>
        ) : upcoming.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-faint">다가오는 디데이가 없어요</p>
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((i) => (
              <DdayRow key={i.key} item={i} today={d.today} onDelete={d.remove} />
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <section>
            <p className="mb-2 px-1 text-[13px] font-medium text-faint">지난 디데이</p>
            <ul className="space-y-2.5 opacity-60">
              {past.map((i) => (
                <DdayRow key={i.key} item={i} today={d.today} onDelete={d.remove} />
              ))}
            </ul>
          </section>
        )}
        <p className="pb-4 text-center text-[12px] text-faint">학교 시험은 NEIS 학사일정에서 내 학년 것만 자동으로 가져와요</p>
      </div>
    </>
  );
}

function DdayRow({ item, today, onDelete }: { item: DdayItem; today: string; onDelete: (id: string) => void }) {
  const days = daysUntil(item.date, today);
  const ongoing = item.kind === "exam" && days < 0; // 시험 기간 중
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
          {item.kind === "exam" && <School size={14} className="shrink-0 text-accent" />}
          <span className="truncate">{item.title}</span>
        </p>
        <p className="num mt-0.5 text-[12px] text-muted">
          {shortDate(item.date)}
          {item.kind === "exam" && item.end !== item.date && ` ~ ${shortDate(item.end)}`}
          {item.kind === "exam" && <span className="ml-1.5 text-faint">학교</span>}
        </p>
      </div>
      <span
        className={`num text-[20px] font-bold ${
          ongoing || days === 0 ? "text-danger" : days < 0 ? "text-muted" : days <= 7 ? "text-warn" : "text-text"
        }`}
      >
        {ongoing ? "시험 중" : ddayLabel(days)}
      </span>
      {item.kind === "custom" && (
        <button
          onClick={() => onDelete(item.id)}
          aria-label={`${item.title} 삭제`}
          className="-mr-1 grid size-9 place-items-center rounded-lg text-faint active:bg-surface-2"
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}

/** "2026-12-14" → "12/14(월)" */
function shortDate(ymd: string) {
  const d = fromYmd(ymd);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}
