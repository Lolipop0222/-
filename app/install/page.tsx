"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Compass, Copy, Ellipsis, EllipsisVertical, ExternalLink, Download, Share, SquarePlus } from "lucide-react";
import { Emblem } from "@/components/BrandLoader";
import { Card, PrimaryButton, Segmented } from "@/components/ui";
import { canPromptInstall, captureInstallPrompt, detectDevice, onInstallPromptChange, openInExternalBrowser, promptInstall, type DeviceInfo } from "@/lib/device";

const APP_URL = "https://daego-ilpumta.vercel.app";
const TABS = ["아이폰", "안드로이드"] as const;
type Tab = (typeof TABS)[number];
const KAKAO_TRIED = "daego-kakao-external";

/**
 * 설치 안내 (2026-11-22, 사용자: "아이폰은 APK를 못 받는다, 빨리 대책") — 로그인 없이 열린다(AuthProvider PUBLIC_PATHS).
 * 친구들에게는 이 주소 하나만 보내면 된다. 기기를 알아보고 맞는 방법을 먼저 보여 준다:
 *  아이폰 = Safari → 공유 → 홈 화면에 추가 (PWA, 앱 아이콘·전체 화면) / 안드로이드 = Chrome "앱 설치" 또는 APK.
 *  카카오톡 등 앱 안 브라우저에서는 홈 화면에 추가가 안 되니 먼저 바깥 브라우저로 연다.
 */
export default function InstallPage() {
  const [dev, setDev] = useState<DeviceInfo | null>(null);
  const [tab, setTab] = useState<Tab>("아이폰");

  useEffect(() => {
    captureInstallPrompt();
    const t = setTimeout(() => {
      const d = detectDevice();
      setDev(d);
      if (d.android) setTab("안드로이드");
      // 카카오톡에서 열었으면 한 번은 바로 Safari/Chrome으로 넘겨 준다
      if (d.kakao) {
        try {
          if (!sessionStorage.getItem(KAKAO_TRIED)) {
            sessionStorage.setItem(KAKAO_TRIED, "1");
            openInExternalBrowser();
          }
        } catch {
          // 저장이 막혀 있으면 자동으로 넘기지 않는다 (버튼으로)
        }
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-12 pt-[calc(env(safe-area-inset-top)+36px)]">
      <div className="flex items-center gap-3">
        <Emblem size={52} fast />
        <div>
          <h1 className="text-[24px] font-bold leading-tight">대품타 설치하기</h1>
          <p className="text-[13px] text-muted">일등급을 품은 타이머 · 대전고</p>
        </div>
      </div>

      {dev?.installed ? (
        <Card className="mt-6">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-live">
            <Check size={18} /> 이미 앱으로 열었어요
          </p>
          <p className="mt-1 text-[13px] text-muted">이대로 쓰면 돼요. 새 기능은 자동으로 업데이트돼요.</p>
          <div className="mt-3">
            <PrimaryButton href="/">시작하기</PrimaryButton>
          </div>
        </Card>
      ) : (
        <>
          {dev?.inApp && <InAppNotice dev={dev} />}
          <div className="mt-6">
            <Segmented items={TABS} value={tab} onChange={setTab} />
          </div>
          {tab === "아이폰" ? <IosGuide dev={dev} /> : <AndroidGuide />}
        </>
      )}

      <CopyLink />
      <p className="mt-6 text-center text-[13px] text-muted">
        설치했으면 앱을 열고{" "}
        <Link href="/login" className="font-semibold text-accent underline underline-offset-2">
          로그인·가입
        </Link>
        하세요. 가입에는 초대코드가 필요해요.
      </p>
    </div>
  );
}

function InAppNotice({ dev }: { dev: DeviceInfo }) {
  const browser = dev.ios ? "Safari" : "Chrome";
  return (
    <Card className="mt-6 border-warn/50">
      <p className="text-[15px] font-bold text-warn">{dev.kakao ? "카카오톡" : "앱"} 안에서는 설치가 안 돼요</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        먼저 <b className="text-text">{browser}</b>로 열어 주세요.
        {!dev.kakao && (
          <>
            {" "}
            화면 위나 아래의 <Ellipsis size={14} className="inline align-[-2px]" /> 메뉴에서 「{browser}로 열기」 또는 「다른 브라우저로 열기」를 누르거나, 아래 주소를 복사해 {browser}에 붙여넣어요.
          </>
        )}
      </p>
      {dev.kakao && (
        <button
          type="button"
          onClick={() => openInExternalBrowser()}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-bg active:scale-[0.98]"
        >
          <ExternalLink size={18} /> {browser}로 열기
        </button>
      )}
    </Card>
  );
}

function IosGuide({ dev }: { dev: DeviceInfo | null }) {
  return (
    <div className="mt-4 space-y-3">
      <p className="px-1 text-[13px] leading-relaxed text-muted">
        아이폰은 앱스토어 없이 <b className="text-text">홈 화면에 추가</b>하면 앱처럼 써요. 아이콘이 생기고 주소창 없이 전체 화면으로 열려요. 받을 파일은 없어요.
      </p>
      {dev?.iosOtherBrowser && (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-[12px] leading-relaxed text-warn">
          Safari에서 하는 게 가장 확실해요. Chrome 등에서는 iOS 16.4 이상일 때 공유 버튼 → 홈 화면에 추가가 돼요.
        </p>
      )}
      <Step n={1} title={<>Safari로 이 주소를 열어요</>}>
        <MockBar start>
          <Compass size={16} className="text-accent" />
          <span className="truncate">daego-ilpumta.vercel.app/install</span>
        </MockBar>
      </Step>
      <Step n={2} title={<>아래쪽 공유 버튼을 눌러요</>} note="iOS 26은 오른쪽 아래 ⋯ → 공유">
        <MockBar>
          <span className="text-faint">‹</span>
          <span className="text-faint">›</span>
          <Hi>
            <Share size={18} />
          </Hi>
          <span className="grid size-5 place-items-center rounded border border-faint text-[9px] text-faint">2</span>
          <Ellipsis size={18} className="text-faint" />
        </MockBar>
      </Step>
      <Step n={3} title={<>「홈 화면에 추가」를 골라요</>} note="안 보이면 목록을 아래로 내려 보세요">
        <div className="space-y-1.5 rounded-xl border border-line bg-bg p-2 text-[13px]">
          <MockRow icon={<Copy size={16} />} label="복사" />
          <MockRow icon={<SquarePlus size={16} />} label="홈 화면에 추가" hi />
        </div>
      </Step>
      <Step n={4} title={<>오른쪽 위 「추가」를 눌러요</>} note="「웹 앱으로 열기」가 보이면 켜 둔 채로">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
          <span className="relative size-11 shrink-0 overflow-hidden rounded-[10px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-192.png" alt="" className="size-full" />
          </span>
          <span className="flex-1 text-[14px] font-semibold">대품타</span>
          <Hi>추가</Hi>
        </div>
      </Step>
      <Step n={5} title={<>홈 화면의 대품타 아이콘으로 열어요</>} note="Safari에서 로그인했어도 앱에서 한 번 더 로그인해요">
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="대품타 아이콘" className="size-14 rounded-[14px] border border-line" />
          <span className="pb-1 text-[12px] text-muted">아이콘을 누르면 바로 열려요</span>
        </div>
      </Step>
    </div>
  );
}

function AndroidGuide() {
  const [can, setCan] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    captureInstallPrompt();
    const sync = () => setCan(canPromptInstall());
    const t = setTimeout(sync, 0);
    const off = onInstallPromptChange(sync);
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  return (
    <div className="mt-4 space-y-3">
      <p className="px-1 text-[13px] leading-relaxed text-muted">
        안드로이드는 <b className="text-text">Chrome에서 바로 설치</b>할 수 있어요. APK 파일을 받은 친구는 그 앱을 그대로 써도 돼요(둘 다 같은 앱이고, 업데이트는 자동이에요).
      </p>
      {can && !done && (
        <button
          type="button"
          onClick={async () => setDone(await promptInstall())}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-bold text-bg active:scale-[0.98]"
        >
          <Download size={20} /> 지금 설치하기
        </button>
      )}
      {done && <p className="rounded-xl bg-live-soft px-3 py-2 text-[13px] text-live">설치했어요! 홈 화면의 대품타 아이콘으로 열어요.</p>}
      <Step n={1} title={<>Chrome으로 이 주소를 열어요</>}>
        <MockBar>
          <span className="truncate">daego-ilpumta.vercel.app/install</span>
          <EllipsisVertical size={18} className="text-faint" />
        </MockBar>
      </Step>
      <Step n={2} title={<>오른쪽 위 ⋮ 메뉴를 눌러요</>} note="위에 「지금 설치하기」 버튼이 보이면 그걸 눌러도 돼요">
        <MockBar>
          <span className="truncate text-faint">daego-ilpumta.vercel.app</span>
          <Hi>
            <EllipsisVertical size={18} />
          </Hi>
        </MockBar>
      </Step>
      <Step n={3} title={<>「앱 설치」 또는 「홈 화면에 추가」 → 설치</>}>
        <div className="space-y-1.5 rounded-xl border border-line bg-bg p-2 text-[13px]">
          <MockRow icon={<SquarePlus size={16} />} label="홈 화면에 추가" hi />
          <MockRow icon={<Download size={16} />} label="앱 설치" hi />
        </div>
      </Step>
    </div>
  );
}

function Step({ n, title, note, children }: { n: number; title: ReactNode; note?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-bg">{n}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{title}</p>
          {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
          <div className="mt-2.5">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function MockBar({ children, start }: { children: ReactNode; start?: boolean }) {
  return <div className={`flex h-11 items-center ${start ? "justify-start" : "justify-between"} gap-3 rounded-xl border border-line bg-bg px-3 text-[13px] text-muted`}>{children}</div>;
}

function MockRow({ icon, label, hi }: { icon: ReactNode; label: string; hi?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${hi ? "bg-accent-soft font-semibold text-accent ring-2 ring-accent" : "text-muted"}`}>
      <span>{label}</span>
      {icon}
    </div>
  );
}

/** 눌러야 할 곳 강조 */
function Hi({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-lg bg-accent-soft px-2 py-1 text-[13px] font-bold text-accent ring-2 ring-accent">{children}</span>;
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const url = `${APP_URL}/install`;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("이 주소를 복사하세요", url);
        }
      }}
      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[14px] font-semibold text-muted active:bg-surface-2"
    >
      {copied ? <Check size={17} className="text-live" /> : <Copy size={17} />}
      {copied ? "주소를 복사했어요" : "설치 주소 복사 (친구에게 보내기)"}
    </button>
  );
}
