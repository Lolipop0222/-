"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { Segmented } from "@/components/ui";
import { hm } from "@/lib/format";
import { RANKING_SCOPES, rankingAround, type RankRow, type RankingScope } from "@/lib/mock";

const MEDAL = ["#ffd166", "#c9d1e0", "#e0a37a"];

/** 주간 순위 — 내 순위를 가운데 두고 위아래 세 명씩 */
export default function Ranking() {
  const [scope, setScope] = useState<RankingScope>("반");
  const { top, around, total } = rankingAround(scope);

  return (
    <section id="ranking" className="scroll-mt-4 px-5 pt-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-[20px] font-bold">이번 주 순위</h2>
        <p className="text-[12px] text-faint">매주 월요일 0시 초기화</p>
      </div>

      <Segmented items={RANKING_SCOPES} value={scope} onChange={setScope} />

      {top.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {top.map((r) => (
            <div key={r.rank} className="rounded-2xl bg-surface p-3 text-center">
              <Crown size={18} className="mx-auto" style={{ color: MEDAL[r.rank - 1] }} fill={MEDAL[r.rank - 1]} />
              <p className="mt-1.5 truncate text-[13px] font-semibold">{r.nickname}</p>
              <p className="num text-[12px] text-muted">{hm(r.totalSec)}</p>
            </div>
          ))}
        </div>
      )}

      <ol className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
        {top.length > 0 && around[0].rank > 4 && (
          <li className="py-1 text-center text-[12px] tracking-[0.3em] text-faint">⋯</li>
        )}
        {around.map((r) => (
          <RankItem key={r.rank} row={r} />
        ))}
      </ol>
      <p className="mt-2 text-center text-[12px] text-faint">
        {scope} {total}명 중
      </p>
    </section>
  );
}

function RankItem({ row }: { row: RankRow }) {
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 ${
        row.me ? "bg-accent-soft ring-1 ring-inset ring-accent/40" : "border-t border-line first:border-t-0"
      }`}
    >
      <span className={`num w-8 text-[15px] font-bold ${row.me ? "text-accent" : "text-muted"}`}>{row.rank}</span>
      <span className="relative grid size-8 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold">
        {row.nickname[0]}
        {row.studying && <span className="live-dot absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-live" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
        {row.nickname}
        {row.me && <span className="ml-1.5 text-[12px] text-accent">나</span>}
      </span>
      <span className="num text-[14px] font-semibold">{hm(row.totalSec)}</span>
    </li>
  );
}
