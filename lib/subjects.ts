/**
 * 공부 과목 분류. 타이머에서 고르고, 과목별 공부 시간·순위를 이 기준으로 나눈다.
 * RANKED: 순위·공부 합계에 들어가는 6과목 (국어·영어·수학·사회·과학·역사)
 * 기타: 나만 보는 개인 타이머 (순위·합계 제외, 기록을 직접 고칠 수 있음)
 *
 * 세부 항목(detail): 과목 안의 갈래 (미적분Ⅰ, 통합과학1 …). 계열(문과/이과)마다 목록이 다르다. 순위는 과목까지만 나눈다.
 * 인강(lecture): 각 과목 기록에 붙는 표시. TIMETABLE에는 보이지만 공부 합계·순위·칭호에서는 빠진다.
 * 과목 목록을 바꾸면 supabase/parts/06-subjects.sql의 subject 제약도 같이 고친다.
 */
export const RANKED_SUBJECTS = ["국어", "영어", "수학", "사회", "과학", "역사"] as const;
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
  사회: "var(--s-soc)",
  과학: "var(--s-sci)",
  역사: "var(--s-his)",
  기타: "var(--s-etc)",
};

// ───────────────────────── 계열과 세부 항목 ─────────────────────────

export const TRACKS = ["문과", "이과"] as const;
export type Track = (typeof TRACKS)[number];
export const isTrack = (v: unknown): v is Track => v === "문과" || v === "이과";

type DetailMap = Partial<Record<Subject, readonly string[]>>;

/**
 * 학년별 세부 항목 (사용자가 정한 목록). 1·3학년은 문이과 구분 없이 같고, 2학년만 계열(문과/이과)에 따라 다르다.
 * 여기 없는 과목은 세부 항목 없이 과목만 (예: 영어). 기타의 세부 항목(한문·정보)도 순위·합계와는 상관없다.
 */
export const GRADE1_DETAILS: DetailMap = {
  국어: ["공통국어1", "공통국어2"],
  수학: ["공통수학1", "공통수학2"],
  사회: ["통합사회1", "통합사회2"],
  과학: ["통합과학1", "통합과학2"],
  역사: ["한국사1", "한국사2"],
  기타: ["한문", "정보"],
};

/** 2학년 — 계열별 (국어는 문이과 공통) */
export const SUBJECT_DETAILS: Record<Track, DetailMap> = {
  이과: {
    국어: ["독서와 작문", "문학"],
    수학: ["미적분Ⅱ", "확률과 통계", "대수", "미적분Ⅰ"],
    과학: ["물질과 에너지", "세포와 물질대사", "지구시스템 과학", "역학과 에너지", "통합과학1", "통합과학2"],
    사회: ["통합사회1", "통합사회2"],
    역사: ["한국사"],
  },
  문과: {
    국어: ["독서와 작문", "문학"],
    수학: ["확률과 통계", "경제수학", "미적분Ⅰ", "대수"],
    사회: ["윤리와 사상", "법과 사회", "정치와 법", "한국지리", "통합사회1", "통합사회2"],
    과학: ["통합과학1", "통합과학2"],
    역사: ["한국사", "세계사"],
  },
};

/** 3학년 — 문이과 공통, 사용자가 말한 것만 */
export const GRADE3_DETAILS: DetailMap = {
  국어: ["독서와 작문", "문학", "화법과 언어"],
  수학: ["미적분Ⅰ", "대수", "확률과 통계"],
  과학: ["통합과학1", "통합과학2"],
  사회: ["통합사회1", "통합사회2"],
  역사: ["한국사"],
};

/** 계열을 골라야 세부 항목이 정해지는 학년인지 (2학년만) */
export const needsTrack = (grade: number | null | undefined) => grade === 2;

/** 이 학생(학년·계열)이 이 과목에서 고를 수 있는 세부 항목 */
export function detailsFor(grade: number | null | undefined, track: Track | null | undefined, subject: Subject | null | undefined): readonly string[] {
  if (!subject) return [];
  if (grade === 1) return GRADE1_DETAILS[subject] ?? [];
  if (grade === 3) return GRADE3_DETAILS[subject] ?? [];
  if (grade === 2) {
    if (track) return SUBJECT_DETAILS[track][subject] ?? [];
    // 계열을 아직 안 골랐으면 문이과 공통인 것만
    const a = SUBJECT_DETAILS.문과[subject] ?? [];
    const b = SUBJECT_DETAILS.이과[subject] ?? [];
    return a.filter((d) => b.includes(d));
  }
  return [];
}

/** 2학년인데 계열을 안 골라서 세부 항목이 덜 나오는 과목인지 (안내 문구용) */
export function missingTrackFor(grade: number | null | undefined, track: Track | null | undefined, subject: Subject | null | undefined): boolean {
  if (!needsTrack(grade) || track || !subject) return false;
  const all = new Set([...detailsFor(2, "문과", subject), ...detailsFor(2, "이과", subject)]);
  return all.size > detailsFor(2, null, subject).length;
}

/** 인강을 붙일 수 있는 과목 (기타 빼고 전부) */
export const canLecture = (s: Subject | null | undefined) => !!s && s !== ETC;

/** "수학 · 미적분Ⅰ · 인강" */
export function subjectLabel(subject: Subject | null | undefined, detail?: string | null, lecture?: boolean | null): string {
  if (!subject) return "과목 없음";
  return [subject, detail, lecture ? "인강" : null].filter(Boolean).join(" · ");
}

/**
 * 예전 DB 값 → 지금 과목 (06-subjects.sql을 실행하기 전 DB에서 읽을 때). '한국사'→'역사', 옛 '인강' 과목→'기타'.
 * 모르는 값은 기타로.
 */
export function normalizeSubject(v: string | null | undefined): Subject | null {
  if (v == null) return null;
  if (v === "한국사") return "역사"; // 세부 항목 '한국사'는 06-subjects.sql이 옮길 때 붙인다
  return (SUBJECTS as readonly string[]).includes(v) ? (v as Subject) : ETC;
}
