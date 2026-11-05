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

// 과제 이름으로 과목 짐작하기 ("미적분 문제집 2장 풀기" → 수학). 학생이 언제든 바꿀 수 있다.
const KEYWORDS: Record<Subject, string[]> = {
  국어: ["국어", "문학", "비문학", "독서", "화작", "화법", "작문", "언매", "언어와매체", "언어와 매체", "고전", "현대시", "고전시가", "소설", "문법", "수필"],
  영어: ["영어", "영단어", "단어", "워마", "워드마스터", "voca", "보카", "듣기", "독해", "영문법", "구문", "english", "eng"],
  수학: ["수학", "미적분", "미적", "확통", "확률과통계", "확률과 통계", "기하", "수1", "수2", "수학1", "수학2", "수Ⅰ", "수Ⅱ", "함수", "방정식", "적분", "미분", "수열", "삼각함수", "쎈", "블랙라벨", "개념원리", "정석", "마플", "자이스토리", "math"],
  과학: ["과학", "물리", "화학", "생명과학", "생명", "생물", "지구과학", "지학", "물1", "물2", "화1", "화2", "생1", "생2", "지1", "지2", "통과", "통합과학", "실험"],
  사회: ["사회", "한국사", "국사", "역사", "세계사", "동아시아사", "동아사", "지리", "한지", "세지", "윤리", "생윤", "윤사", "정치", "정법", "법과정치", "경제", "사문", "사회문화", "통사", "통합사회"],
};

/** 이름에서 가장 앞에 나오는 과목 키워드로 짐작. 못 찾으면 null */
export function guessSubject(text: string): Subject | null {
  const t = text.toLowerCase().replace(/\s+/g, "");
  let best: { subject: Subject; at: number; len: number } | null = null;
  for (const subject of SUBJECTS) {
    for (const k of KEYWORDS[subject]) {
      const at = t.indexOf(k.toLowerCase().replace(/\s+/g, ""));
      // 더 앞에 나오는 것, 같은 자리면 더 긴 키워드("생명과학" > "생명")
      if (at >= 0 && (!best || at < best.at || (at === best.at && k.length > best.len))) best = { subject, at, len: k.length };
    }
  }
  return best?.subject ?? null;
}
