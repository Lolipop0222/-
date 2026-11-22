"use client";

import { useEffect, useState } from "react";
import { Bird, Bot, Cat, Cherry, Clover, Coffee, Crown, Diamond, Dog, Earth, Eye, Fish, Flame, FlaskConical, Gamepad2, Gem, Ghost, Leaf, Moon, Music, Origami, Pencil, Quote, Rabbit, Rocket, ScrollText, Shield, Sigma, Snail, Squirrel, Stamp, Star, Sun, Turtle, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { photoPath, photoUrl } from "@/lib/photos";
import { ensureSerifFont } from "@/lib/themes";
import { LimitedAvatar } from "@/components/LimitedAvatar";
import { limitedAvatarByCode } from "@/lib/subjectRewards";
import { GRADE_LABEL, isGrade, parseAvatar, ringClass, signatureOf, type AvatarIcon, type Signature, type TitleGrade } from "@/lib/titles";

/**
 * 칭호 배지와 프로필 그림. 등급마다 색·모양이 다르다 (app/globals.css의 .tb-*, .ring-*):
 * 일반 = 테두리만 / 희귀 = 초록 / 초희귀 = 파랑 + 빛 / 영웅 = 보라 + 은은한 빛 / 신화 = 붉은 불꽃 그라데이션이 일렁임 / 전설 = 금색 그라데이션이 반짝임
 * 히든 = 밤하늘 바탕에 오로라빛 글자·테두리가 흐름 (2026-11-22 바꿈)
 * 과목 누적 1,000시간 전설(code sub1k_*)은 과목마다 따로: 국어 한지·먹·낙관 / 영어 옥스퍼드 남색·명조 이탤릭 / 수학 청사진 모눈
 * / 사회 바다→땅 지도가 흐름 / 과학 형광 거품 / 역사 주칠 바탕·단청 띠 (.tb-sig-*, .ring-sig-*)
 */

const GRADE_ICON: Partial<Record<TitleGrade, LucideIcon>> = { rare: Diamond, superrare: Gem, epic: Shield, mythic: Flame, legendary: Crown, hidden: Eye };
const SIG_ICON: Record<Signature, LucideIcon> = { kor: Stamp, eng: Quote, math: Sigma, soc: Earth, sci: FlaskConical, his: ScrollText };

export function TitleBadge({ name, grade, code, size = "sm" }: { name: string; grade: string | null | undefined; code?: string | null; size?: "xs" | "sm" | "md" }) {
  const g: TitleGrade = isGrade(grade) ? grade : "common";
  const sig = signatureOf(code);
  const Icon = sig ? SIG_ICON[sig] : GRADE_ICON[g];
  const cls = size === "xs" ? "tb-xs" : size === "md" ? "tb-md" : "";
  const serif = sig === "kor" || sig === "eng" || sig === "his";
  useEffect(() => {
    if (serif) ensureSerifFont();
  }, [serif]);
  return (
    <span className={`tb ${sig ? `tb-sig tb-sig-${sig}` : `tb-${g}`} ${cls}`} title={`${GRADE_LABEL[g]} 칭호`}>
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
 * 프로필 사진·그림 (동그라미). 대표 칭호 등급이 있으면 그 등급의 테두리를 두른다.
 * 한정 프로필('lim:kor-1') > 사진('photo:…') > 그림('cat:s-math') > 닉네임 첫 글자 순. 사진을 못 불러오면 첫 글자로.
 */
export function ProfileAvatar({
  avatar,
  nickname,
  grade,
  titleCode,
  size = 36,
}: {
  avatar: string | null | undefined;
  nickname: string;
  grade?: string | null;
  /** 대표 칭호 code — 과목 전설 칭호면 그 디자인의 테두리 */
  titleCode?: string | null;
  size?: number;
}) {
  const a = parseAvatar(avatar);
  const photo = photoPath(avatar);
  const [broken, setBroken] = useState<string | null>(null);
  const rc = ringClass(grade, titleCode);
  const ring = rc ? Math.max(2, Math.round(size / 18)) : 0;
  const inner = size - ring * 2;
  if (limitedAvatarByCode(avatar)) {
    // 한정 프로필 (과목 레벨 보상)
    return (
      <span className={`relative inline-grid shrink-0 place-items-center rounded-full ${rc}`} style={{ width: size, height: size }}>
        <LimitedAvatar code={avatar!} size={inner} />
      </span>
    );
  }
  if (photo && broken !== photo) {
    return (
      <span className={`relative inline-grid shrink-0 place-items-center rounded-full ${rc}`} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 작은 원형 사진, Supabase 공개 주소 그대로 */}
        <img
          src={photoUrl(photo)}
          alt=""
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(photo)}
          className="rounded-full bg-surface-2 object-cover"
          style={{ width: inner, height: inner }}
        />
      </span>
    );
  }
  return (
    <span className={`relative inline-grid shrink-0 place-items-center rounded-full ${rc}`} style={{ width: size, height: size }}>
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
