"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound } from "lucide-react";
import { Card } from "@/components/ui";
import { recoveryCodeCreatedAt } from "@/lib/account";

/**
 * 홈 안내 — 비밀번호 복구 코드가 아직 없으면 만들라고 알려 준다 (실제 상태를 보고 보여 준다).
 * 이미 있거나, DB 업데이트 전이라 확인할 수 없으면 아무것도 보이지 않는다.
 */
export default function HomeRecoveryNudge() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    recoveryCodeCreatedAt().then(
      (v) => alive && setMissing(v === null),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!missing) return null;
  return (
    <Link href="/me/security" className="block">
      <Card className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
          <KeyRound size={20} />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold">복구 코드를 만들어 두세요</p>
          <p className="text-[12px] text-muted">비밀번호를 잊어도 다시 들어올 수 있어요</p>
        </div>
        <ChevronRight size={20} className="text-faint" />
      </Card>
    </Link>
  );
}
