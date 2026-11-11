"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { CharacterArt } from "@/components/CharacterArt";
import { LevelBadge } from "@/components/NameTag";
import { useStudy } from "@/components/StudyProvider";
import { hm } from "@/lib/format";
import { CHARACTERS, STAGE_LEVELS, STAGE_NAMES, characterById, characterColor, parseCharacter } from "@/lib/characters";
import { MAX_LEVEL, levelFromXp, useMyLevel, xpForLevel } from "@/lib/levels";

/** 홈 → 내 캐릭터 + 레벨 진행도. 08을 실행하기 전이면 숨긴다 */
export default function HomeCharacter() {
  const study = useStudy();
  const { level: me, available } = useMyLevel(study.version);
  if (!available || !me) return null;

  const lv = levelFromXp(me.xp);
  const cur = xpForLevel(lv);
  const next = lv >= MAX_LEVEL ? null : xpForLevel(lv + 1);
  const pct = next === null ? 100 : ((me.xp - cur) / (next - cur)) * 100;
  const mine = parseCharacter(me.character);
  const nextStage = STAGE_LEVELS.find((l) => l > lv) ?? null;

  if (!mine) {
    return (
      <Link href="/me/character" className="block rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold">나와 함께할 캐릭터를 골라 보세요</p>
          <ChevronRight size={18} className="text-faint" />
        </div>
        <div className="mt-2 flex h-28 items-end justify-between gap-1">
          {CHARACTERS.map((c) => (
            <span key={c.id} className="flex h-full flex-1 flex-col items-center">
              <span className="min-h-0 w-full flex-1">
                <CharacterArt choice={{ id: c.id, stage: 1, face: 1 }} />
              </span>
              <span className="text-[11px] font-bold" style={{ color: characterColor(c.id) }}>
                {c.subject}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">공부할수록 레벨이 오르고 캐릭터가 진화해요.</p>
      </Link>
    );
  }

  return (
    <Link href="/me/character" className="char-stage flex items-center gap-3 rounded-2xl border border-line p-3 pr-4" style={{ "--char": characterColor(mine.id) } as CSSProperties}>
      <span className="relative z-[1] h-32 w-24 shrink-0">
        <span className="char-float block h-full">
          <CharacterArt choice={mine} eager />
        </span>
      </span>
      <span className="relative z-[1] min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <LevelBadge level={lv} size="md" />
          <span className="truncate text-[13px] font-semibold" style={{ color: characterColor(mine.id) }}>
            {characterById(mine.id)?.subject} · {STAGE_NAMES[mine.stage - 1]}
          </span>
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: characterColor(mine.id) }} />
        </span>
        <span className="mt-1.5 block text-[12px] text-muted">
          {next === null ? "만렙이에요!" : <>다음 레벨까지 <b className="text-text">{hm(next - me.xp)}</b></>}
        </span>
        {nextStage && <span className="block text-[11px] text-faint">Lv.{nextStage}에 다음 진화</span>}
      </span>
    </Link>
  );
}
