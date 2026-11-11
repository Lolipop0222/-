import HomeCharacter from "@/components/HomeCharacter";
import HomeDday from "@/components/HomeDday";
import HomePlanner from "@/components/HomePlanner";
import HomePrints from "@/components/HomePrints";
import HomeRecoveryNudge from "@/components/HomeRecoveryNudge";
import HomeStudy from "@/components/HomeStudy";
import HomeWords from "@/components/HomeWords";
import TodayLabel from "@/components/TodayLabel";
import TodayMealLine from "@/components/TodayMealLine";
import { PageHeader } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <PageHeader title="대품타" sub={<TodayLabel />} />

      <div className="space-y-4 px-5">
        {/* 오늘 급식 한 줄 */}
        <TodayMealLine />

        <HomeCharacter />

        <HomeDday />

        <HomeRecoveryNudge />

        <HomeStudy />

        <HomePlanner />

        <HomePrints />

        <HomeWords />
      </div>
    </>
  );
}
