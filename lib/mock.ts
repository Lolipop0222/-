/**
 * UI 단계용 가짜 데이터.
 * 모양은 계획서 3장의 테이블 구조를 그대로 따른다 — 나중에 Supabase 조회 결과로 바꿔 끼운다.
 */

export const SUBJECTS = ["국어", "수학", "영어", "탐구", "기타"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_COLOR: Record<Subject, string> = {
  국어: "#ff8a7a",
  수학: "#7c8cff",
  영어: "#3ddc84",
  탐구: "#ffb547",
  기타: "#8b93a5",
};

// users
export const me = {
  nickname: "새벽공부러",
  grade: 2,
  classNo: 3,
  points: 1284,
  avatar: { bg: "#232a45", body: "#7c8cff", hair: "#2b1d14", accessory: "🎧" },
};

// 오늘 / 이번 주 공부 기록 (sessions 합계)
export const todayStudy = {
  totalSec: 3 * 3600 + 42 * 60,
  goalSec: 5 * 3600,
  bySubject: [
    { subject: "수학" as Subject, sec: 5400 },
    { subject: "영어" as Subject, sec: 4200 },
    { subject: "국어" as Subject, sec: 2400 },
    { subject: "탐구" as Subject, sec: 1320 },
  ],
};

export const weekStudy = {
  totalSec: 19 * 3600 + 8 * 60,
  // 월~일
  days: [4.2, 3.6, 5.1, 2.4, 3.7, 0, 0],
};

// ranking 뷰 결과
export type RankRow = { rank: number; nickname: string; grade: number; totalSec: number; studying?: boolean; me?: boolean };

const names = [
  "수능만점가자", "카페인중독", "오늘도화이팅", "의대가즈아", "수학괴물", "단어장정복",
  "물리러버", "야자지킴이", "독서실귀신", "고삼이다", "열품타장인", "집중모드", "탐구천재",
];

export const RANKING_SCOPES = ["전교", "학년", "반", "그룹"] as const;
export type RankingScope = (typeof RANKING_SCOPES)[number];

/** 내 순위를 가운데 두고 위아래 세 명씩 */
export function rankingAround(scope: RankingScope): { top: RankRow[]; around: RankRow[]; total: number } {
  const myRank = { 전교: 37, 학년: 14, 반: 4, 그룹: 2 }[scope];
  const total = { 전교: 612, 학년: 203, 반: 31, 그룹: 6 }[scope];
  const mySec = weekStudy.totalSec;

  const around: RankRow[] = [];
  for (let r = Math.max(1, myRank - 3); r <= Math.min(total, myRank + 3); r++) {
    const isMe = r === myRank;
    around.push({
      rank: r,
      nickname: isMe ? me.nickname : names[3 + ((r * 3) % (names.length - 3))],
      grade: isMe ? me.grade : (r % 3) + 1,
      totalSec: mySec + (myRank - r) * 9 * 60 + (r % 2) * 120,
      studying: !isMe && r % 3 === 0,
      me: isMe,
    });
  }

  const top: RankRow[] = [1, 2, 3].map((r) => ({
    rank: r,
    nickname: names[r - 1],
    grade: r === 2 ? 2 : 3,
    totalSec: [41, 38, 36][r - 1] * 3600 + r * 700,
    studying: r !== 2,
  }));

  // 위아래 세 명 안에 1등이 들어오면 상위 3명은 따로 보여주지 않는다
  return { top: around[0].rank === 1 ? [] : top, around, total };
}

// events (홈 배너)
export const EVENT_CATEGORIES = ["학생회", "반", "입시"] as const;
export const events = [
  { id: "e1", category: "학생회", title: "11월 모의고사 대비 야자 간식 나눔", body: "11/18(화) 야자 2교시 쉬는 시간, 학생회실 앞", color: "#7c8cff" },
  { id: "e2", category: "입시", title: "2027 수시 원서접수 일정 정리", body: "대학별 접수 마감일을 한 번에 확인하세요", color: "#3ddc84" },
  { id: "e3", category: "반", title: "2-3 영어 수행평가 범위 공지", body: "Lesson 5–6 본문, 서술형 3문항", color: "#ffb547" },
] as const;

// school_cache — 급식
export const todayMeal = {
  lunch: ["현미밥", "돼지고기김치찌개", "치즈떡볶이", "고구마맛탕", "깍두기", "요구르트"],
  dinner: ["카레라이스", "유부장국", "치킨너겟", "양배추샐러드", "배추김치"],
};

// assessments — 수행평가
export const assessments = [
  { id: "a1", subject: "영어" as Subject, date: "2026-10-23", title: "Lesson 5–6 서술형", target: "2-3" },
  { id: "a2", subject: "국어" as Subject, date: "2026-10-28", title: "현대시 감상문 제출", target: "2-3" },
  { id: "a3", subject: "탐구" as Subject, date: "2026-11-04", title: "화학 실험 보고서", target: "2학년" },
];

// school_cache — 학사일정
export const schoolEvents: Record<string, string[]> = {
  "2026-10-09": ["한글날"],
  "2026-10-15": ["2학기 중간고사 성적 확인"],
  "2026-10-30": ["개교기념일"],
  "2026-11-12": ["2027 수능 (휴업)"],
  "2026-11-18": ["11월 전국연합학력평가"],
};

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

export const dayList = [
  { day: 14, count: 30, due: 0, progress: 0.1 },
  { day: 13, count: 30, due: 8, progress: 0.42 },
  { day: 12, count: 30, due: 15, progress: 0.61 },
  { day: 11, count: 28, due: 0, progress: 0.88 },
  { day: 10, count: 30, due: 0, progress: 1 },
];

// groups / members
export const myGroup = {
  name: "2-3 야자 최강자",
  code: "K7Q2M9",
  members: [
    { nickname: "의대가즈아", studying: true, todaySec: 4 * 3600 + 12 * 60 },
    { nickname: "새벽공부러", studying: false, todaySec: todayStudy.totalSec, me: true },
    { nickname: "수학괴물", studying: true, todaySec: 3 * 3600 + 5 * 60 },
    { nickname: "단어장정복", studying: false, todaySec: 2 * 3600 + 40 * 60 },
    { nickname: "카페인중독", studying: true, todaySec: 1 * 3600 + 58 * 60 },
    { nickname: "오늘도화이팅", studying: false, todaySec: 47 * 60 },
  ],
};

// 스캔 결과 예시 (확인·수정 화면용)
export const scanResult = [
  { en: "benevolent", pos: "adj.", ko: "자비로운, 인정 많은" },
  { en: "candid", pos: "adj.", ko: "솔직한" },
  { en: "coherent", pos: "adj.", ko: "일관성 있는" },
  { en: "compel", pos: "v.", ko: "강요하다" },
  { en: "conceive", pos: "v.", ko: "상상하다, 생각해 내다" },
  { en: "consensus", pos: "n.", ko: "합의, 의견 일치" },
];
