"use client";

/**
 * 공부 통계 그래프의 테마별 모양 (2026-11-22). 기본 테마는 깔끔한 둥근 모양, 과목 테마는 그 과목답게:
 *  국어 「공부 일지」 붓 선·낙관 점 / 영어 「Study Ledger」 잉크 선·마름모 / 수학 「분석」 작도 보조선·십자 표시·각진 막대
 *  과학 「실험 노트」 빛나는 선·육각 칸 / 사회 「지도첩」 점선 경로·지도 핀 / 역사 「실록」 금빛 두 줄·엽전 칸
 */

import { useTheme } from "@/components/ThemeProvider";
import type { ThemeId } from "@/lib/themes";

export type ChartTheme = {
  /** 히트맵 칸 모양 */
  cell: "round" | "seal" | "ink" | "square" | "hex" | "dot" | "coin";
  /** 추세선 모양 */
  line: "plain" | "brush" | "ink" | "construct" | "glow" | "route" | "gold";
  /** 점 모양 */
  marker: "circle" | "seal" | "diamond" | "cross" | "glow" | "pin" | "coin";
  /** 막대 모서리 */
  radius: number;
  title: string;
  sub: string;
  serif: boolean;
};

const DEFAULT: ChartTheme = { cell: "round", line: "plain", marker: "circle", radius: 2, title: "공부 통계", sub: "그래프로 보는 내 공부", serif: false };

const BY_THEME: Partial<Record<ThemeId, ChartTheme>> = {
  "subj-kor": { cell: "seal", line: "brush", marker: "seal", radius: 1, title: "공부 일지", sub: "붓으로 적어 내려간 나의 공부", serif: true },
  "subj-eng": { cell: "ink", line: "ink", marker: "diamond", radius: 1.5, title: "Study Ledger", sub: "한 장씩 넘겨 보는 공부 장부", serif: true },
  "subj-math": { cell: "square", line: "construct", marker: "cross", radius: 0, title: "공부 데이터 분석", sub: "숫자로 증명하는 나의 공부", serif: false },
  "subj-sci": { cell: "hex", line: "glow", marker: "glow", radius: 2, title: "공부 실험 노트", sub: "관측 기간 동안의 측정값", serif: false },
  "subj-soc": { cell: "dot", line: "route", marker: "pin", radius: 2, title: "공부 지도첩", sub: "내 공부가 지나온 길", serif: false },
  "subj-his": { cell: "coin", line: "gold", marker: "coin", radius: 1, title: "공부 실록", sub: "날마다 적어 둔 나의 공부 역사", serif: true },
};

export const chartThemeOf = (theme: ThemeId): ChartTheme => BY_THEME[theme] ?? DEFAULT;
export function useChartTheme(): ChartTheme {
  return chartThemeOf(useTheme().theme);
}
