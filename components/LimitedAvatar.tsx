"use client";

import { useId, type ReactNode } from "react";
import { limitedAvatarByCode, type SubjectKey } from "@/lib/subjectRewards";

/**
 * 한정 프로필 (과목 레벨 30·50·80 보상, avatar 'lim:<과목>-<단계>'). 단계가 오를수록 더 화려하고, 3단계는 움직인다.
 * 색은 globals.css의 .la-<과목> 변수(--la-*)로만 칠한다 — 어느 테마에서나 같은 그림. 움직임은 .la-* 애니메이션 클래스.
 */
/** id = 이 그림만의 접두어 (clipPath id가 여러 그림 사이에 겹치지 않게) */
type Art = (id: string) => ReactNode;

const C = 50;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(C + r * Math.cos(a)).toFixed(2), +(C + r * Math.sin(a)).toFixed(2)] as const;
};

// ───────── 국어: 한지·먹·낙관 ─────────
const kor1: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-paper)" />
    <ellipse cx="50" cy="80" rx="26" ry="5" fill="var(--la-wash)" />
    <ellipse cx="50" cy="80" rx="15" ry="2.6" fill="none" stroke="var(--la-ink)" strokeOpacity="0.35" />
    <path d="M50 16C61 34 70 47 70 60A20 20 0 0 1 30 60C30 47 39 34 50 16Z" fill="var(--la-ink)" />
    <ellipse cx="42" cy="57" rx="4" ry="7" fill="var(--la-paper)" opacity="0.35" transform="rotate(-18 42 57)" />
  </>
);
const kor2: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-paper)" />
    <path d="M14 70C30 52 52 46 86 40C70 52 48 62 20 76Z" fill="var(--la-ink)" opacity="0.9" />
    <path d="M18 74C34 60 54 54 80 48" stroke="var(--la-wash)" strokeWidth="1.5" fill="none" opacity="0.7" />
    <g transform="rotate(38 62 40)">
      <rect x="58" y="4" width="8" height="40" rx="3" fill="var(--la-wood)" />
      <rect x="57" y="40" width="10" height="5" rx="1.5" fill="var(--la-ink)" />
      <path d="M57 45h10c0 10-3 18-5 22-2-4-5-12-5-22Z" fill="var(--la-ink)" />
    </g>
    <rect x="69" y="69" width="18" height="18" rx="2" fill="var(--la-seal)" transform="rotate(-6 78 78)" />
    <text x="78" y="83" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--la-paper)" transform="rotate(-6 78 78)" className="la-serif">
      墨
    </text>
  </>
);
const kor3: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-paper)" />
    <circle cx="50" cy="48" r="44" fill="var(--la-wash)" opacity="0.35" className="la-breathe" />
    <circle cx="50" cy="47" r="27" fill="none" stroke="var(--la-ink)" strokeWidth="9" strokeLinecap="round" pathLength={100} className="la-enso" transform="rotate(-70 50 47)" />
    <circle cx="50" cy="47" r="31" fill="none" stroke="var(--la-ink)" strokeWidth="1.6" strokeOpacity="0.35" pathLength={100} strokeDasharray="60 40" transform="rotate(-40 50 47)" />
    <rect x="62" y="66" width="18" height="18" rx="2" fill="var(--la-seal)" transform="rotate(-6 71 75)" />
    <text x="71" y="80" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--la-paper)" transform="rotate(-6 71 75)" className="la-serif">
      品
    </text>
  </>
);

// ───────── 영어: 서재·책·깃펜 ─────────
const eng1: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-ivory)" />
    {range(6).map((i) => (
      <path key={i} d={`M0 ${20 + i * 13}H100`} stroke="var(--la-navy)" strokeOpacity="0.12" />
    ))}
    <path d="M14 0V100" stroke="var(--la-red)" strokeOpacity="0.45" />
    <path d="M50 12L68 40C70 52 62 70 50 88C38 70 30 52 32 40Z" fill="var(--la-navy)" />
    <path d="M50 46V84" stroke="var(--la-ivory)" strokeWidth="2" />
    <circle cx="50" cy="44" r="4" fill="var(--la-ivory)" />
    <path d="M42 26h16" stroke="var(--la-gold)" strokeWidth="2.5" />
  </>
);
const eng2: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-leather)" />
    <rect x="6" y="6" width="88" height="88" rx="6" fill="none" stroke="var(--la-gold)" strokeDasharray="3 3" strokeOpacity="0.7" />
    <path d="M50 30C40 24 24 22 14 25V76C24 73 40 75 50 81Z" fill="var(--la-ivory)" />
    <path d="M50 30C60 24 76 22 86 25V76C76 73 60 75 50 81Z" fill="var(--la-page)" />
    {range(5).map((i) => (
      <g key={i} stroke="var(--la-navy)" strokeOpacity="0.35" strokeWidth="1.4">
        <path d={`M20 ${36 + i * 7}C28 ${34 + i * 7} 38 ${35 + i * 7} 45 ${38 + i * 7}`} />
        <path d={`M55 ${38 + i * 7}C62 ${35 + i * 7} 72 ${34 + i * 7} 80 ${36 + i * 7}`} />
      </g>
    ))}
    <path d="M50 30V81" stroke="var(--la-navy)" strokeOpacity="0.4" />
    <path d="M62 22V56L67 51L72 56V22Z" fill="var(--la-red)" />
  </>
);
const eng3: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-navy)" />
    {[[18, 18], [80, 26], [26, 44], [86, 60], [12, 70]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1.3" fill="var(--la-gold)" className="la-twinkle" style={{ animationDelay: `${i * 0.5}s` }} />
    ))}
    <circle cx="50" cy="50" r="44" fill="none" stroke="var(--la-gold)" strokeWidth="1.5" strokeDasharray="1 4" />
    <path d="M30 70h28l-4 18H34Z" fill="var(--la-ink2)" stroke="var(--la-gold)" strokeWidth="1.5" />
    <ellipse cx="44" cy="70" rx="14" ry="3.5" fill="var(--la-ink2)" stroke="var(--la-gold)" strokeWidth="1.5" />
    <g className="la-sway">
      <path d="M46 70C52 52 62 32 80 12C78 34 68 54 50 70Z" fill="var(--la-ivory)" />
      <path d="M48 69C58 50 68 32 79 15" stroke="var(--la-navy)" strokeWidth="1" fill="none" />
      {range(5).map((i) => (
        <path key={i} d={`M${54 + i * 5} ${58 - i * 9}l-7 -2`} stroke="var(--la-navy)" strokeOpacity="0.4" strokeWidth="0.8" />
      ))}
    </g>
    <circle cx="47" cy="71" r="2" fill="var(--la-gold)" className="la-glint" />
  </>
);

// ───────── 수학: 모눈·작도·황금비 ─────────
const grid = (op: number, step = 10) =>
  range(Math.floor(100 / step) + 1).map((i) => (
    <g key={i} stroke="var(--la-line)" strokeOpacity={op}>
      <path d={`M${i * step} 0V100`} />
      <path d={`M0 ${i * step}H100`} />
    </g>
  ));
const math1: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-paper)" />
    {grid(0.25)}
    <text x="50" y="70" textAnchor="middle" fontSize="58" fontWeight="700" fill="var(--la-navy)" className="la-serif">
      π
    </text>
    <text x="78" y="88" textAnchor="middle" fontSize="9" fill="var(--la-blue)">
      3.14
    </text>
  </>
);
const math2: Art = () => {
  const pts = [0, 120, 240].map((a) => polar(30, a));
  return (
    <>
      <rect width="100" height="100" fill="var(--la-blue)" />
      {grid(0.18)}
      <circle cx="50" cy="52" r="30" fill="none" stroke="var(--la-white)" strokeWidth="2" transform="translate(0 2)" />
      <path d={`M${pts.map(([x, y]) => `${x} ${y + 4}`).join("L")}Z`} fill="none" stroke="var(--la-white)" strokeWidth="1.6" strokeDasharray="3 2" />
      <g stroke="var(--la-gold)" strokeWidth="3" strokeLinecap="round">
        <path d="M50 8L38 54" />
        <path d="M50 8L66 50" />
      </g>
      <circle cx="50" cy="8" r="4" fill="var(--la-gold)" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + 4} r="2.6" fill="var(--la-gold)" />
      ))}
    </>
  );
};
const math3: Art = () => {
  // 피보나치 정사각형(8·5·3·2·1·1)과 그 안을 지나는 황금 나선. 한 칸 = 5.5, 왼쪽 위 (14, 24)
  const u = 5.5;
  const X = (v: number) => +(14 + v * u).toFixed(2);
  const Y = (v: number) => +(24 + v * u).toFixed(2);
  const sq: [number, number, number][] = [[0, 0, 8], [8, 0, 5], [10, 5, 3], [8, 6, 2], [8, 5, 1], [9, 5, 1]];
  const arcs: [number, number, number][] = [[8, 0, 8], [13, 5, 5], [10, 8, 3], [8, 6, 2], [9, 5, 1], [10, 6, 1]];
  const d = `M${X(0)} ${Y(8)}` + arcs.map(([x, y, r]) => `A${+(r * u).toFixed(2)} ${+(r * u).toFixed(2)} 0 0 1 ${X(x)} ${Y(y)}`).join("");
  return (
    <>
      <rect width="100" height="100" fill="var(--la-navy)" />
      {grid(0.1)}
      {sq.map(([x, y, n], i) => (
        <rect key={i} x={X(x)} y={Y(y)} width={n * u} height={n * u} fill="none" stroke="var(--la-gold)" strokeOpacity="0.4" />
      ))}
      <path d={d} fill="none" stroke="var(--la-gold)" strokeWidth="3" strokeLinecap="round" pathLength={100} className="la-draw" />
      <circle cx={X(9.4)} cy={Y(5.6)} r="2" fill="var(--la-white)" className="la-glint" />
      <text x="50" y="86" textAnchor="middle" fontSize="9" fill="var(--la-gold)" fontStyle="italic">
        φ = 1.618…
      </text>
    </>
  );
};

// ───────── 과학: 플라스크·DNA·원자 ─────────
const sci1: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-light)" />
    <path d="M40 14h20M43 14v24L24 76a6 6 0 0 0 5 9h42a6 6 0 0 0 5-9L57 38V14" fill="var(--la-white)" stroke="var(--la-dark)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M33 60h34l9 16a6 6 0 0 1-5 9H29a6 6 0 0 1-5-9Z" fill="var(--la-mint)" />
    {[[42, 72, 3], [55, 66, 2.2], [50, 78, 1.8], [60, 76, 2.6]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="var(--la-white)" opacity="0.8" />
    ))}
    <circle cx="66" cy="22" r="3" fill="var(--la-mint)" opacity="0.6" />
    <circle cx="72" cy="12" r="2" fill="var(--la-mint)" opacity="0.4" />
  </>
);
const sci2: Art = () => {
  const a = range(21).map((i) => {
    const y = 8 + i * 4.2;
    return { y, x1: 50 + 20 * Math.sin(i * 0.55), x2: 50 - 20 * Math.sin(i * 0.55) };
  });
  return (
    <>
      <rect width="100" height="100" fill="var(--la-dark)" />
      {a.filter((_, i) => i % 2 === 0).map((p, i) => (
        <path key={i} d={`M${p.x1.toFixed(1)} ${p.y}H${p.x2.toFixed(1)}`} stroke="var(--la-white)" strokeOpacity="0.35" strokeWidth="2" />
      ))}
      <path d={`M${a.map((p) => `${p.x1.toFixed(1)} ${p.y}`).join("L")}`} fill="none" stroke="var(--la-mint)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${a.map((p) => `${p.x2.toFixed(1)} ${p.y}`).join("L")}`} fill="none" stroke="var(--la-cyan)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
};
const sci3: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-dark)" />
    <circle cx="50" cy="50" r="40" fill="var(--la-mint)" opacity="0.08" className="la-breathe" />
    {[0, 60, 120].map((a, i) => (
      <g key={a} transform={`rotate(${a} 50 50)`}>
        <ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="var(--la-cyan)" strokeOpacity="0.5" strokeWidth="1.6" />
        <g className="la-orbit" style={{ animationDuration: `${2.4 + i * 0.8}s`, animationDelay: `${-i * 0.7}s` }}>
          <circle cx="88" cy="50" r="4" fill="var(--la-mint)" />
        </g>
      </g>
    ))}
    <circle cx="50" cy="50" r="9" fill="var(--la-violet)" className="la-glow" />
    <circle cx="47" cy="47" r="3" fill="var(--la-white)" opacity="0.6" />
  </>
);

// ───────── 사회: 나침반·지구본·대항해 ─────────
const LAND = "M8 30c8-6 18-4 22 2s-2 12 4 16 14-2 16 6-8 14-16 12-10-10-18-8-12-4-10-12 2-20 2-24Zm48-14c10-4 22 0 26 8s-6 10-2 16 12 4 10 12-14 8-20 2-4-12-12-14-10-6-6-14 4-8 4-10Zm4 52c6-2 14 2 14 8s-8 10-14 6-6-12 0-14Z";
const soc1: Art = () => {
  const star = (r1: number, r2: number, rot: number) =>
    "M" + range(8).map((i) => polar(i % 2 ? r2 : r1, rot + i * 45).join(" ")).join("L") + "Z";
  return (
    <>
      <rect width="100" height="100" fill="var(--la-paper)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--la-ink)" strokeOpacity="0.5" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="var(--la-ink)" strokeOpacity="0.25" />
      <path d={star(30, 7, 45)} fill="var(--la-ink)" opacity="0.25" />
      <path d={star(36, 8, 0)} fill="var(--la-ink)" opacity="0.85" />
      <path d="M50 14L56 50H44Z" fill="var(--la-red)" />
      <circle cx="50" cy="50" r="3.5" fill="var(--la-paper)" stroke="var(--la-ink)" />
      <text x="50" y="11" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--la-red)">
        N
      </text>
    </>
  );
};
const soc2: Art = (id) => (
  <>
    <rect width="100" height="100" fill="var(--la-paper)" />
    <defs>
      <clipPath id={`${id}g`}>
        <circle cx="50" cy="46" r="32" />
      </clipPath>
    </defs>
    <circle cx="50" cy="46" r="32" fill="var(--la-ocean)" />
    <g clipPath={`url(#${id}g)`}>
      <path d={LAND} fill="var(--la-land)" transform="translate(16 14) scale(0.7)" />
      {[-18, 0, 18].map((d) => (
        <ellipse key={d} cx={50 + d * 0.2} cy="46" rx={Math.abs(d) + 6} ry="32" fill="none" stroke="var(--la-white)" strokeOpacity="0.3" />
      ))}
      <path d="M18 46H82M22 30H78M22 62H78" stroke="var(--la-white)" strokeOpacity="0.3" />
    </g>
    <path d="M50 10A36 36 0 0 1 50 82" fill="none" stroke="var(--la-sand)" strokeWidth="3" />
    <path d="M50 82V90M36 92h28" stroke="var(--la-ink)" strokeWidth="4" strokeLinecap="round" />
  </>
);
const soc3: Art = (id) => (
  <>
    <rect width="100" height="100" fill="var(--la-deep)" />
    <defs>
      <clipPath id={`${id}g`}>
        <circle cx="50" cy="50" r="34" />
      </clipPath>
    </defs>
    <circle cx="50" cy="50" r="40" fill="var(--la-ocean)" opacity="0.25" className="la-breathe" />
    <circle cx="50" cy="50" r="34" fill="var(--la-ocean)" />
    <g clipPath={`url(#${id}g)`}>
      <g className="la-spinland">
        <path d={LAND} fill="var(--la-land)" transform="translate(16 16) scale(0.7)" />
        <path d={LAND} fill="var(--la-land)" transform="translate(86 16) scale(0.7)" />
      </g>
      {[0, 14, 26].map((d) => (
        <ellipse key={d} cx="50" cy="50" rx={d + 4} ry="34" fill="none" stroke="var(--la-white)" strokeOpacity="0.25" />
      ))}
    </g>
    <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="var(--la-sand)" strokeWidth="1.6" strokeDasharray="3 3" transform="rotate(-20 50 50)" />
    <g transform="rotate(-20 50 50)">
      <g className="la-orbit" style={{ animationDuration: "5s" }}>
        <circle cx="94" cy="50" r="3.6" fill="var(--la-red)" />
      </g>
    </g>
  </>
);

// ───────── 역사: 엽전·수막새·일월오봉도 ─────────
const his1: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-wood)" />
    {range(5).map((i) => (
      <path key={i} d={`M0 ${10 + i * 20}H100M${10 + i * 20} 0V100`} stroke="var(--la-gold)" strokeOpacity="0.08" strokeWidth="3" />
    ))}
    <circle cx="50" cy="50" r="34" fill="var(--la-gold)" />
    <circle cx="50" cy="50" r="30" fill="none" stroke="var(--la-brass)" strokeWidth="2" />
    <rect x="41" y="41" width="18" height="18" fill="var(--la-wood)" stroke="var(--la-brass)" strokeWidth="2" />
    {[["常", 50, 33], ["平", 50, 76], ["通", 70, 55], ["寶", 30, 55]].map(([t, x, y]) => (
      <text key={t} x={x} y={y} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--la-brass)" className="la-serif">
        {t}
      </text>
    ))}
  </>
);
const his2: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-red)" />
    <circle cx="50" cy="50" r="40" fill="var(--la-tile)" />
    {range(20).map((i) => {
      const [x, y] = polar(35, i * 18);
      return <circle key={i} cx={x} cy={y} r="2" fill="var(--la-tile2)" />;
    })}
    <circle cx="50" cy="50" r="31" fill="none" stroke="var(--la-tile2)" strokeWidth="1.5" />
    {range(8).map((i) => (
      <path key={i} d="M50 50C44 40 45 27 50 21C55 27 56 40 50 50Z" fill="var(--la-tile2)" stroke="var(--la-tile3)" strokeWidth="1" transform={`rotate(${i * 45} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="7" fill="var(--la-tile3)" />
    {range(6).map((i) => {
      const [x, y] = polar(4, i * 60);
      return <circle key={i} cx={x} cy={y} r="1.2" fill="var(--la-tile2)" />;
    })}
  </>
);
const his3: Art = () => (
  <>
    <rect width="100" height="100" fill="var(--la-night)" />
    <circle cx="22" cy="24" r="9" fill="var(--la-sun)" className="la-glow" />
    <circle cx="78" cy="24" r="8" fill="var(--la-moon)" className="la-glow" style={{ animationDelay: "1.2s" }} />
    <path d="M0 76L14 52L26 64L38 36L50 58L62 30L74 60L86 46L100 72V100H0Z" fill="var(--la-peak)" />
    <path d="M38 36L44 48L50 58L44 56ZM62 30L68 44L74 60L67 52Z" fill="var(--la-peak2)" />
    <path d="M0 76L14 52L26 64L38 36L50 58L62 30L74 60L86 46L100 72" fill="none" stroke="var(--la-gold)" strokeWidth="1.2" strokeOpacity="0.8" />
    <g className="la-wave">
      {range(4).map((i) => (
        <path key={i} d={`M${-20 + i * 30} 88q7-8 15 0t15 0`} fill="none" stroke="var(--la-moon)" strokeWidth="2" strokeOpacity="0.7" />
      ))}
      {range(4).map((i) => (
        <path key={i} d={`M${-5 + i * 30} 95q7-8 15 0t15 0`} fill="none" stroke="var(--la-moon)" strokeWidth="2" strokeOpacity="0.45" />
      ))}
    </g>
    <circle cx="50" cy="50" r="48" fill="none" stroke="var(--la-gold)" strokeWidth="2" />
  </>
);

const ART: Record<SubjectKey, [Art, Art, Art]> = {
  kor: [kor1, kor2, kor3],
  eng: [eng1, eng2, eng3],
  math: [math1, math2, math3],
  sci: [sci1, sci2, sci3],
  soc: [soc1, soc2, soc3],
  his: [his1, his2, his3],
};

/** 'lim:kor-1' 같은 값이면 그림, 아니면 null */
export function LimitedAvatar({ code, size, className = "" }: { code: string; size: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const a = limitedAvatarByCode(code);
  if (!a) return null;
  const Art = ART[a.key][a.tier - 1];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`la la-${a.key} rounded-full ${className}`} role="img" aria-label={`${a.subject} ${a.name}`}>
      {Art(id)}
    </svg>
  );
}
