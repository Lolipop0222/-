"use client";

import type { ReactNode, SVGProps } from "react";
import type { ThemeId } from "@/lib/themes";

/**
 * 과목 테마의 타이머 판 (레벨 60 보상). 큰 숫자 뒤에 그 과목다운 시계를 그린다.
 *  - 바깥 진행 = 지금 이 시간(0~60분)이 얼마나 찼는지, 초 단위 움직임은 공부 중일 때만.
 *  - 다 채운 시간은 숫자 아래 HourMarks(도장·책갈피·Q.E.D.·분자·핀·엽전)로 쌓인다.
 * 색은 테마 토큰(var(--accent) 등)만 쓴다. 기본 테마에서는 SCENES에 없어서 원래 화면 그대로.
 */

/** p = 이 시간의 진행(0~1), s = 지금까지 초(계속 늘어남 — 초침이 거꾸로 돌지 않게), running = 공부 중 */
type SceneProps = { p: number; s: number; running: boolean };

const C = 150; // 가운데
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};
const f = (n: number) => n.toFixed(2);

/** 지금 시간의 진행을 원호 길이로 (pathLength = 1) */
function Arc({ r, p, ...rest }: { r: number; p: number } & SVGProps<SVGCircleElement>) {
  return <circle cx={C} cy={C} r={r} fill="none" pathLength={1} strokeDasharray={`${Math.max(0.0001, p)} 1`} transform={`rotate(-90 ${C} ${C})`} {...rest} />;
}

// 국어 「한지와 먹」 — 붓으로 그려지는 일원상. 붓끝에 먹이 맺힌다
function KorScene({ p, running }: SceneProps) {
  const [tx, ty] = polar(124, p * 360);
  return (
    <>
      <defs>
        <filter id="ts-brush" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
      </defs>
      <circle cx={C} cy={C} r={124} fill="none" stroke="var(--stage-text)" strokeOpacity={0.06} strokeWidth={16} />
      <g filter="url(#ts-brush)">
        <Arc r={124} p={p} stroke="var(--stage-text)" strokeOpacity={0.82} strokeWidth={15} strokeLinecap="round" />
        <Arc r={131} p={p * 0.96} stroke="var(--stage-text)" strokeOpacity={0.25} strokeWidth={3} strokeLinecap="round" />
      </g>
      {p > 0.002 && <circle cx={f(tx)} cy={f(ty)} r={running ? 9 : 7} fill="var(--stage-text)" className={running ? "ts-ink" : ""} />}
      {/* 낙관 */}
      <g transform="translate(212 222) rotate(-5)" opacity={0.85}>
        <rect width="30" height="30" rx="3" fill="var(--accent)" />
        <text x="15" y="21.5" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--bg)" className="ts-serif">
          品
        </text>
      </g>
    </>
  );
}

// 영어 「서재의 밤」 — 회중시계. 분침은 이 시간의 진행, 초침은 째깍
function EngScene({ p, s, running }: SceneProps) {
  const romans = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  return (
    <>
      {/* 용두 */}
      <rect x={142} y={2} width={16} height={9} rx={2.5} fill="var(--accent)" />
      <rect x={146} y={10} width={8} height={8} fill="var(--accent)" opacity={0.7} />
      <circle cx={C} cy={C} r={130} fill="none" stroke="var(--accent)" strokeWidth={3} />
      <circle cx={C} cy={C} r={123} fill="none" stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={1} />
      {Array.from({ length: 60 }, (_, i) => {
        const [x1, y1] = polar(i % 5 === 0 ? 112 : 116, i * 6);
        const [x2, y2] = polar(121, i * 6);
        return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke="var(--stage-text)" strokeOpacity={i % 5 === 0 ? 0.6 : 0.25} strokeWidth={i % 5 === 0 ? 1.6 : 1} />;
      })}
      {romans.map((t, i) => {
        const [x, y] = polar(98, i * 30);
        return (
          <text key={t} x={f(x)} y={f(y + 4.5)} textAnchor="middle" fontSize="13" fill="var(--stage-text)" fillOpacity={0.62} className="ts-serif">
            {t}
          </text>
        );
      })}
      {/* 지나간 시간은 금빛으로 */}
      <Arc r={126.5} p={p} stroke="var(--accent)" strokeOpacity={0.9} strokeWidth={4} />
      <g transform={`rotate(${f(p * 360)} ${C} ${C})`}>
        <path d={`M${C} ${C + 14}L${C - 3.2} ${C}L${C} ${C - 86}L${C + 3.2} ${C}Z`} fill="var(--accent)" />
      </g>
      <g className="ts-tick" style={{ transform: `rotate(${running ? s * 6 : 0}deg)`, transformOrigin: "150px 150px" }}>
        <line x1={C} y1={C + 18} x2={C} y2={C - 104} stroke="var(--danger)" strokeWidth={1.3} />
      </g>
      <circle cx={C} cy={C} r={5} fill="var(--accent)" />
    </>
  );
}

// 수학 「청사진」 — 극좌표 위에서 컴퍼스로 원을 작도. 각도 θ가 보인다
function MathScene({ p, s, running }: SceneProps) {
  const deg = p * 360;
  const [px, py] = polar(118, deg);
  const [lx, ly] = polar(140, deg);
  const [sx, sy] = polar(134, s * 6);
  return (
    <>
      <g fill="none" stroke="var(--stage-text)" strokeOpacity={0.14}>
        {[40, 80].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} strokeDasharray="3 5" />
        ))}
        <circle cx={C} cy={C} r={118} strokeOpacity={0.2} />
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = polar(118, i * 30);
          return <line key={i} x1={C} y1={C} x2={f(x)} y2={f(y)} strokeDasharray={i % 3 === 0 ? undefined : "2 6"} />;
        })}
      </g>
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = polar(i % 6 === 0 ? 125 : 128, i * 5);
        const [x2, y2] = polar(131, i * 5);
        return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke="var(--stage-text)" strokeOpacity={0.3} />;
      })}
      <Arc r={118} p={p} stroke="var(--accent)" strokeWidth={2.6} strokeLinecap="round" />
      {/* 반지름 · 각 */}
      <line x1={C} y1={C} x2={f(px)} y2={f(py)} stroke="var(--accent)" strokeOpacity={0.55} strokeDasharray="4 4" />
      <Arc r={22} p={p} stroke="var(--accent)" strokeWidth={1.6} />
      <circle cx={f(px)} cy={f(py)} r={4.5} fill="var(--accent)" />
      <circle cx={C} cy={C} r={3.5} fill="var(--accent)" />
      {p > 0.01 && (
        <text x={f(lx)} y={f(ly + 4)} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent)" className="num">
          {Math.floor(deg)}°
        </text>
      )}
      {running && <circle cx={f(sx)} cy={f(sy)} r={2.6} fill="var(--stage-text)" fillOpacity={0.8} />}
      <text x={18} y={22} fontSize="11" fontStyle="italic" fill="var(--stage-text)" fillOpacity={0.5}>
        θ = 2πt
      </text>
    </>
  );
}

// 과학 「실험실」 — 원자. 공부 중이면 전자가 궤도를 돈다. 바깥 고리는 반응 진행률
function SciScene({ p, running }: SceneProps) {
  const orbit = "M -124 0 A 124 42 0 1 0 124 0 A 124 42 0 1 0 -124 0";
  const pct = Math.floor(p * 100);
  return (
    <>
      <circle cx={C} cy={C} r={140} fill="none" stroke="var(--accent)" strokeOpacity={0.12} strokeWidth={3} />
      <Arc r={140} p={p} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
      {[0, 60, 120].map((a, i) => (
        <g key={a} transform={`translate(${C} ${C}) rotate(${a})`}>
          <path d={orbit} fill="none" stroke="var(--stage-text)" strokeOpacity={0.2} strokeWidth={1.4} />
          <circle r={5} fill="var(--accent)" cx={running ? 0 : [124, -62, 40][i]} cy={running ? 0 : [0, 36, -40][i]}>
            {running && <animateMotion dur={`${2.6 + i * 0.7}s`} repeatCount="indefinite" path={orbit} begin={`-${i * 0.9}s`} />}
          </circle>
        </g>
      ))}
      <circle cx={C} cy={C} r={20} fill="var(--accent)" fillOpacity={0.12} className={running ? "ts-glow" : ""} />
      <circle cx={C} cy={C} r={9} fill="var(--accent)" />
      {p > 0.01 && (
        <text x={C} y={292} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent)" className="num">
          반응 진행 {pct}%
        </text>
      )}
    </>
  );
}

// 사회 「지도첩」 — 나침반. 바늘이 이 시간의 진행 방향을 가리키고, 지나온 길은 점선 경로
function SocScene({ p, running }: SceneProps) {
  const dirs: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
  return (
    <>
      <circle cx={C} cy={C} r={136} fill="none" stroke="var(--stage-text)" strokeOpacity={0.5} strokeWidth={1.5} />
      <circle cx={C} cy={C} r={122} fill="none" stroke="var(--stage-text)" strokeOpacity={0.3} />
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = polar(i % 6 === 0 ? 124 : 128, i * 5);
        const [x2, y2] = polar(134, i * 5);
        return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke="var(--stage-text)" strokeOpacity={i % 18 === 0 ? 0.7 : 0.3} strokeWidth={i % 6 === 0 ? 1.4 : 0.8} />;
      })}
      {dirs.map(([t, a]) => {
        const [x, y] = polar(108, a);
        return (
          <text key={t} x={f(x)} y={f(y + 5)} textAnchor="middle" fontSize="14" fontWeight="800" fill={t === "N" ? "var(--danger)" : "var(--stage-text)"} fillOpacity={t === "N" ? 1 : 0.55}>
            {t}
          </text>
        );
      })}
      <circle cx={C} cy={C} r={92} fill="none" stroke="var(--accent)" strokeOpacity={0.3} strokeDasharray="3 5" />
      <Arc r={92} p={p} stroke="var(--accent)" strokeWidth={2.6} strokeLinecap="round" />
      <g transform={`rotate(${f(p * 360)} ${C} ${C})`}>
        <g className={running ? "ts-wobble" : ""} style={{ transformOrigin: "150px 150px" }}>
          <path d={`M${C} ${C - 84}L${C + 9} ${C}L${C - 9} ${C}Z`} fill="var(--danger)" />
          <path d={`M${C} ${C + 84}L${C + 9} ${C}L${C - 9} ${C}Z`} fill="var(--stage-text)" fillOpacity={0.4} />
        </g>
      </g>
      <circle cx={C} cy={C} r={6} fill="var(--stage)" stroke="var(--stage-text)" strokeWidth={2} />
    </>
  );
}

// 역사 「궁궐의 밤」 — 앙부일구(해시계)를 위에서 본 모습. 열두 지지를 따라 해 그림자가 돈다
function HisScene({ p, s, running }: SceneProps) {
  const zhi = "子丑寅卯辰巳午未申酉戌亥";
  const cur = Math.floor(p * 12) % 12;
  const [gx, gy] = polar(122, p * 360);
  const [bx, by] = polar(134, s * 6);
  return (
    <>
      <circle cx={C} cy={C} r={136} fill="none" stroke="var(--accent)" strokeWidth={2.4} />
      <circle cx={C} cy={C} r={130} fill="none" stroke="var(--accent)" strokeOpacity={0.5} />
      <g fill="none" stroke="var(--accent)" strokeOpacity={0.16}>
        {[34, 58, 82].map((r) => (
          <circle key={r} cx={C} cy={C} r={r} />
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const [x1, y1] = polar(34, i * 15);
          const [x2, y2] = polar(96, i * 15);
          return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} />;
        })}
      </g>
      {[...zhi].map((t, i) => {
        const [x, y] = polar(113, i * 30);
        return (
          <text key={t} x={f(x)} y={f(y + 5.5)} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--accent)" fillOpacity={p > 0 && i === cur ? 1 : 0.42} className="ts-serif">
            {t}
          </text>
        );
      })}
      {/* 해 그림자 */}
      <Arc r={124} p={p} stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={6} />
      <line x1={C} y1={C} x2={f(gx)} y2={f(gy)} stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" className={running ? "ts-glow" : ""} />
      <circle cx={f(gx)} cy={f(gy)} r={5} fill="var(--accent)" />
      {running && <circle cx={f(bx)} cy={f(by)} r={2.4} fill="var(--accent)" />}
      {/* 영침 */}
      <circle cx={C} cy={C} r={7} fill="var(--stage)" stroke="var(--accent)" strokeWidth={2} />
    </>
  );
}

const SCENES: Partial<Record<ThemeId, (p: SceneProps) => ReactNode>> = {
  "subj-kor": KorScene,
  "subj-eng": EngScene,
  "subj-math": MathScene,
  "subj-sci": SciScene,
  "subj-soc": SocScene,
  "subj-his": HisScene,
};

export const hasTimerScene = (theme: ThemeId) => theme in SCENES;

export default function TimerScene({ theme, sec, running }: { theme: ThemeId; sec: number; running: boolean }) {
  const Scene = SCENES[theme];
  if (!Scene) return null;
  const p = (sec % 3600) / 3600;
  return (
    <svg viewBox="0 0 300 300" className="ts-svg absolute inset-0 size-full overflow-visible" aria-hidden>
      {Scene({ p, s: sec, running })}
    </svg>
  );
}

const KOR_NUM = "一二三四五六七八九十";
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];

/** 다 채운 시간 표시 — 한 시간마다 하나씩 (모양은 globals.css .hour-mark) */
export function HourMarks({ theme, hours }: { theme: ThemeId; hours: number }) {
  if (!hasTimerScene(theme) || hours < 1) return null;
  const n = Math.min(hours, 16);
  const label = (i: number) => (theme === "subj-kor" ? KOR_NUM[i] ?? `${i + 1}` : theme === "subj-eng" ? ROMAN[i] : theme === "subj-his" || theme === "subj-soc" ? "" : `${i + 1}`);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" aria-label={`${hours}시간 채움`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="hour-mark">
          {label(i)}
        </span>
      ))}
    </div>
  );
}
