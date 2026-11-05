/**
 * UI 단계용 가짜 데이터.
 * 모양은 계획서 3장의 테이블 구조를 그대로 따른다 — 나중에 Supabase 조회 결과로 바꿔 끼운다.
 */

// events (홈 배너)
export const EVENT_CATEGORIES = ["학생회", "반", "입시"] as const;
export const events = [
  { id: "e1", category: "학생회", title: "11월 모의고사 대비 야자 간식 나눔", body: "11/17(화) 야자 2교시 쉬는 시간, 학생회실 앞", color: "#7c8cff" },
  { id: "e2", category: "입시", title: "2027 수시 원서접수 일정 정리", body: "대학별 접수 마감일을 한 번에 확인하세요", color: "#3ddc84" },
  { id: "e3", category: "반", title: "2-3 영어 수행평가 범위 공지", body: "Lesson 5–6 본문, 서술형 3문항", color: "#ffb547" },
] as const;

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
