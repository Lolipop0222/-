"use client";

/**
 * 테마별 아이콘. 과목 테마(subj-*)에서는 아래 탭·홈 카드·내정보 메뉴 아이콘이 그 과목 분위기로 바뀐다.
 * 기본 테마는 DEFAULT 그대로. 새 자리를 만들면 IconSlot과 DEFAULT에 추가하고, 과목 테마에는 필요한 것만 덮어쓴다.
 */

import { createElement } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Apple,
  Atom,
  Award,
  BookA,
  BookMarked,
  BookOpen,
  BookOpenText,
  Bookmark,
  CalendarDays,
  Castle,
  ChartNoAxesColumnIncreasing,
  ChartSpline,
  ClipboardList,
  Coffee,
  Compass,
  Crown,
  Dna,
  DraftingCompass,
  Earth,
  Feather,
  Files,
  Flag,
  FlaskConical,
  Flower2,
  Glasses,
  Grid3x3,
  Handshake,
  Hourglass,
  House,
  Lamp,
  Landmark,
  Library,
  Lightbulb,
  Map,
  MapPin,
  Medal,
  MessagesSquare,
  Microscope,
  Mountain,
  Newspaper,
  NotebookPen,
  NotebookText,
  Orbit,
  Palette,
  PencilRuler,
  Pi,
  Quote,
  Rocket,
  Route,
  Ruler,
  Scale,
  ScrollText,
  Shapes,
  Shield,
  Sigma,
  Smile,
  Soup,
  Stamp,
  Swords,
  Telescope,
  TestTubes,
  Timer,
  Triangle,
  TrendingUp,
  Trophy,
  User,
  Users,
  Utensils,
  Watch,
  Wheat,
  Zap,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemeId } from "@/lib/themes";

export type IconSlot =
  // 아래 탭
  | "home"
  | "timer"
  | "words"
  | "calendar"
  | "me"
  // 홈 카드
  | "dday"
  | "planner"
  | "meal"
  | "rank"
  // 내정보 메뉴
  | "groups"
  | "theme"
  | "level"
  | "titles"
  | "avatar"
  | "prints";

const DEFAULT: Record<IconSlot, LucideIcon> = {
  home: House,
  timer: Timer,
  words: BookOpen,
  calendar: CalendarDays,
  me: User,
  dday: Flag,
  planner: ClipboardList,
  meal: Utensils,
  rank: Trophy,
  groups: Users,
  theme: Palette,
  level: ChartNoAxesColumnIncreasing,
  titles: Award,
  avatar: Smile,
  prints: Files,
};

const BY_THEME: Partial<Record<ThemeId, Partial<Record<IconSlot, LucideIcon>>>> = {
  // 국어 「한지와 먹」 — 붓·두루마리·낙관
  "subj-kor": {
    home: Feather,
    timer: Hourglass,
    words: BookOpenText,
    calendar: ScrollText,
    me: Stamp,
    dday: BookMarked,
    planner: NotebookPen,
    meal: Soup,
    rank: Medal,
    titles: Stamp,
    prints: ScrollText,
  },
  // 영어 「서재의 밤」 — 서재·회중시계·안경·신문
  "subj-eng": {
    home: Library,
    timer: Watch,
    words: BookA,
    calendar: Newspaper,
    me: Glasses,
    dday: Bookmark,
    planner: NotebookText,
    meal: Coffee,
    groups: MessagesSquare,
    theme: Lamp,
    titles: Quote,
  },
  // 수학 「청사진」 — 도형·작도·모눈
  "subj-math": {
    home: Shapes,
    words: Sigma,
    calendar: Grid3x3,
    me: DraftingCompass,
    dday: Triangle,
    planner: Ruler,
    theme: PencilRuler,
    level: ChartSpline,
    titles: Pi,
  },
  // 과학 「실험실」 — 원자·플라스크·현미경
  "subj-sci": {
    home: Atom,
    timer: FlaskConical,
    words: Dna,
    calendar: Orbit,
    me: Microscope,
    dday: Rocket,
    planner: TestTubes,
    meal: Apple,
    rank: Zap,
    theme: Lightbulb,
    level: Telescope,
  },
  // 사회 「지도첩」 — 지구·나침반·지도
  "subj-soc": {
    home: Earth,
    timer: Compass,
    words: Newspaper,
    calendar: Map,
    me: Landmark,
    dday: MapPin,
    planner: Route,
    meal: Wheat,
    rank: Scale,
    groups: Handshake,
    theme: Mountain,
    level: TrendingUp,
  },
  // 역사 「궁궐의 밤」 — 궁궐·모래시계·두루마리·왕관
  "subj-his": {
    home: Castle,
    timer: Hourglass,
    words: ScrollText,
    calendar: Landmark,
    me: Crown,
    dday: Swords,
    planner: Feather,
    meal: Soup,
    rank: Shield,
    theme: Flower2,
    titles: Crown,
  },
};

export function themeIcon(theme: ThemeId, slot: IconSlot): LucideIcon {
  return BY_THEME[theme]?.[slot] ?? DEFAULT[slot];
}

/** 지금 테마에 맞는 아이콘을 그린다. <ThemeIcon slot="dday" size={18} /> */
export function ThemeIcon({ slot, ...props }: { slot: IconSlot } & LucideProps) {
  return createElement(themeIcon(useTheme().theme, slot), props);
}
