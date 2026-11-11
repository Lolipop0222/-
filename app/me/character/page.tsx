"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { CharacterArt, CharacterFace } from "@/components/CharacterArt";
import { LevelBadge } from "@/components/NameTag";
import { useStudy } from "@/components/StudyProvider";
import { ErrorText, InfoText, PrimaryButton, SubHeader } from "@/components/ui";
import {
  CHARACTERS,
  FACE_COUNT,
  FACE_LEVEL,
  STAGE_LEVELS,
  STAGE_NAMES,
  characterById,
  characterColor,
  choiceAllowed,
  faceUnlocked,
  formatCharacter,
  maxStage,
  parseCharacter,
  stageUnlocked,
  type CharacterChoice,
  type CharacterId,
} from "@/lib/characters";
import { setCharacter, useMyLevel, type MyLevel } from "@/lib/levels";
import { koreanError } from "@/lib/supabase";

/** 내정보 → 캐릭터: 과목 캐릭터 고르기, 진화 단계(스킨)·표정 바꾸기 */
export default function CharacterPage() {
  const study = useStudy();
  const { level: me, available, reload } = useMyLevel(study.version);

  if (!available) {
    return (
      <>
        <SubHeader title="캐릭터" back="/me" />
        <p className="px-5 py-16 text-center text-[14px] leading-relaxed text-muted">
          캐릭터는 준비 중이에요.
          <br />
          데이터베이스 업데이트(08-levels)가 끝나면 열려요.
        </p>
      </>
    );
  }
  if (!me) {
    return (
      <>
        <SubHeader title="캐릭터" back="/me" />
        <AppLoader label="캐릭터 불러오는 중…" />
      </>
    );
  }
  return <Picker me={me} reload={reload} />;
}

/** 아직 안 골랐으면: 가장 많이 공부한 과목의 캐릭터 */
function defaultChoice(me: MyLevel): CharacterChoice {
  const saved = parseCharacter(me.character);
  if (saved) return saved;
  const top = CHARACTERS.map((c) => ({ c, sec: me.subjects.find((s) => s.subject === c.subject)?.sec ?? 0 })).sort((a, b) => b.sec - a.sec)[0];
  return { id: (top.sec > 0 ? top.c.id : "history") as CharacterId, stage: maxStage(me.level), face: 1 };
}

function Picker({ me, reload }: { me: MyLevel; reload: () => Promise<void> }) {
  const [pick, setPick] = useState<CharacterChoice>(() => defaultChoice(me));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ch = characterById(pick.id)!;
  const allowed = choiceAllowed(pick, me.level);
  const current = me.character;
  const same = current === formatCharacter(pick);
  const stageLocked = !stageUnlocked(pick.stage, me.level);
  const color = characterColor(pick.id);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const r = await setCharacter(formatCharacter(pick));
      if (r === "locked") setError("아직 레벨이 모자라요.");
      else if (r === "invalid") setError("고를 수 없는 캐릭터예요.");
      else setSaved(true);
      await reload();
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SubHeader title="캐릭터" back="/me" />
      <div className="space-y-5 px-5 pb-8">
        {/* 무대 */}
        <div className="char-stage rounded-3xl border border-line" style={{ "--char": color } as CSSProperties}>
          <div className="flex items-start justify-between p-4 pb-0">
            <div>
              <p className="text-[18px] font-bold" style={{ color }}>
                {ch.subject} 캐릭터
              </p>
              <p className="text-[12px] text-muted">{ch.desc}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <LevelBadge level={me.level} size="md" />
              <span className="text-[11px] font-semibold text-muted">{STAGE_NAMES[pick.stage - 1]}</span>
            </div>
          </div>
          <div className="relative z-[1] mx-auto h-[min(58vh,380px)] w-full px-6 pb-3">
            <div key={formatCharacter(pick)} className={`char-in h-full ${allowed ? "char-float" : ""}`}>
              <CharacterArt choice={pick} locked={stageLocked} eager />
            </div>
            {stageLocked && (
              <span className="absolute inset-x-0 top-1/2 mx-auto flex w-max -translate-y-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
                <Lock size={14} /> Lv.{STAGE_LEVELS[pick.stage - 1]}에 열려요
              </span>
            )}
          </div>
        </div>

        {/* 캐릭터 */}
        <section>
          <h2 className="mb-2 text-[14px] font-semibold">캐릭터</h2>
          <div className="grid grid-cols-4 gap-2">
            {CHARACTERS.map((c) => {
              const on = pick.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPick((p) => ({ ...p, id: c.id }))}
                  className={`rounded-2xl border-2 p-1.5 text-center transition-colors ${on ? "bg-surface" : "border-transparent bg-surface"}`}
                  style={on ? { borderColor: characterColor(c.id) } : undefined}
                >
                  <CharacterFace choice={{ id: c.id, stage: 1, face: 1 }} label={`${c.subject} 캐릭터`} />
                  <span className="mt-1 block text-[12px] font-bold" style={{ color: characterColor(c.id) }}>
                    {c.subject}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 진화 단계 */}
        <section>
          <h2 className="mb-2 text-[14px] font-semibold">
            진화 단계 <span className="text-[12px] font-normal text-faint">· 레벨이 오르면 열려요</span>
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {STAGE_LEVELS.map((lv, i) => {
              const stage = i + 1;
              const open = stageUnlocked(stage, me.level);
              const on = pick.stage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPick((p) => ({ ...p, stage }))}
                  className={`rounded-2xl border-2 bg-surface p-1.5 text-center ${on ? "" : "border-transparent"}`}
                  style={on ? { borderColor: color } : undefined}
                >
                  <CharacterFace choice={{ id: pick.id, stage, face: 1 }} locked={!open} label={STAGE_NAMES[i]} />
                  <span className={`mt-1 block text-[11px] font-bold ${open ? "" : "text-faint"}`}>{open ? STAGE_NAMES[i] : `Lv.${lv}`}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 표정 */}
        <section>
          <h2 className="mb-2 text-[14px] font-semibold">
            표정 {me.level < FACE_LEVEL && <span className="text-[12px] font-normal text-faint">· Lv.{FACE_LEVEL}에 열려요</span>}
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: FACE_COUNT }, (_, i) => i + 1).map((face) => {
              const open = faceUnlocked(face, me.level);
              const on = pick.face === face;
              return (
                <button
                  key={face}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPick((p) => ({ ...p, face }))}
                  className={`rounded-2xl border-2 bg-surface p-1.5 ${on ? "" : "border-transparent"}`}
                  style={on ? { borderColor: color } : undefined}
                >
                  <CharacterFace choice={{ ...pick, stage: stageUnlocked(pick.stage, me.level) ? pick.stage : 1, face }} locked={!open} label={`표정 ${face}`} />
                </button>
              );
            })}
          </div>
        </section>

        {error && <ErrorText>{error}</ErrorText>}
        {saved && <InfoText>내 캐릭터로 정했어요.</InfoText>}
        <PrimaryButton onClick={save} disabled={busy || !allowed || same}>
          {busy ? (
            "저장 중…"
          ) : same ? (
            <>
              <Check size={18} /> 지금 내 캐릭터예요
            </>
          ) : !allowed ? (
            "아직 잠겨 있어요"
          ) : (
            "이 모습으로 정하기"
          )}
        </PrimaryButton>
        <p className="text-center text-[12px] leading-relaxed text-faint">
          진화 단계는 Lv.40 · 70 · 99에 열려요. 다른 보상은{" "}
          <Link href="/me/level" className="font-semibold text-accent">
            레벨 화면
          </Link>
          에서 볼 수 있어요.
        </p>
      </div>
    </>
  );
}
