"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { Card, ErrorText, InfoText, SubHeader } from "@/components/ui";
import { SUBJECT_DETAILS, TRACKS, type Track } from "@/lib/subjects";
import { koreanError, saveTrack } from "@/lib/supabase";

/** 내정보 → 계열 (문과·이과). 타이머·과제에서 고를 수 있는 세부 항목이 달라진다. 순위는 그대로 과목까지만 */
export default function TrackPage() {
  const auth = useAuth();
  const profile = useProfile();
  const [busy, setBusy] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function pick(t: Track) {
    if (busy || t === profile.track) return;
    setBusy(t);
    setError(null);
    setSaved(false);
    try {
      const ok = await saveTrack(profile.id, t);
      if (!ok) throw new Error("아직 바꿀 수 없어요 (데이터베이스 업데이트가 필요해요)");
      await auth.refreshProfile();
      setSaved(true);
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SubHeader title="계열" back="/me" />
      <div className="space-y-3 px-5 pt-2">
        <p className="text-[13px] leading-relaxed text-muted">
          계열에 따라 타이머와 과제에서 고를 수 있는 <b className="text-text">세부 과목</b>이 달라져요. 순위는 계열과 상관없이 국어·영어·수학·사회·과학·역사로만 나눠요.
        </p>
        {TRACKS.map((t) => {
          const on = profile.track === t;
          const d = SUBJECT_DETAILS[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => pick(t)}
              disabled={busy !== null}
              aria-pressed={on}
              className={`w-full rounded-2xl border bg-surface p-4 text-left ${on ? "border-accent ring-1 ring-accent" : "border-line"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[17px] font-bold">{t}</span>
                {on ? <Check size={20} className="text-accent" /> : busy === t ? <span className="text-[12px] text-faint">저장 중…</span> : null}
              </div>
              <dl className="mt-2 space-y-1 text-[12px] leading-relaxed">
                {(["수학", "사회", "과학"] as const).map((s) => (
                  <div key={s} className="flex gap-2">
                    <dt className="w-8 shrink-0 font-semibold text-muted">{s}</dt>
                    <dd className="text-faint">{d[s]?.join(" · ")}</dd>
                  </div>
                ))}
              </dl>
            </button>
          );
        })}
        {error && <ErrorText>{error}</ErrorText>}
        {saved && <InfoText>바꿨어요. 이제 타이머에서 {profile.track} 세부 과목을 고를 수 있어요.</InfoText>}
        <Card className="text-[12px] leading-relaxed text-muted">
          모든 과목에는 <b className="text-text">인강</b>도 고를 수 있어요. 인강 시간은 TIMETABLE에는 보이지만 총 공부 시간과 순위에는 들어가지 않아요.
        </Card>
      </div>
    </>
  );
}
