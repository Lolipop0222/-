/**
 * 화면 테마 목록. 색 값은 app/globals.css의 [data-theme="…"]에 있다 — 여기에는 이름·설명과
 * 상태바 색(bg)·어두운 테마인지(dark)만 둔다. 테마를 더하면 두 곳을 같이 고친다.
 *
 * 팔레트 출처: Nord(nordtheme.com), Catppuccin(github.com/catppuccin/palette), Gruvbox(github.com/morhetz/gruvbox),
 * Solarized(ethanschoonover.com/solarized). 모두 공개 팔레트이고 앱 화면에 맞게 역할(배경·글자·강조)을 나눠 썼다.
 */
import type { RankedSubject } from "@/lib/subjects";

export type ThemeId = "dark" | "light" | "paper" | "nord" | "mocha" | "gruvbox" | "solarized" | "contrast" | "cherry-grimoire"
  | "silver-plum" | "garnet-globe" | "lunar-compass" | "mint-circuit" | "amber-archive"
  | "subj-kor" | "subj-eng" | "subj-math" | "subj-sci" | "subj-soc" | "subj-his";
export type ThemeChoice = ThemeId | "system";

/**
 * subject: 과목 테마 — 그 과목 레벨(lib/levels.ts의 subjectLevel)이 THEME_SUBJECT_LEVEL 이상이면 열린다 (관리자는 언제나).
 * serif: 제목을 명조(Noto Serif KR)로 — 그 테마를 쓸 때만 글꼴을 불러온다 (components/ThemeProvider.tsx)
 */
export type ThemeInfo = { id: ThemeId; name: string; desc: string; dark: boolean; bg: string; subject?: RankedSubject; serif?: boolean; motto?: string };

export const THEMES: readonly ThemeInfo[] = [
  { id: "dark", name: "기본 다크", desc: "야자실 불빛에 눈부시지 않게", dark: true, bg: "#0b0d12" },
  { id: "light", name: "라이트", desc: "밝은 교실·낮에 또렷하게", dark: false, bg: "#f3f4f8" },
  { id: "paper", name: "종이", desc: "크림색 종이 질감에 만년필 잉크", dark: false, bg: "#f2e8d3" },
  { id: "nord", name: "노드", desc: "북극의 차가운 파랑 · Nord", dark: true, bg: "#2e3440" },
  { id: "mocha", name: "모카", desc: "부드러운 파스텔 · Catppuccin Mocha", dark: true, bg: "#181825" },
  { id: "gruvbox", name: "그루브박스", desc: "따뜻한 레트로 · Gruvbox", dark: true, bg: "#1d2021" },
  { id: "solarized", name: "솔라라이즈드", desc: "눈이 편한 저대비 · Solarized Light", dark: false, bg: "#eee8d5" },
  { id: "cherry-grimoire", name: "체리 마법서", desc: "밤 보라 바탕에 벚꽃빛 분홍", dark: true, bg: "#1d1b29" },
  { id: "silver-plum", name: "실버 플럼", desc: "잿빛 자두색에 은은한 베이지", dark: true, bg: "#211e22" },
  { id: "garnet-globe", name: "가넷 글로브", desc: "석류석빛 보라에 장밋빛 분홍", dark: true, bg: "#211926" },
  { id: "lunar-compass", name: "달빛 나침반", desc: "깊은 남색 밤하늘에 달빛 파랑", dark: true, bg: "#191e32" },
  { id: "mint-circuit", name: "민트 서킷", desc: "짙은 청록 바탕에 민트빛", dark: true, bg: "#182427" },
  { id: "amber-archive", name: "호박빛 서고", desc: "오래된 서고의 갈색과 호박색", dark: true, bg: "#251d1a" },
  { id: "subj-kor", name: "한지와 먹", desc: "원고지 위에 먹으로 · 국어", dark: false, bg: "#f2f0eb", subject: "국어", serif: true, motto: "먹을 갈고, 붓을 들어요" },
  { id: "subj-eng", name: "서재의 밤", desc: "초록 가죽 서재와 줄 공책 · 영어", dark: true, bg: "#17211d", subject: "영어", serif: true, motto: "Turn the page — 서재의 불을 켜요" },
  { id: "subj-math", name: "청사진", desc: "모눈종이 위의 작도 · 수학", dark: true, bg: "#1a2436", subject: "수학", motto: "컴퍼스를 펴고, 증명을 시작해요" },
  { id: "subj-sci", name: "실험실", desc: "벤젠 고리와 원자 궤도 · 과학", dark: true, bg: "#121a1c", subject: "과학", motto: "가운을 입고, 실험을 시작해요" },
  { id: "subj-soc", name: "지도첩", desc: "등고선 지도와 나침반 · 사회", dark: false, bg: "#efe9dc", subject: "사회", motto: "지도를 펼치고, 세상을 읽어요" },
  { id: "subj-his", name: "궁궐의 밤", desc: "금빛 창살과 연화문 · 역사", dark: true, bg: "#1a1210", subject: "역사", serif: true, motto: "궁궐의 문이 열려요" },
  { id: "contrast", name: "고대비", desc: "글자가 가장 또렷하게 (접근성)", dark: true, bg: "#000000" },
];

export const THEME_KEY = "daego-theme";

/** 과목 테마가 열리는 그 과목의 레벨 (레벨 보상표의 60) */
export const THEME_SUBJECT_LEVEL = 90;
/** 명조 제목 글꼴 (jsdelivr — CSP style-src·font-src에 허용됨). 버전은 고정 */
export const SERIF_FONT_CSS = "https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-kr@5.2.5/700.css";
/** 명조 제목 글꼴 CSS를 한 번만 불러온다 (명조 테마, 과목 전설 칭호 문장가·네이티브·사관 배지) */
export function ensureSerifFont() {
  if (typeof document === "undefined" || document.getElementById("serif-font")) return;
  const link = document.createElement("link");
  link.id = "serif-font";
  link.rel = "stylesheet";
  link.href = SERIF_FONT_CSS;
  document.head.appendChild(link);
}

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
