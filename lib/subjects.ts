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

export const SUBJECT_COLOR: Record<Subject, string> = {
  국어: "#ff8a7a",
  영어: "#3ddc84",
  수학: "#7c8cff",
  과학: "#4cc9f0",
  사회: "#ffb547",
  한국사: "#c792ea",
  인강: "#f78fb3",
  기타: "#8b93a5",
};
