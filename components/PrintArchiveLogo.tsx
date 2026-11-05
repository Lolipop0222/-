/**
 * 프린트 아카이브 로고. 원본(검은 바탕 PNG)을 파란 부분·회색 글자 두 장의 투명 마스크로 나눠
 * (public/print-archive/logo-blue.png, logo-gray.png) 테마에 맞게 칠한다 — 파랑은 로고 색 그대로, 글자는 테마 글자색.
 * 색은 globals.css의 --pa-blue / --pa-ink.
 */
export default function PrintArchiveLogo({ width = 240, className = "" }: { width?: number; className?: string }) {
  return (
    <span role="img" aria-label="Print Archive 프린트 아카이브" className={`pa-logo ${className}`} style={{ width, height: Math.round((width * 347) / 1000) }}>
      <span className="pa-logo-gray" aria-hidden />
      <span className="pa-logo-blue" aria-hidden />
    </span>
  );
}
