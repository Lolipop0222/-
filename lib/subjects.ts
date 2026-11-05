/** 공부 과목 분류. 타이머에서 고르고, 과목별 공부 시간·순위를 이 기준으로 나눈다 */
export const SUBJECTS = ["국어", "영어", "수학", "과학", "사회"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_COLOR: Record<Subject, string> = {
  국어: "#ff8a7a",
  영어: "#3ddc84",
  수학: "#7c8cff",
  과학: "#4cc9f0",
  사회: "#ffb547",
};
