/**
 * 과목 레벨 보상 (2026-11-22, 사용자 요청) — 과목마다 그 과목 레벨로 열린다. 단계가 오를수록 더 화려하게.
 *  - 과목 닉네임 테두리: 과목 레벨 20 · 60 · 80 (code `<과목>-<1|2|3>`, 모양은 globals.css .nf-<code>)
 *  - 한정 프로필: 과목 레벨 30 · 50 · 80 (avatar `lim:<과목>-<1|2|3>`, 그림은 components/LimitedAvatar.tsx)
 *  - 과목 테마: 과목 레벨 90 (lib/themes.ts THEME_SUBJECT_LEVEL)
 * 서버 검사는 08-levels.sql(name_frame_allowed, profiles_avatar_reward_guard) — 레벨 숫자를 바꾸면 둘 다 고친다.
 * 관리자는 모두 쓸 수 있다(미리 보기용).
 */

import type { RankedSubject } from "@/lib/subjects";

export const SUBJECT_KEY: Record<RankedSubject, SubjectKey> = { 국어: "kor", 영어: "eng", 수학: "math", 사회: "soc", 과학: "sci", 역사: "his" };
export type SubjectKey = "kor" | "eng" | "math" | "soc" | "sci" | "his";
export const KEY_SUBJECT: Record<SubjectKey, RankedSubject> = { kor: "국어", eng: "영어", math: "수학", soc: "사회", sci: "과학", his: "역사" };

export const FRAME_TIERS = [20, 60, 80] as const;
export const AVATAR_TIERS = [30, 50, 80] as const;

export type SubjectReward = { code: string; subject: RankedSubject; key: SubjectKey; tier: 1 | 2 | 3; level: number; name: string; desc: string };

const FRAME_NAMES: Record<SubjectKey, [string, string][]> = {
  kor: [["먹선", "한지 위에 먹으로 그은 테두리"], ["낙관", "명조 글씨에 붉은 낙관을 찍음"], ["일필휘지", "먹이 번지며 붓이 한 바퀴 돎 · 낙관"]],
  eng: [["책갈피", "상아색 종이에 붉은 리본"], ["가죽 장정", "초록 가죽에 금실 바느질"], ["채식 필사본", "첫 글자에 금빛 장식 · 금박이 흐름"]],
  math: [["모눈", "파란 모눈종이"], ["작도", "청사진 위 점선과 재단 표시"], ["무한", "빛이 테두리를 끝없이 돎 · ∞"]],
  sci: [["비커", "민트 용액과 거품"], ["분자 결합", "양 끝 원자가 결합으로 이어짐"], ["플라스마", "형광 테두리가 돌며 맥동"]],
  soc: [["경위선", "옅은 경위선 바탕"], ["지도 테두리", "흑백 축척 막대 테두리"], ["세계 일주", "바다와 땅빛이 돌고 핀이 꽂힘"]],
  his: [["창살", "나무 창살과 금빛 격자"], ["단청", "주칠 바탕에 단청 띠"], ["일월", "해와 달이 빛나는 밤하늘 · 금빛이 돎"]],
};
const AVATAR_NAMES: Record<SubjectKey, [string, string][]> = {
  kor: [["먹 한 방울", "한지에 떨어진 먹물"], ["붓과 먹", "붓이 지나간 한 획"], ["일원상", "붓으로 그려지는 원과 낙관"]],
  eng: [["펜촉", "만년필 펜촉"], ["펼친 책", "가죽 표지와 리본"], ["깃펜과 잉크", "잉크병에 담그는 깃펜"]],
  math: [["π", "모눈 위의 원주율"], ["컴퍼스", "원과 내접 삼각형 작도"], ["황금 나선", "황금비 사각형과 나선이 그려짐"]],
  sci: [["플라스크", "끓어오르는 용액"], ["이중 나선", "DNA 이중 나선"], ["원자", "전자가 궤도를 도는 원자"]],
  soc: [["나침반", "북쪽을 가리키는 나침반"], ["지구본", "경선이 그려진 지구본"], ["대항해", "도는 지구와 항로"]],
  his: [["엽전", "상평통보"], ["연꽃 수막새", "연꽃무늬 기와 끝"], ["일월오봉도", "해와 달, 다섯 봉우리"]],
};

const build = (names: Record<SubjectKey, [string, string][]>, tiers: readonly number[], prefix: string): SubjectReward[] =>
  (Object.keys(KEY_SUBJECT) as SubjectKey[]).flatMap((key) =>
    names[key].map(([name, desc], i) => ({ code: `${prefix}${key}-${i + 1}`, subject: KEY_SUBJECT[key], key, tier: (i + 1) as 1 | 2 | 3, level: tiers[i], name, desc })),
  );

/** 과목 테두리 18개 (code 'kor-1' …) */
export const SUBJECT_FRAMES: readonly SubjectReward[] = build(FRAME_NAMES, FRAME_TIERS, "");
/** 한정 프로필 18개 (code 'lim:kor-1' …) */
export const LIMITED_AVATARS: readonly SubjectReward[] = build(AVATAR_NAMES, AVATAR_TIERS, "lim:");

export const subjectFrameByCode = (code: string | null | undefined) => SUBJECT_FRAMES.find((f) => f.code === code) ?? null;
export const limitedAvatarByCode = (code: string | null | undefined) => LIMITED_AVATARS.find((a) => a.code === code) ?? null;
