"use client";

/**
 * 테마별 아이콘. 과목 테마(subj-*)에서는 아래 탭·홈 카드·내정보 메뉴·화면 안 기능 아이콘(워마 암기 카드·퀴즈, 레벨 보상, 타이머 이탈,
 * 루틴, 학교 시험, 캘린더 일정·급식, 순위의 스터디그룹 등)이 그 과목 분위기로 바뀐다. 닫기·지우기·더하기·화살표 같은 조작 아이콘은 그대로 둔다.
 * 기본 테마는 DEFAULT 그대로. 새 자리를 만들면 IconSlot과 DEFAULT에 추가하고, 과목 테마에는 필요한 것만 덮어쓴다.
 */

import { createElement } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Activity,
  Apple,
  Atom,
  Award,
  Binoculars,
  BookA,
  BookCopy,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  BookOpenText,
  Bookmark,
  Brush,
  Calculator,
  CalendarDays,
  CalendarSync,
  Castle,
  ChartColumnBig,
  ChartNoAxesColumnIncreasing,
  ChartScatter,
  ChartSpline,
  ClipboardList,
  Coffee,
  Compass,
  Crosshair,
  Crown,
  Dna,
  DraftingCompass,
  Earth,
  Eye,
  Feather,
  Files,
  Flag,
  FlaskConical,
  FlaskRound,
  Flower,
  Flower2,
  Gem,
  Gift,
  Glasses,
  GraduationCap,
  Grid2x2,
  Grid3x3,
  Handshake,
  Hexagon,
  Hourglass,
  House,
  Infinity,
  Key,
  KeyRound,
  Lamp,
  LibraryBig,
  MapPinned,
  Landmark,
  Layers,
  Library,
  Lightbulb,
  Mail,
  MailOpen,
  Mailbox,
  Map,
  MapPin,
  Medal,
  MessageCircleQuestion,
  MessagesSquare,
  Microscope,
  Mountain,
  Newspaper,
  NotebookPen,
  NotebookTabs,
  NotebookText,
  Orbit,
  Palette,
  PencilRuler,
  Pi,
  Quote,
  Recycle,
  Repeat,
  Repeat2,
  Rocket,
  Route,
  Ruler,
  Scale,
  ScanEye,
  School,
  ScrollText,
  Shapes,
  Shield,
  Sigma,
  Signpost,
  Smile,
  Soup,
  Sparkle,
  Sparkles,
  Stamp,
  Sunrise,
  Swords,
  Telescope,
  TestTubes,
  Timer,
  TrendingUp,
  Triangle,
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
  | "prints"
  | "track"
  | "inquiry"
  | "security"
  | "privacy"
  // 화면 안 (워마·타이머·플래너·디데이·레벨)
  | "cards"
  | "quiz"
  | "reward"
  | "away"
  | "routine"
  | "exam"
  | "stats";

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
  track: GraduationCap,
  inquiry: MessageCircleQuestion,
  security: KeyRound,
  privacy: Shield,
  cards: Layers,
  quiz: BookOpenCheck,
  reward: Gift,
  away: Eye,
  routine: Repeat,
  exam: School,
  stats: ChartColumnBig,
};

const BY_THEME: Partial<Record<ThemeId, Partial<Record<IconSlot, LucideIcon>>>> = {
  // 국어 「한지와 먹」 — 붓·두루마리·낙관
  "subj-kor": {
    stats: NotebookPen,
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
    cards: BookCopy,
    quiz: Brush,
    reward: Flower,
    inquiry: MailOpen,
  },
  // 영어 「서재의 밤」 — 서재·회중시계·안경·신문
  "subj-eng": {
    stats: BookMarked,
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
    cards: NotebookTabs,
    quiz: Feather,
    reward: MailOpen,
    inquiry: Mail,
    security: Key,
    routine: CalendarSync,
  },
  // 수학 「청사진」 — 도형·작도·모눈
  "subj-math": {
    stats: ChartScatter,
    home: Shapes,
    words: Sigma,
    calendar: Grid3x3,
    me: DraftingCompass,
    dday: Triangle,
    planner: Ruler,
    theme: PencilRuler,
    level: ChartSpline,
    titles: Pi,
    cards: Grid2x2,
    quiz: Calculator,
    reward: Sparkles,
    away: Crosshair,
    routine: Infinity,
  },
  // 과학 「실험실」 — 원자·플라스크·현미경
  "subj-sci": {
    stats: Activity,
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
    cards: Hexagon,
    quiz: FlaskRound,
    reward: Sparkle,
    away: ScanEye,
    routine: Recycle,
  },
  // 사회 「지도첩」 — 지구·나침반·지도
  "subj-soc": {
    stats: MapPinned,
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
    quiz: Signpost,
    reward: Flag,
    away: Binoculars,
    inquiry: Mailbox,
    routine: Repeat2,
  },
  // 역사 「궁궐의 밤」 — 궁궐·모래시계·두루마리·왕관
  "subj-his": {
    stats: LibraryBig,
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
    cards: ScrollText,
    quiz: Medal,
    reward: Gem,
    security: Key,
    routine: Sunrise,
  },
};

export function themeIcon(theme: ThemeId, slot: IconSlot): LucideIcon {
  return BY_THEME[theme]?.[slot] ?? DEFAULT[slot];
}

/** 지금 테마에 맞는 아이콘을 그린다. <ThemeIcon slot="dday" size={18} /> */
export function ThemeIcon({ slot, ...props }: { slot: IconSlot } & LucideProps) {
  return createElement(themeIcon(useTheme().theme, slot), props);
}
