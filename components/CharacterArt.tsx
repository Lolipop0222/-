/* eslint-disable @next/next/no-img-element -- 투명 그림(public/characters)을 그대로 보여 준다 */
import { Lock } from "lucide-react";
import { characterFaceImage, characterImage, type CharacterChoice } from "@/lib/characters";

/** 캐릭터 전신 그림. 상자 안에 비율 그대로 아래쪽에 맞춘다. locked면 검은 실루엣 */
export function CharacterArt({ choice, locked = false, className = "", eager = false }: { choice: CharacterChoice; locked?: boolean; className?: string; eager?: boolean }) {
  return (
    <img
      src={characterImage(choice)}
      alt=""
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`pointer-events-none h-full w-full select-none object-contain object-bottom ${locked ? "char-locked" : ""} ${className}`}
    />
  );
}

/** 얼굴 쪽만 크게 (고르기 칸용 정사각형) */
export function CharacterFace({ choice, locked = false, label }: { choice: CharacterChoice; locked?: boolean; label?: string }) {
  return (
    <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-2">
      <img
        src={characterFaceImage(choice)}
        alt={label ?? ""}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 h-full w-full select-none object-cover ${locked ? "char-locked" : ""}`}
      />
      {locked && (
        <span className="absolute inset-0 grid place-items-center">
          <Lock size={16} className="text-faint" />
        </span>
      )}
    </span>
  );
}
