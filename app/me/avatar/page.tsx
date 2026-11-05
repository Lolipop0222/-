"use client";

import { useState } from "react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { AvatarIconView, ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { useMyTitles } from "@/components/TitlesProvider";
import { ErrorText, InfoText, PrimaryButton, SubHeader } from "@/components/ui";
import { AVATAR_COLORS, AVATAR_ICONS, avatarString, parseAvatar, saveAvatar, type AvatarValue } from "@/lib/titles";
import { koreanError } from "@/lib/supabase";

/**
 * 내정보 → 프로필 그림. 사진 대신 그림과 색을 고른다 (실명·얼굴을 받지 않는 앱 원칙).
 * 테두리는 대표 칭호 등급에 따라 달라진다.
 */
export default function AvatarPage() {
  const auth = useAuth();
  const profile = useProfile();
  const { titles } = useMyTitles();
  const equipped = titles?.find((t) => t.equipped) ?? null;
  const [picked, setPicked] = useState<AvatarValue>(parseAvatar(profile.avatar) ?? { icon: "cat", color: "s-math" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = avatarString(picked) !== (profile.avatar ?? "");

  async function save(v: AvatarValue | null) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveAvatar(profile.id, v);
      await auth.refreshProfile();
      setSaved(true);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(code === "42703" || code === "PGRST204" ? "아직 쓸 수 없어요 (데이터베이스 업데이트가 필요해요)" : koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SubHeader title="프로필 그림" back="/me" />
      <div className="space-y-5 px-5 pt-2">
        <div className="flex flex-col items-center gap-2 py-2">
          <ProfileAvatar avatar={avatarString(picked)} nickname={profile.nickname} grade={equipped?.grade} size={104} />
          <p className="text-[17px] font-bold">{profile.nickname}</p>
          {equipped ? (
            <TitleBadge name={equipped.name} grade={equipped.grade} />
          ) : (
            <p className="text-[12px] text-faint">대표 칭호를 달면 등급 색 테두리가 생겨요</p>
          )}
        </div>

        <section>
          <h2 className="mb-2 px-1 text-[14px] font-semibold">그림</h2>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_ICONS.map((icon) => {
              const on = picked.icon === icon;
              return (
                <button
                  key={icon}
                  type="button"
                  aria-label={icon}
                  aria-pressed={on}
                  onClick={() => setPicked((p) => ({ ...p, icon }))}
                  className={`grid aspect-square place-items-center rounded-xl border ${on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted"}`}
                >
                  <AvatarIconView icon={icon} className="size-6" />
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[14px] font-semibold">색</h2>
          <div className="flex flex-wrap gap-3">
            {AVATAR_COLORS.map((color) => {
              const on = picked.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`색 ${color}`}
                  aria-pressed={on}
                  onClick={() => setPicked((p) => ({ ...p, color }))}
                  className={`size-10 rounded-full ${on ? "ring-2 ring-text ring-offset-2 ring-offset-bg" : ""}`}
                  style={{ background: `var(--${color})` }}
                />
              );
            })}
          </div>
        </section>

        {error && <ErrorText>{error}</ErrorText>}
        {saved && <InfoText>바꿨어요. 순위와 그룹에서도 이 그림으로 보여요.</InfoText>}
        <PrimaryButton onClick={() => save(picked)} disabled={busy || !changed}>
          {busy ? "저장 중…" : "이 그림으로 바꾸기"}
        </PrimaryButton>
        {profile.avatar && (
          <button type="button" onClick={() => save(null)} disabled={busy} className="w-full py-2 text-center text-[13px] text-muted">
            그림 없이 닉네임 첫 글자로
          </button>
        )}
      </div>
    </>
  );
}
