"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Lock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Card, ErrorText, InfoText, InputRow, PrimaryButton, SubHeader, inputCls } from "@/components/ui";
import {
  MIN_PASSWORD,
  createRecoveryCode,
  kstDateTime,
  notReady,
  passwordProblem,
  recoveryCodeCreatedAt,
} from "@/lib/account";
import { koreanError, supabase } from "@/lib/supabase";

/** 내정보 → 비밀번호·복구 코드 */
export default function SecurityPage() {
  return (
    <>
      <SubHeader title="비밀번호·복구 코드" back="/me" />
      <div className="space-y-4 px-5 pt-2">
        <RecoveryCodeCard />
        <ChangePasswordCard />
      </div>
    </>
  );
}

type CodeState = { status: "loading" } | { status: "missing" } | { status: "notReady" } | { status: "ready"; createdAt: string | null };

function RecoveryCodeCard() {
  const [state, setState] = useState<CodeState>({ status: "loading" });
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    recoveryCodeCreatedAt().then(
      (createdAt) => alive && setState(createdAt ? { status: "ready", createdAt } : { status: "missing" }),
      (e) => alive && setState(notReady(e) ? { status: "notReady" } : { status: "missing" }),
    );
    return () => {
      alive = false;
    };
  }, []);

  async function make() {
    if (busy) return;
    if (state.status === "ready" && !confirm("새 코드를 만들면 예전 코드는 쓸 수 없어요. 새로 만들까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const c = await createRecoveryCode();
      setCode(c);
      setCopied(false);
      setState({ status: "ready", createdAt: new Date().toISOString() });
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-accent" />
        <h2 className="text-[16px] font-bold">복구 코드</h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        비밀번호를 잊었을 때 이메일과 이 코드로 새 비밀번호를 정할 수 있어요. 코드는 <b className="text-text">만들 때 한 번만</b> 보여 주니 사진을 찍거나 종이에 적어
        두세요. 다른 사람에게 보여 주지 마세요.
      </p>

      {code && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent-soft p-4 text-center">
          <p className="num select-all font-mono text-[24px] font-bold tracking-[0.12em] text-accent">{code}</p>
          <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "복사했어요" : "복사하기"}
          </button>
          <p className="mt-2 text-[12px] text-muted">이 화면을 나가면 다시 볼 수 없어요.</p>
        </div>
      )}

      <div className="mt-4">
        {state.status === "loading" && <AppLoader size="inline" />}
        {state.status === "notReady" && <p className="text-[13px] text-faint">준비 중이에요 (데이터베이스 업데이트가 필요해요)</p>}
        {state.status === "missing" && <p className="mb-3 text-[13px] text-warn">아직 복구 코드가 없어요. 지금 만들어 두세요.</p>}
        {state.status === "ready" && !code && state.createdAt && (
          <p className="mb-3 text-[13px] text-muted">{kstDateTime(state.createdAt)}에 만든 코드가 있어요.</p>
        )}
        {error && (
          <div className="mb-3">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        {(state.status === "missing" || state.status === "ready") && (
          <PrimaryButton onClick={make} disabled={busy}>
            {busy ? "만드는 중…" : state.status === "missing" ? "복구 코드 만들기" : "새 코드로 바꾸기"}
          </PrimaryButton>
        )}
      </div>
    </Card>
  );
}

function ChangePasswordCard() {
  const auth = useAuth();
  const email = auth.status === "ready" ? auth.user.email ?? "" : "";
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    const problem = passwordProblem(password, again);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const sb = supabase();
      // 휴대폰을 잠깐 빌린 사람이 바꾸지 못하게 지금 비밀번호를 먼저 확인한다
      const { error: checkError } = await sb.auth.signInWithPassword({ email, password: current });
      if (checkError) throw new Error("지금 비밀번호가 맞지 않아요");
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setCurrent("");
      setPassword("");
      setAgain("");
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Lock size={18} className="text-accent" />
        <h2 className="text-[16px] font-bold">비밀번호 바꾸기</h2>
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* 비밀번호 관리자가 어떤 계정인지 알 수 있게 */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <InputRow icon={<Lock size={18} />}>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="지금 비밀번호" className={inputCls} />
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
        {done && <InfoText>비밀번호를 바꿨어요.</InfoText>}
        <div className="pt-1">
          <PrimaryButton disabled={busy || !current || !password || !again}>{busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
