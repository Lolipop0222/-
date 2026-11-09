"use client";

import { useState } from "react";
import { Check, Gift, Lock } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { useProfile } from "@/components/AuthProvider";
import { LevelBadge, NameTag } from "@/components/NameTag";
import { useStudy } from "@/components/StudyProvider";
import { Card, ErrorText, SubHeader } from "@/components/ui";
import { hm } from "@/lib/format";
import { LEVEL_REWARDS, MAX_LEVEL, levelFromXp, setNameFrame, useMyLevel, xpForLevel } from "@/lib/levels";
import { SUBJECT_COLOR } from "@/lib/subjects";
import { koreanError } from "@/lib/supabase";

/** 내정보 → 레벨: 진행도, 과목별 경험치, 10레벨마다 보상, 닉네임 테두리 고르기 */
export default function LevelPage() {
  const profile = useProfile();
  const study = useStudy();
  const { level: me, available, reload } = useMyLevel(study.version);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <>
        <SubHeader title="레벨" back="/me" />
        <p className="px-5 py-16 text-center text-[14px] leading-relaxed text-muted">
          레벨은 준비 중이에요.
          <br />
          데이터베이스 업데이트(08-levels)가 끝나면 열려요.
        </p>
      </>
    );
  }
  if (!me) {
    return (
      <>
        <SubHeader title="레벨" back="/me" />
        <AppLoader label="레벨 불러오는 중…" />
      </>
    );
  }

  const lv = levelFromXp(me.xp);
  const cur = xpForLevel(lv);
  const next = lv >= MAX_LEVEL ? null : xpForLevel(lv + 1);
  const pct = next === null ? 100 : ((me.xp - cur) / (next - cur)) * 100;

  async function wear(code: string | null) {
    setBusy(code ?? "none");
    setError(null);
    try {
      const r = await setNameFrame(code);
      if (r === "locked") setError("아직 레벨이 모자라요.");
      else if (r === "invalid") setError("없는 테두리예요.");
      await reload();
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SubHeader title="레벨" back="/me" />
      <div className="space-y-4 px-5 pb-8">
        {/* 지금 레벨 */}
        <Card flush className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-accent/10 blur-2xl" />
          <div className="flex min-w-0 items-center gap-2 text-[17px] font-bold">
            <NameTag name={profile.nickname} frame={me.frame} className="min-w-0" />
          </div>
          <p className="num mt-3 text-[48px] font-extrabold leading-none tracking-tight">
            <span className="mr-1 text-[20px] font-bold text-muted">Lv.</span>
            {lv}
            <span className="ml-1 text-[16px] font-semibold text-faint">/ {MAX_LEVEL}</span>
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {next === null ? (
              <b className="text-accent">만렙이에요! 🎉</b>
            ) : (
              <>
                다음 레벨까지 <b className="text-text">{hm(next - me.xp)}</b>
              </>
            )}
          </p>
          <p className="num mt-1 text-[12px] text-faint">
            경험치 {hm(me.xp)} / {Math.round(me.maxXp / 3600).toLocaleString()}시간
          </p>
        </Card>

        {/* 과목별 */}
        <Card>
          <p className="text-[15px] font-semibold">과목별 경험치</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-faint">과목마다 만렙에 필요한 시간까지만 경험치가 돼요. 골고루 공부해야 99레벨이에요.</p>
          <ul className="mt-3 space-y-3">
            {me.subjects.map((s) => {
              const full = s.sec >= s.cap;
              return (
                <li key={s.subject}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-semibold" style={{ color: SUBJECT_COLOR[s.subject] }}>
                      {s.subject}
                    </span>
                    <span className="num text-muted">
                      {full ? (
                        <b className="text-live">
                          <Check size={13} className="mr-0.5 inline align-[-2px]" />
                          {Math.round(s.cap / 3600)}시간 채움
                        </b>
                      ) : (
                        <>
                          {hm(s.sec)} <span className="text-faint">/ {Math.round(s.cap / 3600)}시간</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (s.sec / s.cap) * 100)}%`, background: SUBJECT_COLOR[s.subject] }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-muted">
            순위와 같은 기준이에요. 기타·인강은 빠지고, 한 번에 4시간 넘게 켜 둔 기록도 빠져요.
          </p>
        </Card>

        {/* 보상 */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">
            <Gift size={17} className="text-accent" /> 레벨 보상
          </h2>
          {error && <ErrorText>{error}</ErrorText>}
          <ul className="space-y-2">
            {LEVEL_REWARDS.map((r) => {
              const open = lv >= r.level;
              const worn = !!r.frame && me.frame === r.frame;
              return (
                <li key={`${r.level}-${r.title}`} className={`flex items-center gap-3 rounded-2xl border p-3 ${worn ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
                  <span className={`num grid size-11 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold ${open ? "bg-accent text-bg" : "bg-surface-2 text-faint"}`}>
                    {r.level}
                  </span>
                  <div className="min-w-0 flex-1">
                    {r.frame ? (
                      <div className={`flex min-w-0 text-[14px] font-semibold ${open ? "" : "opacity-50 grayscale"}`}>
                        <NameTag name={profile.nickname} frame={r.frame} className="min-w-0" />
                      </div>
                    ) : (
                      <p className="text-[14px] font-semibold">{r.title}</p>
                    )}
                    <p className="mt-1 truncate text-[12px] text-muted">
                      {r.frame ? r.title.replace("닉네임 테두리 · ", "테두리 · ") : r.desc}
                      {r.pending && " · 그림 준비 중"}
                    </p>
                  </div>
                  {r.frame ? (
                    open ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => wear(worn ? null : r.frame!)}
                        className={`shrink-0 rounded-xl px-3 py-2 text-[12px] font-bold ${worn ? "border border-line bg-surface text-muted" : "bg-accent text-bg"} disabled:opacity-50`}
                      >
                        {busy === (worn ? "none" : r.frame) ? "…" : worn ? "떼기" : "달기"}
                      </button>
                    ) : (
                      <Lock size={16} className="shrink-0 text-faint" aria-label="잠김" />
                    )
                  ) : open ? (
                    <span className="shrink-0 text-[12px] font-semibold text-live">받음</span>
                  ) : (
                    <Lock size={16} className="shrink-0 text-faint" aria-label="잠김" />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            10레벨마다 보상이 열려요. 닉네임 테두리는 순위·스터디그룹에서 다른 친구들에게도 보여요. 보상은 앞으로 더 늘어나요.
          </p>
        </section>

        <LevelTable />
      </div>
    </>
  );
}

/** 몇 시간이면 몇 레벨인지 (접어 둠) */
function LevelTable() {
  const [open, setOpen] = useState(false);
  const rows = [2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99];
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-accent" aria-expanded={open}>
        {open ? "레벨표 접기" : "레벨마다 필요한 시간 보기"}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {rows.map((l) => (
            <div key={l} className="rounded-xl bg-surface-2 px-2 py-2 text-center">
              <LevelBadge level={l} />
              <p className="num mt-1 text-[12px] text-muted">{hm(xpForLevel(l))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
