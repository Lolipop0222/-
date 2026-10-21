/**
 * 부위별 레이어를 겹쳐서 만드는 아바타 (배경·몸·머리·상의·소품).
 * 지금은 도형으로 그리고, 6단계에서 실제 이미지 파츠로 바꾼다.
 */
export default function Avatar({
  size = 64,
  bg = "#232a45",
  body = "#7c8cff",
  hair = "#2b1d14",
  accessory,
}: {
  size?: number;
  bg?: string;
  body?: string;
  hair?: string;
  accessory?: string;
}) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size, background: bg }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full" aria-hidden>
        {/* 상의 */}
        <path d="M10 64c2-13 11-19 22-19s20 6 22 19z" fill={body} />
        {/* 얼굴 */}
        <circle cx="32" cy="29" r="12" fill="#f6d2b8" />
        {/* 머리 */}
        <path d="M19.5 28c0-9 5.5-14 12.5-14s12.5 5 12.5 14c-3-4-7-6-12.5-6S22.5 24 19.5 28z" fill={hair} />
        <circle cx="27.5" cy="31" r="1.4" fill="#1b1b1b" />
        <circle cx="36.5" cy="31" r="1.4" fill="#1b1b1b" />
      </svg>
      {accessory && (
        <span className="absolute -right-0.5 top-0 leading-none" style={{ fontSize: size * 0.3 }}>
          {accessory}
        </span>
      )}
    </div>
  );
}
