"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Card } from "@/components/ui";
import { WM_DAYS, readBest } from "@/lib/wordmaster";

const DAYS = Array.from({ length: WM_DAYS }, (_, i) => i + 1);
const subscribe = () => () => {};
// DAY별 최고 점수(뜻 고르기·빈칸 채우기 중 높은 쪽, %)를 "90,,100,..." 문자열로 읽는다
const snapshot = () =>
  DAYS.map((d) => {
    const scores = [readBest(d, "meaning"), readBest(d, "blank")].filter((b) => b).map((b) => (b!.correct / b!.total) * 100);
    return scores.length ? Math.round(Math.max(...scores)) : "";
  }).join(",");

/** 워드마스터 수능 2000 — DAY 1~50 */
export default function WordmasterDays() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const best = useMemo(() => (raw ? raw.split(",").map((v) => (v ? Number(v) : null)) : []), [raw]);
  const tried = best.filter((v) => v !== null).length;

  return (
    <Card>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">워드마스터 수능 2000</h2>
          <p className="mt-0.5 text-[12px] text-muted">DAY마다 40단어 · 뜻 고르기 / 빈칸 채우기</p>
        </div>
        <p className="num text-[12px] text-faint">
          {tried}/{WM_DAYS} DAY
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {DAYS.map((d) => {
          const score = best[d - 1] ?? null;
          return (
            <Link
              key={d}
              href={`/words/day/${d}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-center active:scale-95 ${
                score === null ? "border-line bg-surface-2" : score >= 90 ? "border-live/40 bg-live-soft" : "border-accent/40 bg-accent-soft"
              }`}
            >
              <span className="text-[10px] font-medium text-faint">DAY</span>
              <span className="num text-[17px] font-bold leading-tight">{d}</span>
              {score !== null && (
                <span className={`num text-[10px] font-semibold ${score >= 90 ? "text-live" : "text-accent"}`}>{score}점</span>
              )}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
