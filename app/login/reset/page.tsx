"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Lock, Mail } from "lucide-react";
import { ErrorText, InfoText, InputRow, PrimaryButton, SubHeader, inputCls } from "@/components/ui";
import { MIN_PASSWORD, notReady, passwordProblem, resetPasswordWithCode } from "@/lib/account";
import { koreanError } from "@/lib/supabase";

const RESULT_MESSAGE = {
  invalid: "이메일이나 복구 코드가 맞지 않아요",
  locked: "여러 번 틀려서 잠시 막혔어요. 15분 뒤에 다시 해 주세요",
  weak: `비밀번호는 ${MIN_PASSWORD}자 이상으로 해 주세요`,
} as const;

/**
 * 비밀번호 찾기 — 이메일 + 복구 코드로 새 비밀번호를 정한다.
 * 메일 인증을 꺼 둬서 메일로 재설정 링크를 보낼 수 없다 (CLAUDE.md 3장). 복구 코드는 내정보 → 비밀번호·복구 코드에서 만든다.
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = email.includes("@") && code.replace(/[^A-Za-z0-9]/g, "").length >= 12 && password.length > 0 && again.length > 0;

  async function submit() {
    if (!canSubmit || busy) return;
    const problem = passwordProblem(password, again);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const r = await resetPasswordWithCode(email, code, password);
      if (r === "ok") setDone(true);
      else setError(RESULT_MESSAGE[r] ?? "문제가 생겼어요. 잠시 후 다시 시도해 주세요");
    } catch (e) {
      setError(notReady(e) ? "아직 이 기능을 쓸 수 없어요 (데이터베이스 업데이트가 필요해요)" : koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SubHeader title="비밀번호 찾기" back="/login" />
      <div className="px-5 pt-2">
        {done ? (
          <div className="space-y-4">
            <InfoText>새 비밀번호로 바꿨어요. 다른 기기에서 로그인된 것은 모두 로그아웃됐어요.</InfoText>
            <p className="text-[14px] leading-relaxed text-muted">
              쓴 복구 코드는 더 이상 쓸 수 없어요. 로그인한 다음 <b className="text-text">내정보 → 비밀번호·복구 코드</b>에서 새 코드를 만들어 두세요.
            </p>
            <PrimaryButton href="/login">로그인하러 가기</PrimaryButton>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-muted">
              가입한 이메일과 <b className="text-text">복구 코드</b>(예: ABCD-EFGH-JKLM)를 넣으면 새 비밀번호를 정할 수 있어요.
            </p>
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <InputRow icon={<Mail size={18} />}>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="가입한 이메일" className={inputCls} />
              </InputRow>
              <InputRow icon={<KeyRound size={18} />}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 20))}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="복구 코드"
                  className={`${inputCls} font-mono tracking-wider`}
                />
              </InputRow>
              <InputRow icon={<Lock size={18} />}>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`새 비밀번호 (${MIN_PASSWORD}자 이상)`}
                  className={inputCls}
                />
              </InputRow>
              <InputRow icon={<Lock size={18} />}>
                <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="새 비밀번호 한 번 더" className={inputCls} />
              </InputRow>

              {error && <ErrorText>{error}</ErrorText>}

              <div className="pt-3">
                <PrimaryButton disabled={!canSubmit || busy}>{busy ? "잠시만요…" : "새 비밀번호로 바꾸기"}</PrimaryButton>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-muted">
              <p className="font-semibold text-text">복구 코드가 없거나 잃어버렸나요?</p>
              <p className="mt-1">
                앱 관리자에게 <b className="text-text">닉네임</b>을 직접 알려 주세요. 본인인지 확인한 다음 새 복구 코드를 만들어 줄 거예요.
              </p>
            </div>
            <p className="mt-4 text-center text-[13px] text-faint">
              <Link href="/login">로그인 화면으로</Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
