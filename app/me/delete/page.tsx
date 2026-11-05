"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, TriangleAlert } from "lucide-react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { Card, ErrorText, InputRow, PrimaryButton, SubHeader, inputCls } from "@/components/ui";
import { deleteMyAccount, notReady } from "@/lib/account";
import { koreanError } from "@/lib/supabase";

const GONE = ["공부 기록과 순위", "플래너·데일리 루틴·디데이", "문의 내용", "닉네임·학년·반, 로그인 계정"];

/** 내정보 → 계정 삭제. 비밀번호를 한 번 더 넣고 닉네임을 똑같이 써야 지울 수 있다 */
export default function DeleteAccountPage() {
  const auth = useAuth();
  const profile = useProfile();
  const router = useRouter();
  const email = auth.status === "ready" ? auth.user.email ?? "" : "";
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && typed.trim() === profile.nickname;

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(email, password);
      router.replace("/login");
    } catch (e) {
      setError(notReady(e) ? "아직 이 기능을 쓸 수 없어요 (데이터베이스 업데이트가 필요해요)" : koreanError(e));
      setBusy(false);
    }
  }

  return (
    <>
      <SubHeader title="계정 삭제" back="/me" />
      <div className="space-y-4 px-5 pt-2">
        <Card>
          <div className="flex items-center gap-2 text-danger">
            <TriangleAlert size={18} />
            <h2 className="text-[16px] font-bold">지우면 되돌릴 수 없어요</h2>
          </div>
          <p className="mt-2 text-[13px] text-muted">아래 내용이 바로 모두 삭제돼요.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px]">
            {GONE.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-faint">워마 최고 점수처럼 이 기기에만 저장된 것은 앱을 지우거나 브라우저 데이터를 지우면 없어져요.</p>
        </Card>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input type="email" autoComplete="username" value={email} readOnly hidden />
          <InputRow icon={<Lock size={18} />}>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className={inputCls} />
          </InputRow>
          <div>
            <p className="mb-1.5 px-1 text-[13px] text-muted">
              확인을 위해 닉네임 <b className="text-text">{profile.nickname}</b>을(를) 똑같이 써 주세요.
            </p>
            <InputRow icon={<TriangleAlert size={18} />}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={profile.nickname} className={inputCls} />
            </InputRow>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="pt-2">
            <PrimaryButton tone="danger" disabled={!canSubmit || busy}>
              {busy ? "지우는 중…" : "계정과 모든 기록 삭제"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </>
  );
}
