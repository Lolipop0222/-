"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, TriangleAlert } from "lucide-react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { AvatarIconView, ProfileAvatar, TitleBadge } from "@/components/TitleBadge";
import { useMyTitles } from "@/components/TitlesProvider";
import { ErrorText, InfoText, PrimaryButton, Segmented, SubHeader } from "@/components/ui";
import { photoPath, removePhotoFile, squarePhoto, uploadPhoto } from "@/lib/photos";
import { AVATAR_COLORS, AVATAR_ICONS, avatarString, parseAvatar, saveAvatar, type AvatarValue } from "@/lib/titles";
import { koreanError } from "@/lib/supabase";

const TABS = ["사진", "그림"] as const;

/**
 * 내정보 → 프로필 사진. 사진을 올리거나(320px로 줄여서 저장) 그림+색을 고른다.
 * 사진은 순위·스터디그룹에서 다른 학생에게 보인다. 부적절한 사진은 관리자가 내리거나 계정을 삭제할 수 있다.
 * 테두리는 대표 칭호 등급에 따라 달라진다.
 */
export default function AvatarPage() {
  const auth = useAuth();
  const profile = useProfile();
  const { titles } = useMyTitles();
  const equipped = titles?.find((t) => t.equipped) ?? null;
  const [tab, setTab] = useState<(typeof TABS)[number]>(parseAvatar(profile.avatar) ? "그림" : "사진");
  const [picked, setPicked] = useState<AvatarValue>(parseAvatar(profile.avatar) ?? { icon: "cat", color: "s-math" });
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 미리보기 주소 정리
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const oldPhoto = photoPath(profile.avatar);

  async function apply(value: string | null, msg: string) {
    await saveAvatar(profile.id, value);
    if (oldPhoto && value !== profile.avatar) await removePhotoFile(oldPhoto); // 예전 사진 파일은 지운다
    await auth.refreshProfile();
    setSaved(msg);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string; statusCode?: string })?.code;
      const m = (e as { message?: string })?.message ?? "";
      if (code === "42703" || code === "PGRST204" || /bucket not found/i.test(m)) setError("아직 쓸 수 없어요 (데이터베이스 업데이트가 필요해요)");
      else if (/exceeded the maximum allowed size|too large/i.test(m)) setError("사진 용량이 너무 커요");
      else setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    await run(async () => {
      const blob = await squarePhoto(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    });
  }

  const previewAvatar = tab === "사진" ? null : avatarString(picked);

  return (
    <>
      <SubHeader title="프로필 사진" back="/me" />
      <div className="space-y-5 px-5 pt-2">
        {/* 미리보기 */}
        <div className="flex flex-col items-center gap-2 py-2">
          {tab === "사진" && photo ? (
            <span className={`inline-grid size-[104px] place-items-center rounded-full ${equipped ? `ring-${equipped.grade}` : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 올리기 전 미리보기 (blob 주소) */}
              <img src={photo.url} alt="미리보기" className="size-[96px] rounded-full object-cover" />
            </span>
          ) : (
            <ProfileAvatar avatar={tab === "사진" ? profile.avatar : previewAvatar} nickname={profile.nickname} grade={equipped?.grade} size={104} />
          )}
          <p className="text-[17px] font-bold">{profile.nickname}</p>
          {equipped ? <TitleBadge name={equipped.name} grade={equipped.grade} /> : <p className="text-[12px] text-faint">대표 칭호를 달면 등급 색 테두리가 생겨요</p>}
        </div>

        <Segmented items={TABS} value={tab} onChange={(t) => (setTab(t), setError(null), setSaved(null))} />

        {tab === "사진" ? (
          <section className="space-y-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => (void pickFile(e.target.files?.[0]), (e.target.value = ""))} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-surface text-muted active:bg-surface-2"
            >
              {photo ? <Camera size={24} /> : <ImagePlus size={26} />}
              <span className="text-[14px] font-semibold">{photo ? "다른 사진 고르기" : "사진 고르기"}</span>
              <span className="text-[12px] text-faint">가운데를 정사각형으로 잘라 작게 줄여서 올려요</span>
            </button>
            <div className="flex gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <p>
                프로필 사진은 순위·스터디그룹에서 <b>다른 학생에게 보여요</b>. 부적절한 사진은 관리자가 내리거나 <b>계정을 삭제</b>할 수 있어요. 친구 얼굴이나 개인정보가 보이는
                사진은 올리지 마세요.
              </p>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            {saved && <InfoText>{saved}</InfoText>}
            <PrimaryButton
              onClick={() =>
                photo &&
                run(async () => {
                  const value = await uploadPhoto(profile.id, photo.blob);
                  try {
                    await apply(value, "사진을 바꿨어요. 순위와 그룹에서도 이 사진으로 보여요.");
                  } catch (e) {
                    await removePhotoFile(photoPath(value)); // 저장 실패 → 올린 파일 정리
                    throw e;
                  }
                  setPhoto(null);
                })
              }
              disabled={busy || !photo}
            >
              {busy ? "올리는 중…" : "이 사진으로 바꾸기"}
            </PrimaryButton>
          </section>
        ) : (
          <>
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
            {saved && <InfoText>{saved}</InfoText>}
            <PrimaryButton onClick={() => run(() => apply(avatarString(picked), "바꿨어요. 순위와 그룹에서도 이 그림으로 보여요."))} disabled={busy || avatarString(picked) === profile.avatar}>
              {busy ? "저장 중…" : "이 그림으로 바꾸기"}
            </PrimaryButton>
          </>
        )}

        {profile.avatar && (
          <button type="button" onClick={() => run(() => apply(null, "사진·그림을 지웠어요."))} disabled={busy} className="w-full py-2 text-center text-[13px] text-muted">
            사진·그림 없이 닉네임 첫 글자로
          </button>
        )}
      </div>
    </>
  );
}
