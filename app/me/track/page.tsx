"use client";

import { useState } from "react";
import { Hash } from "lucide-react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { Card, ErrorText, InfoText, InputRow, PrimaryButton, Segmented, SubHeader, inputCls } from "@/components/ui";
import { SUBJECTS, TRACKS, detailsFor, needsTrack, type Track } from "@/lib/subjects";
import { koreanError, saveTrack, supabase } from "@/lib/supabase";

const GRADES = ["1학년", "2학년", "3학년"] as const;

/**
 * 내정보 → 학년·반·계열. 세부 과목 목록이 학년(2학년은 계열까지)에 따라 달라진다.
 * 학년이 올라가면 여기서 바꾼다. 순위 범위(학년·반)도 같이 바뀐다.
 */
export default function TrackPage() {
  const auth = useAuth();
  const profile = useProfile();
  const [grade, setGrade] = useState<(typeof GRADES)[number]>(GRADES[(profile.grade ?? 1) - 1] ?? "1학년");
  const [classNo, setClassNo] = useState(String(profile.class_no ?? ""));
  const [track, setTrack] = useState<Track | null>(profile.track ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const g = GRADES.indexOf(grade) + 1;
  const changed = g !== profile.grade || Number(classNo) !== profile.class_no || (track ?? null) !== (profile.track ?? null);
  const valid = Number(classNo) >= 1 && Number(classNo) <= 20 && (!needsTrack(g) || track !== null);

  async function save() {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (g !== profile.grade || Number(classNo) !== profile.class_no) {
        const { error } = await supabase().from("profiles").update({ grade: g, class_no: Number(classNo) }).eq("id", profile.id);
        if (error) throw error;
      }
      if (track && track !== profile.track) {
        const ok = await saveTrack(profile.id, track);
        if (!ok) throw new Error("계열은 아직 저장할 수 없어요 (데이터베이스 업데이트가 필요해요)");
      }
      await auth.refreshProfile();
      setSaved(true);
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  // 지금 고른 학년·계열의 세부 과목 미리보기
  const preview = SUBJECTS.map((s) => [s, detailsFor(g, track, s)] as const).filter(([, d]) => d.length > 0);

  return (
    <>
      <SubHeader title="학년·반·계열" back="/me" />
      <div className="space-y-4 px-5 pt-2">
        <p className="text-[13px] leading-relaxed text-muted">
          학년에 따라 타이머와 과제에서 고를 수 있는 <b className="text-text">세부 과목</b>이 달라져요. 2학년은 계열(문과·이과)에 따라서도 달라요. 순위는 언제나
          국어·영어·수학·사회·과학·역사로만 나눠요.
        </p>

        <div className="space-y-3">
          <Segmented items={GRADES} value={grade} onChange={setGrade} />
          <InputRow icon={<Hash size={18} />}>
            <input
              inputMode="numeric"
              value={classNo}
              onChange={(e) => setClassNo(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="반 (숫자만)"
              aria-label="반"
              className={inputCls}
            />
          </InputRow>
          {needsTrack(g) ? (
            <div>
              <p className="mb-1.5 px-1 text-[12px] text-muted">계열 (2학년)</p>
              <div className="flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="계열">
                {TRACKS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={track === t}
                    onClick={() => setTrack(t)}
                    className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${track === t ? "bg-bg text-text shadow" : "text-muted"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="px-1 text-[12px] text-faint">{g}학년은 문이과 구분 없이 같은 세부 과목을 써요.</p>
          )}
        </div>

        <Card>
          <p className="text-[13px] font-semibold">
            {g}학년{needsTrack(g) && track ? ` ${track}` : ""} 세부 과목
          </p>
          <dl className="mt-2 space-y-1 text-[12px] leading-relaxed">
            {preview.map(([s, d]) => (
              <div key={s} className="flex gap-2">
                <dt className="w-8 shrink-0 font-semibold text-muted">{s}</dt>
                <dd className="text-faint">{d.join(" · ")}</dd>
              </div>
            ))}
            <div className="flex gap-2">
              <dt className="w-8 shrink-0 font-semibold text-muted">영어</dt>
              <dd className="text-faint">세부 과목 없음</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-faint">모든 과목(기타 빼고)에 인강도 고를 수 있어요. 인강은 TIMETABLE에만 보이고 총 공부 시간·순위에는 안 들어가요.</p>
        </Card>

        {error && <ErrorText>{error}</ErrorText>}
        {saved && <InfoText>저장했어요.</InfoText>}
        <PrimaryButton onClick={save} disabled={busy || !changed || !valid}>
          {busy ? "저장 중…" : needsTrack(g) && !track ? "계열을 골라 주세요" : "저장"}
        </PrimaryButton>
      </div>
    </>
  );
}
