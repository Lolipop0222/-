"use client";

/**
 * 기기·브라우저 알아보기 — 설치 안내(/install, InstallHint)용.
 * 아이폰은 APK를 못 깔아서 Safari "홈 화면에 추가"(PWA)로 앱처럼 쓴다. 카카오톡 같은 앱 안 브라우저에서는 홈 화면에 추가가 안 되니
 * 먼저 Safari(안드로이드는 Chrome)로 열게 한다.
 */

export type DeviceInfo = {
  ios: boolean;
  android: boolean;
  /** 홈 화면 앱(PWA)이나 APK 안에서 열었다 → 이미 설치됨 */
  installed: boolean;
  /** 카카오톡 안 브라우저 */
  kakao: boolean;
  /** 그 밖의 앱 안 브라우저 (인스타그램·네이버·에브리타임·라인·페이스북 등) */
  inApp: boolean;
  /** 아이폰 Safari가 아닌 브라우저 (Chrome·Firefox·Edge·웨일 — iOS 16.4부터는 이들도 공유 → 홈 화면에 추가 가능) */
  iosOtherBrowser: boolean;
};

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const capacitor = !!(window as { Capacitor?: unknown }).Capacitor;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const kakao = /KAKAOTALK/i.test(ua);
  const inApp = kakao || /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|everytimeApp|DaumApps|BAND\/|Snapchat|Twitter/i.test(ua) || (android && /; wv\)/.test(ua) && !capacitor);
  const iosOtherBrowser = ios && /CriOS|FxiOS|EdgiOS|Whale|OPiOS/.test(ua);
  return { ios, android, installed: capacitor || standalone, kakao, inApp, iosOtherBrowser };
}

/** 카카오톡 안에서 지금 주소를 기본 브라우저(아이폰 Safari·안드로이드 Chrome)로 연다 (카카오톡이 지원하는 주소) */
export function openInExternalBrowser(url = window.location.href) {
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}

// ── 안드로이드 Chrome "앱 설치" 창 (beforeinstallprompt는 페이지를 열 때 한 번만 와서, 앱 전체에서 미리 받아 둔다) ──
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
let captured = false;

export function captureInstallPrompt() {
  if (captured || typeof window === "undefined") return;
  captured = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

export const canPromptInstall = () => deferred !== null;
export function onInstallPromptChange(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

/** 설치 창을 띄운다. 설치했으면 true */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const d = deferred;
  deferred = null;
  await d.prompt();
  const { outcome } = await d.userChoice;
  listeners.forEach((f) => f());
  return outcome === "accepted";
}
