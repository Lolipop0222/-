import { Bird, Bot, Cat, Cherry, Clover, Coffee, Crown, Dog, Fish, Flame, Gamepad2, Gem, Ghost, Leaf, Moon, Music, Origami, Pencil, Rabbit, Rocket, Shield, Snail, Sparkles, Squirrel, Star, Sun, Turtle, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GRADE_LABEL, isGrade, parseAvatar, type AvatarIcon, type TitleGrade } from "@/lib/titles";

/**
 * 칭호 배지와 프로필 그림. 등급마다 색·모양이 다르다 (app/globals.css의 .tb-*, .ring-*):
 * 일반 = 테두리만 / 희귀 = 파랑 / 영웅 = 보라 + 은은한 빛 / 전설 = 금색 그라데이션이 반짝임 / 히든 = 분홍·강조색 그라데이션
 */

const GRADE_ICON: Partial<Record<TitleGrade, LucideIcon>> = { rare: Gem, epic: Shield, legendary: Crown, hidden: Sparkles };

export function TitleBadge({ name, grade, size = "sm" }: { name: string; grade: string | null | undefined; size?: "xs" | "sm" | "md" }) {
  const g: TitleGrade = isGrade(grade) ? grade : "common";
  const Icon = GRADE_ICON[g];
  const cls = size === "xs" ? "tb-xs" : size === "md" ? "tb-md" : "";
  return (
    <span className={`tb tb-${g} ${cls}`} title={`${GRADE_LABEL[g]} 칭호`}>
      {Icon && <Icon className="tb-icon" aria-hidden />}
      <span className="truncate">{name}</span>
    </span>
  );
}

const ICONS: Record<AvatarIcon, LucideIcon> = {
  cat: Cat, dog: Dog, rabbit: Rabbit, bird: Bird, fish: Fish, squirrel: Squirrel, turtle: Turtle, snail: Snail,
  ghost: Ghost, bot: Bot, rocket: Rocket, flame: Flame, star: Star, moon: Moon, sun: Sun, zap: Zap,
  coffee: Coffee, pencil: Pencil, music: Music, gamepad: Gamepad2, leaf: Leaf, clover: Clover, cherry: Cherry, origami: Origami,
};

export function AvatarIconView({ icon, className }: { icon: AvatarIcon; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}

/**
 * 프로필 그림 (동그라미). 대표 칭호 등급이 있으면 그 등급의 테두리를 두른다.
 * 그림을 아직 안 골랐으면 닉네임 첫 글자.
 */
export function ProfileAvatar({
  avatar,
  nickname,
  grade,
  size = 36,
}: {
  avatar: string | null | undefined;
  nickname: string;
  grade?: string | null;
  size?: number;
}) {
  const a = parseAvatar(avatar);
  const g = isGrade(grade) ? grade : null;
  const ring = g ? Math.max(2, Math.round(size / 18)) : 0;
  const inner = size - ring * 2;
  return (
    <span className={`relative inline-grid shrink-0 place-items-center rounded-full ${g ? `ring-${g}` : ""}`} style={{ width: size, height: size }}>
      <span
        className={`grid place-items-center rounded-full ${a ? "text-on-subject" : "bg-surface-2 text-text"}`}
        style={{ width: inner, height: inner, background: a ? `var(--${a.color})` : undefined }}
      >
        {a ? (
          <AvatarIconView icon={a.icon} className="size-[56%]" />
        ) : (
          <span className="font-semibold" style={{ fontSize: Math.round(inner * 0.4) }}>
            {nickname.slice(0, 1)}
          </span>
        )}
      </span>
    </span>
  );
}
