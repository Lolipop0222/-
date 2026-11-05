import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import EventBanner from "@/components/EventBanner";
import HomeDday from "@/components/HomeDday";
import HomePlanner from "@/components/HomePlanner";
import HomeStudy from "@/components/HomeStudy";
import TodayLabel from "@/components/TodayLabel";
import TodayMealLine from "@/components/TodayMealLine";
import { Card, PageHeader } from "@/components/ui";
import { reviewToday } from "@/lib/mock";

export default function HomePage() {
  return (
    <>
      <PageHeader title="대고 일품타" sub={<TodayLabel />} />

      <div className="space-y-4 px-5">
        {/* 오늘 급식 한 줄 */}
        <TodayMealLine />

        <HomeDday />

        <EventBanner />

        <HomeStudy />

        <HomePlanner />

        {/* 오늘 복습할 단어 */}
        <Link href="/words/review" className="block">
          <Card className="flex items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-live-soft text-live">
              <BookOpen size={22} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-muted">워마 · 쉬는 시간 10분이면 끝</p>
              <p className="text-[17px] font-bold">
                오늘 복습할 단어 <span className="num text-live">{reviewToday}개</span>
              </p>
            </div>
            <ChevronRight size={20} className="text-faint" />
          </Card>
        </Link>
      </div>
    </>
  );
}
