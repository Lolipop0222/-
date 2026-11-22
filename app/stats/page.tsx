"use client";

import { useEffect, useState } from "react";
import { AppLoader } from "@/components/BrandLoader";
import { useStudy } from "@/components/StudyProvider";
import { HEATMAP_MIN_DAYS, StatsPanel } from "@/components/stats/StatsView";
import { Card, ErrorText, Segmented, SubHeader } from "@/components/ui";
import { useChartTheme } from "@/lib/chartTheme";
import { dayNoStart, kstDayNo } from "@/lib/stats";
import { loadSessionsSince, type StudySession } from "@/lib/study";
import { koreanError } from "@/lib/supabase";

const PERIODS = ["1주", "1달", "3달", "1년"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { "1주": 7, "1달": 30, "3달": 90, "1년": 365 };

/**
 * 공부 통계 (2026-11-22). 내 기록만 읽어서(RLS) 브라우저에서 계산한다 — lib/stats.ts.
 * 기간을 고르면 지난 같은 기간과 비교. 그래프 모양은 테마마다 다르다(lib/chartTheme.ts, 과목 테마면 제목도 그 과목답게).
 */
export default function StatsPage() {
  const t = useChartTheme();
  const study = useStudy();
  const [period, setPeriod] = useState<Period>("1달");
  const [today, setToday] = useState<number | null>(null);
  const [data, setData] = useState<{ since: number; sessions: StudySession[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setToday(kstDayNo(Date.now())), 0);
    return () => clearTimeout(id);
  }, []);

  // 필요한 만큼(지난 기간 비교 + 잔디) 가져온다. 이미 더 길게 가져왔으면 다시 안 부른다
  const need = today === null ? null : today - Math.max(PERIOD_DAYS[period] * 2, HEATMAP_MIN_DAYS) + 1;
  useEffect(() => {
    if (need === null || (data && data.since <= need)) return;
    let alive = true;
    loadSessionsSince(dayNoStart(need)).then(
      (sessions) => alive && setData({ since: need, sessions }),
      (e) => alive && setError(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [need, data, study.version]);


  return (
    <>
      <SubHeader title={t.title} back="/me" />
      <div className="space-y-4 px-5 pb-8">
        <p className="-mt-1 text-[13px] text-muted">{t.sub}</p>
        <Segmented items={PERIODS} value={period} onChange={setPeriod} />
        {error && <ErrorText>{error}</ErrorText>}
        {today === null || !data ? (
          !error && <AppLoader label="기록 모으는 중…" />
        ) : (
          <StatsPanel
            today={today}
            sessions={data.sessions}
            n={PERIOD_DAYS[period]}
            empty={
              <Card>
                <p className="py-6 text-center text-[14px] leading-relaxed text-muted">
                  이 기간에는 아직 공부 기록이 없어요.
                  <br />
                  타이머로 공부하거나 시간을 직접 입력하면 여기에 그래프가 생겨요.
                </p>
              </Card>
            }
          />
        )}
        <p className="px-1 text-[11px] leading-relaxed text-faint">순위·레벨과 같은 기준이에요(타이머·직접 입력 모두). 기타·인강과 한 번에 4시간 넘게 켜 둔 기록은 빠지고, 하루는 한국 시간 0시 기준, 기록은 시작한 날에 세요.</p>
      </div>
    </>
  );
}

