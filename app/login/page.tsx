"use client";

import { useState } from "react";
import { KeyRound, Mail, Timer } from "lucide-react";
import { PrimaryButton } from "@/components/ui";

/** 0단계 로그인 — 이메일 + 가입 초대코드 (외부인 차단) */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-[calc(env(safe-area-inset-top)+64px)]">
      <div className="flex-1">
        <div className="grid size-16 place-items-center rounded-2xl bg-accent text-bg">
          <Timer size={34} strokeWidth={2.4} />
        </div>
        <h1 className="mt-6 text-[30px] font-bold leading-tight">
          대고 일품타
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          야자 시간을 기록하고, 겨루고,
          <br />그 사이에 단어를 외우자.
        </p>

        {sent ? (
          <div className="mt-10 rounded-2xl bg-live-soft p-5 text-[14px] leading-relaxed text-live">
            <b>{email}</b>로 로그인 링크를 보냈어요.
            <br />
            메일함에서 링크를 누르면 바로 시작돼요.
          </div>
        ) : (
          <div className="mt-10 space-y-3">
            <InputRow icon={<Mail size={18} />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                className="h-full w-full bg-transparent outline-none placeholder:text-faint"
              />
            </InputRow>
            <InputRow icon={<KeyRound size={18} />}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="가입 초대코드 (처음 한 번만)"
                className="h-full w-full bg-transparent outline-none placeholder:text-faint"
              />
            </InputRow>
            <p className="px-1 text-[12px] text-faint">초대코드는 대전고 학생에게만 공유돼요.</p>
          </div>
        )}
      </div>

      {!sent && (
        <PrimaryButton onClick={() => setSent(true)} disabled={!email.includes("@")}>
          로그인 링크 받기
        </PrimaryButton>
      )}
    </div>
  );
}

function InputRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-[16px] focus-within:border-accent">
      <span className="text-muted">{icon}</span>
      {children}
    </label>
  );
}
