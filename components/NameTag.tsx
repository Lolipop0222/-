import { frameByCode } from "@/lib/levels";

/**
 * 닉네임 + 레벨 테두리 (디스코드 이름표처럼 닉네임을 감싼다). 모양은 app/globals.css의 .nf-*.
 * frame이 없으면 닉네임 글자만. 긴 닉네임은 말줄임.
 */
export function NameTag({ name, frame, className = "" }: { name: string; frame?: string | null; className?: string }) {
  const f = frameByCode(frame);
  if (!f) return <span className={`truncate ${className}`}>{name}</span>;
  return (
    <span className={`nf nf-${f.code} ${className}`} title={`${f.name} 테두리`}>
      <span className="nf-name">{name}</span>
    </span>
  );
}

/** "Lv.47" 작은 배지. 만렙은 금색 */
export function LevelBadge({ level, size = "sm" }: { level: number | null | undefined; size?: "sm" | "md" }) {
  if (!level) return null;
  return (
    <span className={`lv ${level >= 99 ? "lv-max" : level >= 50 ? "lv-high" : ""} ${size === "md" ? "lv-md" : ""}`} aria-label={`레벨 ${level}`}>
      <span className="lv-label">Lv.</span>
      {level}
    </span>
  );
}
