"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useStudy } from "@/components/StudyProvider";
import { LevelBadge } from "@/components/NameTag";
import { LEVEL_REWARDS, loadMyLevel, readSeenLevel, writeSeenLevel, type Reward } from "@/lib/levels";
import { notReady } from "@/lib/account";

type Toast = { level: number; rewards: Reward[] };

/**
 * 레벨이 오르면 위에 소리 없는 알림. 앱 열기·공부 기록이 바뀔 때 my_level()을 불러
 * 이 기기에 마지막으로 본 레벨(localStorage)과 비교한다. 처음 쓰는 기기에서는 알림 없이 기억만 한다.
 */
export default function LevelWatcher() {
  const auth = useAuth();
  const study = useStudy();
  const uid = auth.status === "ready" ? auth.user.id : null;
  const [toast, setToast] = useState<Toast | null>(null);
  const [off, setOff] = useState(false);

  useEffect(() => {
    if (!uid || off) return;
    let alive = true;
    const t = setTimeout(() => {
      loadMyLevel().then(
        (me) => {
          if (!alive) return;
          const seen = readSeenLevel(uid);
          writeSeenLevel(uid, me.level);
          if (seen === null || me.level <= seen) return;
          const rewards = LEVEL_REWARDS.filter((r) => r.level > seen && r.level <= me.level);
          setToast({ level: me.level, rewards });
          setTimeout(() => alive && setToast(null), 6000);
        },
        (e) => alive && notReady(e) && setOff(true),
      );
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [uid, off, study.version]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[61] mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+10px)]" aria-live="polite">
      <Link
        href="/me/level"
        onClick={() => setToast(null)}
        className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-lg"
      >
        <span className="text-[13px] font-semibold text-muted">레벨 업!</span>
        <LevelBadge level={toast.level} size="md" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
          {toast.rewards.length > 0 && (
            <>
              <Gift size={13} className="mr-1 inline align-[-2px] text-accent" />
              {toast.rewards.map((r) => r.title).join(", ")}
            </>
          )}
        </span>
      </Link>
    </div>
  );
}
