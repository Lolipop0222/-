"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Smartphone, X } from "lucide-react";
import { detectDevice, type DeviceInfo } from "@/lib/device";

const HIDE_KEY = "daego-install-hint-hidden";

/**
 * 휴대폰 브라우저로 열었을 때 "앱으로 설치하세요" 안내 → /install. 앱(홈 화면·APK)으로 열었으면 안 보인다.
 * 아이폰은 APK가 없어서 홈 화면에 추가가 유일한 설치 방법이라 특히 중요하다. dismissible이면 X로 닫을 수 있다(기기에 기억).
 */
export default function InstallHint({ dismissible = false, className = "" }: { dismissible?: boolean; className?: string }) {
  const [dev, setDev] = useState<DeviceInfo | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setDev(detectDevice());
      let h = false;
      try {
        h = dismissible && localStorage.getItem(HIDE_KEY) === "1";
      } catch {
        // 저장이 막힌 브라우저
      }
      setHidden(h);
    }, 0);
    return () => clearTimeout(t);
  }, [dismissible]);

  if (!dev || hidden || dev.installed || !(dev.ios || dev.android)) return null;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 ${className}`}>
      <Link href="/install" className="flex min-w-0 flex-1 items-center gap-3">
        <Smartphone size={22} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{dev.ios ? "아이폰은 홈 화면에 추가해서 써요" : "앱으로 설치하면 더 편해요"}</span>
          <span className="block text-[12px] text-muted">{dev.inApp ? "카카오톡 등 앱 안에서는 안 돼요 · 방법 보기" : "아이콘이 생기고 전체 화면으로 열려요 · 방법 보기"}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-accent" />
      </Link>
      {dismissible && (
        <button
          type="button"
          aria-label="안내 닫기"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              // 저장이 막혀도 이번에는 닫힌다
            }
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint active:bg-surface-2"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
