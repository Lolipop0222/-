"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorText, InputRow, PrimaryButton, Segmented, inputCls } from "@/components/ui";
import { MIN_PASSWORD } from "@/lib/account";
import { Emblem } from "@/components/BrandLoader";
import { TIME_QUOTES } from "@/lib/quotes";
import { TRACKS, needsTrack, type Track } from "@/lib/subjects";
import { koreanError, saveTrack, supabase } from "@/lib/supabase";

const MODES = ["로그인", "가입"] as const;
const GRADES = ["1학년", "2학년", "3학년"] as const;

/**
 * 0단계 로그인 — 이메일 + 비밀번호.
 * 가입할 때 닉네임·학년·반과 초대코드를 같이 받는다 (초대코드가 틀리면 프로필이 안 만들어져 앱을 쓸 수 없다).
 */
export default function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<(typeof MODES)[number]>("로그인");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [grade, setGrade] = useState<(typeof GRADES)[number]>("1학년");
  const [track, setTrack] = useState<Track | null>(null); // 문과·이과 — 타이머 세부 항목 목록이 달라진다
  const [classNo, setClassNo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 계정은 있는데 프로필이 없는 경우 (가입 중 초대코드가 틀렸거나 앱을 껐을 때)
  const profileOnly = auth.status === "needsProfile";
  const signingUp = mode === "가입" || profileOnly;

  // 계열은 2학년만 고른다 (1·3학년은 문이과 구분 없이 같은 세부 과목)
  const gradeNo = GRADES.indexOf(grade) + 1;
  const profileValid = nickname.trim().length >= 2 && Number(classNo) >= 1 && code.trim().length > 0 && (!needsTrack(gradeNo) || track !== null);
  // 시간 명언: 첫 화면은 첫 번째로 그리고, 브라우저에서 하나를 골라 바꾼다 (서버·브라우저 화면이 어긋나지 않게)
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setQuoteIdx(Math.floor(Math.random() * TIME_QUOTES.length)), 0);
    return () => clearTimeout(t);
  }, []);
  const quote = TIME_QUOTES[quoteIdx];
  const canSubmit = profileOnly
    ? profileValid
    : email.includes("@") && password.length >= (mode === "가입" ? MIN_PASSWORD : 6) && (mode === "로그인" || profileValid);

  async function createProfile() {
    const { data, error } = await supabase().rpc("create_profile", {
      p_nickname: nickname.trim(),
      p_grade: GRADES.indexOf(grade) + 1,
      p_class_no: Number(classNo),
      p_invite_code: code.trim(),
    });
    if (error) throw error;
    // 초대코드가 틀리면 DB가 오류 대신 빈 값을 준다 (틀린 횟수를 기록해 마구 넣어 보기를 막으려고)
    const id = (data as { id?: string } | null)?.id;
    if (!id) throw new Error("초대코드가 맞지 않습니다");
    if (track && needsTrack(GRADES.indexOf(grade) + 1)) await saveTrack(id, track).catch(() => false); // 계열은 나중에 내정보에서도 바꿀 수 있어서 실패해도 가입은 진행
    await auth.refreshProfile();
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = supabase();
      if (profileOnly) {
        await createProfile();
      } else if (mode === "로그인") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        await createProfile();
      }
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-[calc(env(safe-area-inset-top)+48px)]">
      <Emblem size={64} fast />
      <h1 className="mt-5 text-[28px] font-bold leading-tight">대품타</h1>
      {profileOnly ? (
        <p className="mt-1.5 text-[15px] text-muted">거의 다 왔어요. 프로필만 만들면 시작할 수 있어요.</p>
      ) : (
        <figure key={quote.text} className="toast-in mt-2 border-l-2 border-brand-gold pl-3">
          <blockquote className="text-[15px] leading-relaxed text-muted">“{quote.text}”</blockquote>
          <figcaption className="mt-1 text-[12px] text-faint">— {quote.who}</figcaption>
        </figure>
      )}

      {!profileOnly && (
        <div className="mt-8">
          <Segmented items={MODES} value={mode} onChange={(m) => (setMode(m), setError(null))} />
        </div>
      )}

      <form
        className="mt-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!profileOnly && (
          <>
            <InputRow icon={<Mail size={18} />}>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className={inputCls} />
            </InputRow>
            <InputRow icon={<Lock size={18} />}>
              <input
                type="password"
                autoComplete={mode === "가입" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "가입" ? `비밀번호 (${MIN_PASSWORD}자 이상)` : "비밀번호"}
                className={inputCls}
              />
            </InputRow>
          </>
        )}

        {signingUp && (
          <>
            <InputRow icon={<UserRound size={18} />}>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="닉네임 (2~12자, 순위에 보여요)" className={inputCls} />
            </InputRow>
            <Segmented items={GRADES} value={grade} onChange={setGrade} />
            {needsTrack(gradeNo) && (
            <div>
              <p className="mb-1.5 px-1 text-[12px] text-muted">계열 (2학년) — 타이머에서 고를 수 있는 세부 과목이 달라져요</p>
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
            )}
            <InputRow icon={<Hash size={18} />}>
              <input
                inputMode="numeric"
                value={classNo}
                onChange={(e) => setClassNo(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="반 (숫자만)"
                className={inputCls}
              />
            </InputRow>
            <InputRow icon={<KeyRound size={18} />}>
              <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="가입 초대코드" className={inputCls} />
            </InputRow>
            <p className="px-1 text-[12px] leading-relaxed text-faint">실명은 받지 않아요. 학년·반은 순위를 나누는 데만 써요.</p>
          </>
        )}

        {error && <ErrorText>{error}</ErrorText>}

        <div className="pt-3">
          <PrimaryButton disabled={!canSubmit || busy}>{busy ? "잠시만요…" : profileOnly ? "시작하기" : mode === "로그인" ? "로그인" : "가입하고 시작하기"}</PrimaryButton>
        </div>
      </form>

      {!profileOnly && mode === "로그인" && (
        <Link href="/login/reset" className="mt-5 self-center text-[14px] text-muted underline-offset-4 active:underline">
          비밀번호를 잊었어요
        </Link>
      )}

      {profileOnly && (
        <button onClick={() => auth.signOut()} className="mt-4 text-[14px] text-muted">
          다른 계정으로 로그인
        </button>
      )}
    </div>
  );
}
