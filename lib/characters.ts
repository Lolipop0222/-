/**
 * 캐릭터 (2026-11-11, 사용자가 준 그림). 과목마다 한 명, 진화 단계(스킨) 4개 × 표정 3개.
 * 그림: public/characters/<id>-<단계>-<표정>.webp (흰 바탕을 지운 투명 그림, 높이 720px)
 * 고른 것은 profiles.character_skin = "<id>:<단계>:<표정>" (08-levels.sql의 set_character()가 레벨을 확인하고 저장).
 * 단계·표정이 열리는 레벨은 08-levels.sql의 character_allowed()와 같게.
 */

import { SUBJECT_COLOR, type RankedSubject } from "@/lib/subjects";

export type CharacterId = "history" | "science" | "math" | "society";
export type Character = { id: CharacterId; subject: RankedSubject; desc: string };

/** 갈색 머리 = 역사, 노란 머리 = 과학, 파란 머리 = 수학, 빨간 머리 = 사회 (국어·영어는 그림이 오면 추가) */
export const CHARACTERS: readonly Character[] = [
  { id: "history", subject: "역사", desc: "책과 부엉이의 기록자" },
  { id: "science", subject: "과학", desc: "태블릿을 든 연구원" },
  { id: "math", subject: "수학", desc: "컴퍼스를 든 기하학자" },
  { id: "society", subject: "사회", desc: "체스판 위의 전략가" },
];

/** 스킨(진화 단계)이 열리는 레벨. 1단계는 처음부터 */
export const STAGE_LEVELS = [1, 40, 70, 99] as const;
export const STAGE_NAMES = ["1단계", "2단계", "3단계", "최종 진화"] as const;
/** 기본 표정(1번)이 아닌 표정을 고를 수 있는 레벨 */
export const FACE_LEVEL = 10;
export const FACE_COUNT = 3;

export type CharacterChoice = { id: CharacterId; stage: number; face: number };

export const characterById = (id: string | null | undefined) => CHARACTERS.find((c) => c.id === id) ?? null;
export const characterColor = (id: CharacterId) => SUBJECT_COLOR[characterById(id)!.subject];
export const characterImage = (c: CharacterChoice) => `/characters/${c.id}-${c.stage}-${c.face}.webp`;
/** 얼굴 쪽만 자른 정사각형 (고르기 칸용, 192px) */
export const characterFaceImage = (c: CharacterChoice) => `/characters/${c.id}-${c.stage}-${c.face}-face.webp`;

export function parseCharacter(v: string | null | undefined): CharacterChoice | null {
  const m = /^(history|science|math|society):([1-4]):([1-3])$/.exec(v ?? "");
  return m ? { id: m[1] as CharacterId, stage: Number(m[2]), face: Number(m[3]) } : null;
}
export const formatCharacter = (c: CharacterChoice) => `${c.id}:${c.stage}:${c.face}`;

export const stageUnlocked = (stage: number, level: number) => level >= (STAGE_LEVELS[stage - 1] ?? Infinity);
export const faceUnlocked = (face: number, level: number) => face === 1 || level >= FACE_LEVEL;
export const choiceAllowed = (c: CharacterChoice, level: number) => stageUnlocked(c.stage, level) && faceUnlocked(c.face, level);

/** 지금 레벨로 고를 수 있는 가장 높은 단계 */
export const maxStage = (level: number) => STAGE_LEVELS.filter((l) => level >= l).length;
