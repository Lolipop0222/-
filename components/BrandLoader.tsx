/**
 * 대품타 로딩 화면 — 사용자가 만든 로고 그림을 요소별로 나눠 움직이게 한 것 (그림: public/brand, 움직임: globals.css의 .em-* .bl-*).
 *  - StartSplash: 앱에 처음 들어갈 때 (첫 번째 그림 — 엠블럼 · 대전고 · 「일등급을 품은 타이머」 · ≡ DAEJEON HIGH SCHOOL · STUDY PLANNER)
 *  - AppLoader:   앱 안에서 불러오는 중일 때 (두 번째 그림 — 엠블럼 · 「대품타」 · ≡ 영문 줄). size="inline"은 작은 엠블럼 + 글자
 * 색은 테마를 따른다(글자색 + 금색). 소리 없음.
 */

const SUB = "Daejeon High School · Study Planner";

/** 대전고 시계 엠블럼: 시계판이 그려지고 금색 불빛이 숫자를 한 칸씩 돈다, 가운데 高 방패는 톡 튀어나와 숨 쉼 */
export function Emblem({ size, fast = false }: { size: number; fast?: boolean }) {
  return (
    <span className={`em-box ${fast ? "em-fast" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <span className="bl-mask em-ring" />
      <span className="bl-mask em-tick" />
      <span className="bl-mask em-shield" />
    </span>
  );
}

function Bars({ width, className = "" }: { width: number; className?: string }) {
  return (
    <span className={`bl-bars flex shrink-0 flex-col justify-between ${className}`} style={{ width, height: width * 0.62 }} aria-hidden>
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
      <Emblem size={176} />
      <div className="mt-9 flex w-full max-w-[330px] flex-col items-start">
        <div className="flex items-center gap-3">
          <span className="bl-kicker text-[15px] font-extrabold tracking-[0.35em]">대전고</span>
          <span className="bl-kicker-line h-[2px] w-12" />
        </div>
        <span className="bl-title mt-3 block w-full" style={{ aspectRatio: "1096 / 129" }} aria-hidden>
          <span className="bl-mask bl-title-ink" />
          <span className="bl-mask bl-title-shine" />
        </span>
        <div className="mt-4 flex items-center gap-2.5">
          <Bars width={22} />
          <span className="bl-sub text-[9px] tracking-[0.24em]">{SUB}</span>
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
      <div className="flex items-center gap-4">
        <Emblem size={96} fast />
        <div className="flex flex-col">
          <span className="bl-dpt block w-[176px]" style={{ aspectRatio: "900 / 309" }} aria-hidden>
            <span className="bl-mask" />
            <span className="bl-mask" />
            <span className="bl-mask" />
          </span>
          <div className="mt-2.5 flex items-center gap-1.5">
            <Bars width={15} className="bl-dpt-bars" />
            <span className="bl-sub bl-dpt-sub text-[8px] tracking-[0.12em]">{SUB}</span>
          </div>
        </div>
      </div>
      <p className="mt-5 text-[12px] text-faint">{label}</p>
    </div>
  );
}
