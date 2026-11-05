/**
 * UI 단계용 가짜 데이터.
 * 모양은 계획서 3장의 테이블 구조를 그대로 따른다 — 나중에 Supabase 조회 결과로 바꿔 끼운다.
 */

// words / reviews
export type Word = { id: string; book: string; day: number; en: string; ko: string; pos: string; box: 1 | 2 | 3 | 4 | 5 };

export const books = [
  { id: "b1", title: "능률 VOCA 고교필수", days: 30, words: 842, mastered: 318 },
  { id: "b2", title: "수능 영단어 2000", days: 40, words: 615, mastered: 96 },
];

export const reviewToday = 23;

// 상자 단계별 단어 수 (1~5)
export const boxCounts = [64, 112, 158, 207, 318];

export const BOX_INTERVAL_DAYS = [1, 3, 7, 16, 35];

export const words: Word[] = [
  { id: "w1", book: "능률 VOCA 고교필수", day: 12, en: "abandon", ko: "버리다, 포기하다", pos: "v.", box: 1 },
  { id: "w2", book: "능률 VOCA 고교필수", day: 12, en: "abundant", ko: "풍부한", pos: "adj.", box: 2 },
  { id: "w3", book: "능률 VOCA 고교필수", day: 12, en: "acquire", ko: "얻다, 습득하다", pos: "v.", box: 1 },
  { id: "w4", book: "능률 VOCA 고교필수", day: 12, en: "adequate", ko: "적절한, 충분한", pos: "adj.", box: 3 },
  { id: "w5", book: "능률 VOCA 고교필수", day: 12, en: "advocate", ko: "옹호하다; 지지자", pos: "v./n.", box: 2 },
  { id: "w6", book: "능률 VOCA 고교필수", day: 12, en: "allocate", ko: "할당하다", pos: "v.", box: 1 },
  { id: "w7", book: "능률 VOCA 고교필수", day: 12, en: "ambiguous", ko: "애매모호한", pos: "adj.", box: 2 },
  { id: "w8", book: "능률 VOCA 고교필수", day: 12, en: "anticipate", ko: "예상하다, 기대하다", pos: "v.", box: 1 },
];

// 스캔 결과 예시 (확인·수정 화면용)
export const scanResult = [
  { en: "benevolent", pos: "adj.", ko: "자비로운, 인정 많은" },
  { en: "candid", pos: "adj.", ko: "솔직한" },
  { en: "coherent", pos: "adj.", ko: "일관성 있는" },
  { en: "compel", pos: "v.", ko: "강요하다" },
  { en: "conceive", pos: "v.", ko: "상상하다, 생각해 내다" },
  { en: "consensus", pos: "n.", ko: "합의, 의견 일치" },
];
