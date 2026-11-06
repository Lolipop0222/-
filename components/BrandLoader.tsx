/**
 * 대품타 로딩 화면 — 사용자가 만든 로고 그림을 요소별로 나눠 움직이게 한 것 (그림: public/brand, 움직임: globals.css의 .em-* .bl-*).
 *  - StartSplash: 앱에 처음 들어갈 때 (첫 번째 그림 — 엠블럼 · 대전고 · 「일등급을 품은 타이머」 · ≡ DAEJEON HIGH SCHOOL · STUDY PLANNER)
 *  - AppLoader:   앱 안에서 불러오는 중일 때 (두 번째 그림 — 엠블럼 · 「대품타」 · ≡ 영문 줄). size="inline"은 작은 엠블럼 + 글자
 * 색은 테마를 따른다(글자색 + 금색). 소리 없음.
 */

const SUB = "Daejeon High School · Study Planner";

/** 대전고 시계 엠블럼: 시계판이 그려지고 금색 불빛이 숫자를 한 칸씩 돈다, 가운데 高 방패는 톡 튀어나와 숨 쉼 */
export function Emblem({ size, fast = false }: { size: number | string; fast?: boolean }) {
  return (
    <span className={`em-box ${fast ? "em-fast" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <span className="bl-mask em-ring" />
      <span className="bl-mask em-tick" />
      <span className="bl-mask em-shield" />
    </span>
  );
}

function Bars({ width, className = "" }: { width: number | string; className?: string }) {
  return (
    <span className={`bl-bars flex shrink-0 flex-col justify-between ${className}`} style={{ width, aspectRatio: "1 / 0.62" }} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

/** 앱 첫 화면 (첫 번째 그림). 휴대폰 세로 화면에 맞게 엠블럼 아래로 글자를 쌓는다 */
export function StartSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6" role="status" aria-label="대품타 — 일등급을 품은 타이머, 불러오는 중">
      {/* 폭 330px 기준으로 그린 뒤, 화면이 좁으면 글자·그림이 같은 비율로 줄어든다 (cqw = 이 틀 폭의 1%) */}
      <div className="@container w-full max-w-[330px]">
        <div className="flex flex-col items-center">
          <Emblem size="53cqw" />
        </div>
        <div className="mt-[11cqw] flex flex-col items-start">
          <div className="flex items-center gap-[3.6cqw]">
            <span className="bl-kicker text-[4.5cqw] font-extrabold tracking-[0.35em]">대전고</span>
            <span className="bl-kicker-line h-[2px] w-[14.5cqw]" />
          </div>
          <span className="bl-title mt-[3.6cqw] block w-full" style={{ aspectRatio: "1096 / 129" }} aria-hidden>
            <span className="bl-mask bl-title-ink" />
            <span className="bl-mask bl-title-shine" />
          </span>
          <div className="mt-[4.8cqw] flex w-full items-center gap-[3cqw]">
            <Bars width="6.6cqw" />
            <span className="bl-sub text-[2.62cqw] tracking-[0.24em]">{SUB}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 앱 안 로딩 (두 번째 그림).
 *  - size="page": 화면·카드 한가운데 (엠블럼 + 대품타 + 영문 줄)
 *  - size="inline": 작은 목록용 (작은 엠블럼 + "불러오는 중…")
 */
export function AppLoader({ size = "page", label = "불러오는 중…" }: { size?: "page" | "inline"; label?: string }) {
  if (size === "inline") {
    return (
      <span className="flex items-center gap-2 py-1 text-[13px] text-faint" role="status">
        <Emblem size={24} fast />
        {label}
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-12" role="status" aria-label={`대품타 — ${label}`}>
      {/* 폭 340px 기준, 좁은 화면에서는 같은 비율로 줄어든다 (cqw = 이 틀 폭의 1%) */}
      <div className="@container w-full max-w-[340px] px-1">
        <div className="flex items-center gap-[4.7cqw]">
          <Emblem size="28cqw" fast />
          <div className="flex min-w-0 flex-col">
            <span className="bl-dpt block w-[52cqw]" style={{ aspectRatio: "900 / 309" }} aria-hidden>
              <span className="bl-mask" />
              <span className="bl-mask" />
              <span className="bl-mask" />
            </span>
            <div className="mt-[3cqw] flex items-center gap-[1.8cqw]">
              <Bars width="4.4cqw" className="bl-dpt-bars" />
              <span className="bl-sub bl-dpt-sub text-[2.3cqw] tracking-[0.1em]">{SUB}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-5 text-[12px] text-faint">{label}</p>
    </div>
  );
}
