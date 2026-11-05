"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { THEMES, THEME_KEY, isThemeChoice, resolveTheme, type ThemeChoice, type ThemeId } from "@/lib/themes";

/**
 * 테마 상태. 고른 테마는 이 기기의 localStorage에 저장한다 (기기마다 다르게 써도 되는 설정이라 계정에 올리지 않는다).
 * <html data-theme>를 바꾸면 globals.css의 색 토큰이 통째로 바뀐다.
 */
type ThemeContext = { choice: ThemeChoice; theme: ThemeId; setChoice: (c: ThemeChoice) => void };

const Ctx = createContext<ThemeContext | null>(null);

export function useTheme(): ThemeContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("ThemeProvider 밖에서 useTheme을 썼습니다");
  return v;
}

const CHANGE_EVENT = "daego-theme-change";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(LIGHT_QUERY);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    mq.removeEventListener("change", onChange);
  };
}

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemeChoice(v) ? v : "dark";
  } catch {
    return "dark";
  }
}

const readPrefersLight = () => window.matchMedia(LIGHT_QUERY).matches;

type CapacitorWindow = Window & {
  Capacitor?: { Plugins?: { SystemBars?: { setStyle?: (o: { style: string }) => Promise<void> } } };
};

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "dark" as ThemeChoice);
  const prefersLight = useSyncExternalStore(subscribe, readPrefersLight, () => false);
  const theme = resolveTheme(choice, prefersLight);

  // 화면에 반영: html 속성, 브라우저 주소창·상태바 색, 안드로이드 앱 상태바 글자색
  useEffect(() => {
    const info = THEMES.find((t) => t.id === theme) ?? THEMES[0];
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", info.bg));
    try {
      // APK(Capacitor) 안에서만 있다. DARK = 어두운 배경용(밝은 글자)
      (window as CapacitorWindow).Capacitor?.Plugins?.SystemBars?.setStyle?.({ style: info.dark ? "DARK" : "LIGHT" })?.catch?.(() => {});
    } catch {
      // 웹 브라우저에서는 없음
    }
  }, [theme]);

  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, c);
    } catch {
      // 저장이 막힌 브라우저 — 이번 화면에만 반영
      document.documentElement.setAttribute("data-theme", resolveTheme(c, readPrefersLight()));
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return <Ctx.Provider value={{ choice, theme, setChoice }}>{children}</Ctx.Provider>;
}
