/**
 * 화면 테마 목록. 색 값은 app/globals.css의 [data-theme="…"]에 있다 — 여기에는 이름·설명과
 * 상태바 색(bg)·어두운 테마인지(dark)만 둔다. 테마를 더하면 두 곳을 같이 고친다.
 *
 * 팔레트 출처: Nord(nordtheme.com), Catppuccin(github.com/catppuccin/palette), Gruvbox(github.com/morhetz/gruvbox),
 * Solarized(ethanschoonover.com/solarized). 모두 공개 팔레트이고 앱 화면에 맞게 역할(배경·글자·강조)을 나눠 썼다.
 */
export type ThemeId = "dark" | "light" | "paper" | "nord" | "mocha" | "gruvbox" | "solarized" | "contrast" | "cherry-grimoire";
export type ThemeChoice = ThemeId | "system";

export type ThemeInfo = { id: ThemeId; name: string; desc: string; dark: boolean; bg: string };

export const THEMES: readonly ThemeInfo[] = [
  { id: "dark", name: "기본 다크", desc: "야자실 불빛에 눈부시지 않게", dark: true, bg: "#0b0d12" },
  { id: "light", name: "라이트", desc: "밝은 교실·낮에 또렷하게", dark: false, bg: "#f3f4f8" },
  { id: "paper", name: "종이", desc: "크림색 종이 질감에 만년필 잉크", dark: false, bg: "#f2e8d3" },
  { id: "nord", name: "노드", desc: "북극의 차가운 파랑 · Nord", dark: true, bg: "#2e3440" },
  { id: "mocha", name: "모카", desc: "부드러운 파스텔 · Catppuccin Mocha", dark: true, bg: "#181825" },
  { id: "gruvbox", name: "그루브박스", desc: "따뜻한 레트로 · Gruvbox", dark: true, bg: "#1d2021" },
  { id: "solarized", name: "솔라라이즈드", desc: "눈이 편한 저대비 · Solarized Light", dark: false, bg: "#eee8d5" },
  { id: "cherry-grimoire", name: "체리 마법서", desc: "밤 보라 바탕에 벚꽃빛 분홍", dark: true, bg: "#1d1b29" },
  { id: "contrast", name: "고대비", desc: "글자가 가장 또렷하게 (접근성)", dark: true, bg: "#000000" },
];

export const THEME_KEY = "daego-theme";

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "system" || THEMES.some((t) => t.id === v);
}

/** "시스템 설정"이면 휴대폰 설정(다크/라이트)에 따라 고른다 */
export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): ThemeId {
  if (choice === "system") return prefersLight ? "light" : "dark";
  return choice;
}

export function themeName(choice: ThemeChoice): string {
  return choice === "system" ? "시스템 설정" : (THEMES.find((t) => t.id === choice)?.name ?? "기본 다크");
}

/**
 * 첫 화면을 그리기 전에 <head>에서 실행하는 짧은 스크립트 — 저장된 테마를 바로 붙여서 다크 → 라이트로 깜빡이지 않게 한다.
 * 저장된 값은 목록에 있는 것만 받는다.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var ids=${JSON.stringify(THEMES.map((t) => t.id))};var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});var t=c==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):(ids.indexOf(c)>=0?c:"dark");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
