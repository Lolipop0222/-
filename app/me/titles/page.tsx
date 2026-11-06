"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { useProfile } from "@/components/AuthProvider";
import { ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { useMyTitles, useTitles } from "@/components/TitlesProvider";
import { Card, ErrorText, SubHeader } from "@/components/ui";
import { GRADES, progressRatio, progressText, setTitle, type MyTitle } from "@/lib/titles";
import { koreanError } from "@/lib/supabase";

/**
 * 내정보 → 칭호. 등급별로 얻은 것·못 얻은 것, 진행도, 대표 칭호 고르기.
 * 히든 칭호는 얻기 전까지 서버가 '???'로 보내 준다.
 */
export default function TitlesPage() {
  const profile = useProfile();
  const { check } = useTitles();
  const { titles, reload, available } = useMyTitles();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void check();
  }, [check]);

  const equipped = titles?.find((t) => t.equipped) ?? null;
  const earned = titles?.filter((t) => t.earned_at).length ?? 0;

  async function equip(code: string | null) {
    setBusy(code ?? "none");
    setError(null);
    try {
      await setTitle(code);
      await reload();
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!available) {
    return (
      <>
        <SubHeader title="칭호" back="/me" />
        <p className="px-5 pt-6 text-center text-[14px] text-muted">준비 중이에요 (데이터베이스 업데이트가 필요해요)</p>
      </>
    );
  }

  return (
    <>
      <SubHeader title="칭호" back="/me" />
      <div className="space-y-5 px-5 pt-2">
        {/* 대표 칭호 */}
        <Card className="flex items-center gap-4">
          <ProfileAvatar avatar={profile.avatar} nickname={profile.nickname} grade={equipped?.grade} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold">{profile.nickname}</p>
            <div className="mt-1 flex min-h-5 items-center">
              {equipped ? <TitleBadge name={equipped.name} grade={equipped.grade} size="sm" /> : <span className="text-[12px] text-faint">대표 칭호 없음</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="num text-[20px] font-bold">
              {earned}
              <span className="text-[14px] text-faint">/{titles?.length ?? "–"}</span>
            </p>
            {equipped && (
              <button type="button" onClick={() => equip(null)} disabled={busy !== null} className="text-[12px] text-muted underline underline-offset-2">
                떼기
              </button>
            )}
          </div>
        </Card>
        <p className="-mt-2 px-1 text-[12px] text-faint">얻은 칭호를 누르면 닉네임 옆(순위·내정보)에 달려요. 공부를 끝내거나 앱을 열 때 자동으로 확인해요.</p>
        {error && <ErrorText>{error}</ErrorText>}

        {titles === null && <AppLoader />}

        {titles &&
          GRADES.map((g) => {
            const list = titles.filter((t) => t.grade === g.id);
            if (list.length === 0) return null;
            const got = list.filter((t) => t.earned_at).length;
            return (
              <section key={g.id}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <TitleBadge name={g.label} grade={g.id} size="sm" />
                  <span className="num text-[12px] text-faint">
                    {got}/{list.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.map((t) => (
                    <TitleRow key={t.code} t={t} busy={busy === t.code} onEquip={() => equip(t.code)} />
                  ))}
                </div>
              </section>
            );
          })}
      </div>
    </>
  );
}

function TitleRow({ t, busy, onEquip }: { t: MyTitle; busy: boolean; onEquip: () => void }) {
  const got = !!t.earned_at;
  const secret = t.grade === "hidden" && !got;
  const prog = progressText(t);

  return (
    <div className={`rounded-2xl border bg-surface px-4 py-3 ${t.equipped ? "border-accent" : "border-line"} ${got ? "" : "opacity-80"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {got ? (
              <TitleBadge name={t.name} grade={t.grade} size="md" />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2 py-0.5 text-[13px] font-semibold text-faint">
                <Lock size={12} /> {t.name}
              </span>
            )}
            {!secret && <span className="text-[11px] text-faint">{t.category}</span>}
          </div>
          <p className={`mt-1.5 text-[13px] ${got ? "text-muted" : "text-faint"}`}>{secret ? "조건은 비밀이에요. 우연히 찾아보세요" : t.description}</p>
        </div>
        {got && (
          <button
            type="button"
            onClick={onEquip}
            disabled={t.equipped || busy}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${t.equipped ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted active:opacity-70"}`}
          >
            {t.equipped ? (
              <span className="flex items-center gap-1">
                <Check size={13} /> 다는 중
              </span>
            ) : busy ? (
              "…"
            ) : (
              "대표로"
            )}
          </button>
        )}
      </div>

      {!got && prog && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progressRatio(t) * 100}%` }} />
          </div>
          <span className="num shrink-0 text-[12px] text-muted">{prog}</span>
        </div>
      )}
      {got && t.earned_at && <p className="mt-1.5 text-[11px] text-faint">{kstDate(t.earned_at)} 획득</p>}
    </div>
  );
}

function kstDate(iso: string) {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}
