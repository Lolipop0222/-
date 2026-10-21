import Link from "next/link";
import { Camera, ChevronRight, PenLine, Play } from "lucide-react";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { BOX_INTERVAL_DAYS, books, boxCounts, dayList, reviewToday } from "@/lib/mock";

export default function WordsPage() {
  const book = books[0];
  const boxMax = Math.max(...boxCounts);

  return (
    <>
      <PageHeader title="워마" sub="워드 마스터 · 상자 5단계 복습" />

      <div className="space-y-4 px-5">
        {/* 오늘 복습 */}
        <Card flush className="relative p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-live/10 blur-2xl" />
          <p className="text-[13px] text-muted">오늘 복습할 단어</p>
          <p className="num mt-1 text-[40px] font-bold leading-none text-live">
            {reviewToday}
            <span className="ml-1 text-[18px] text-text">개</span>
          </p>
          <p className="mt-2 text-[13px] text-muted">한 번에 20개씩 · 약 6분</p>
          <Link
            href="/words/review"
            className="mt-5 flex h-13 items-center justify-center gap-2 rounded-2xl bg-live text-[16px] font-bold text-bg active:scale-[0.98]"
          >
            <Play size={18} fill="currentColor" />
            복습 시작
          </Link>
        </Card>

        {/* 단어 추가 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/words/scan" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <Camera size={20} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">사진 스캔</span>
              <span className="text-[12px] text-muted">단어장 펼친 면 찍기</span>
            </span>
          </Link>
          <Link href="/words/add" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2">
            <span className="grid size-10 place-items-center rounded-xl bg-warn-soft text-warn">
              <PenLine size={20} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">직접 입력</span>
              <span className="text-[12px] text-muted">한 단어씩 추가</span>
            </span>
          </Link>
        </div>

        {/* 상자 단계 */}
        <Card>
          <SectionTitle>상자별 단어</SectionTitle>
          <div className="flex h-28 items-end gap-2">
            {boxCounts.map((n, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="num text-[12px] font-semibold">{n}</span>
                <div
                  className="w-full rounded-lg bg-accent"
                  style={{ height: `${(n / boxMax) * 70}%`, opacity: 0.35 + i * 0.16 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-center">
            {BOX_INTERVAL_DAYS.map((d, i) => (
              <div key={i} className="flex-1">
                <p className="text-[12px] font-semibold">{i + 1}단계</p>
                <p className="text-[11px] text-faint">{d}일 후</p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">
            맞히면 한 칸 위로, 틀리면 1단계로 돌아가요.
          </p>
        </Card>

        {/* 교재 */}
        <section>
          <SectionTitle>내 단어장</SectionTitle>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
            {books.map((b, i) => (
              <div
                key={b.id}
                className={`w-[70%] shrink-0 rounded-2xl border p-4 ${i === 0 ? "border-accent/50 bg-accent-soft" : "border-line bg-surface"}`}
              >
                <p className="text-[15px] font-semibold">{b.title}</p>
                <p className="mt-1 text-[12px] text-muted">
                  DAY {b.days} · {b.words}단어
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg/60">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(b.mastered / b.words) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">5단계 도달 {Math.round((b.mastered / b.words) * 100)}%</p>
              </div>
            ))}
          </div>
        </section>

        <Card flush>
          <div className="px-4 pt-4">
            <SectionTitle>{book.title}</SectionTitle>
          </div>
          <ul>
            {dayList.map((d) => (
              <li key={d.day} className="flex items-center gap-3 border-t border-line px-4 py-3">
                <span className="num w-16 text-[15px] font-bold">DAY {d.day}</span>
                <div className="flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-live" style={{ width: `${d.progress * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-faint">{d.count}단어</p>
                </div>
                {d.due > 0 ? <Badge tone="live">복습 {d.due}</Badge> : <Badge>완료</Badge>}
                <ChevronRight size={16} className="text-faint" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
