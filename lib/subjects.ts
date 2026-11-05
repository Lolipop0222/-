/**
 * 공부 과목 분류. 타이머에서 고르고, 과목별 공부 시간·순위를 이 기준으로 나눈다.
 * RANKED: 순위·공부 합계에 들어가는 과목 / 기타: 나만 보는 개인 타이머 (순위·합계 제외, 기록을 직접 고칠 수 있음)
 */
export const RANKED_SUBJECTS = ["국어", "영어", "수학", "과학", "사회", "한국사", "인강"] as const;
export const ETC = "기타" as const;
export const SUBJECTS = [...RANKED_SUBJECTS, ETC] as const;
export type RankedSubject = (typeof RANKED_SUBJECTS)[number];
export type Subject = (typeof SUBJECTS)[number];

export const isRanked = (s: Subject): s is RankedSubject => s !== ETC;

/** 과목 색 — 테마마다 다르므로 CSS 변수로 쓴다 (app/globals.css의 --s-*). style 속성에 그대로 넣으면 된다 */
export const SUBJECT_COLOR: Record<Subject, string> = {
  국어: "var(--s-kor)",
  영어: "var(--s-eng)",
  수학: "var(--s-math)",
  과학: "var(--s-sci)",
  사회: "var(--s-soc)",
  한국사: "var(--s-his)",
  인강: "var(--s-lec)",
  기타: "var(--s-etc)",
};
