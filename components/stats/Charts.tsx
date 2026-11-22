"use client";

import { useId, type ReactNode } from "react";
import type { ChartTheme } from "@/lib/chartTheme";
import { LENGTH_BINS, WEEKDAYS, dayLabel, hShort, hmText, weekdayOf, type BySubject, type DayStat } from "@/lib/stats";
import { RANKED_SUBJECTS, SUBJECT_COLOR } from "@/lib/subjects";

/**
 * 공부 통계 그래프 (SVG, 라이브러리 없음). 색은 테마 토큰과 과목 색(var(--s-*))만 쓴다.
 * 모양(선·점·칸)은 ChartTheme을 따른다 — lib/chartTheme.ts.
 */

const W = 320;
const f = (n: number) => +n.toFixed(2);

/** 그래프 안 공통 정의: 붓 거칠기·빛 번짐 */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-brush`} x="-5%" y="-20%" width="110%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="3" />
        <feDisplacementMap in="SourceGraphic" scale="2.4" />
      </filter>
      <filter id={`${id}-glow`} x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** 테마별 점 */
export function Marker({ x, y, t, r = 3, color = "var(--accent)" }: { x: number; y: number; t: ChartTheme; r?: number; color?: string }) {
  switch (t.marker) {
    case "seal":
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={0.6} fill={color} transform={`rotate(-8 ${x} ${y})`} />;
    case "diamond":
      return <rect x={x - r * 0.8} y={y - r * 0.8} width={r * 1.6} height={r * 1.6} fill="var(--surface)" stroke={color} strokeWidth={1.4} transform={`rotate(45 ${x} ${y})`} />;
    case "cross":
      return (
        <g stroke={color} strokeWidth={1.2}>
          <path d={`M${x - r - 1.5} ${y}H${x + r + 1.5}M${x} ${y - r - 1.5}V${y + r + 1.5}`} />
          <circle cx={x} cy={y} r={r * 0.7} fill="var(--surface)" />
        </g>
      );
    case "glow":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 2} fill={color} opacity={0.2} />
          <circle cx={x} cy={y} r={r * 0.9} fill={color} />
        </g>
      );
    case "pin":
      return <circle cx={x} cy={y} r={r * 0.8} fill="var(--surface)" stroke={color} strokeWidth={1.4} />;
    case "coin":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.1} fill={color} />
          <rect x={x - r * 0.35} y={y - r * 0.35} width={r * 0.7} height={r * 0.7} fill="var(--surface)" />
        </g>
      );
    default:
      return <circle cx={x} cy={y} r={r} fill="var(--surface)" stroke={color} strokeWidth={1.6} />;
  }
}

/** 테마별 꺾은선 */
function ThemedLine({ pts, t, id, baseY }: { pts: [number, number][]; t: ChartTheme; id: string; baseY: number }) {
  if (pts.length < 2) return null;
  const d = "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L");
  switch (t.line) {
    case "brush":
      return <path d={d} fill="none" stroke="var(--text)" strokeOpacity={0.85} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${id}-brush)`} />;
    case "ink":
      return (
        <g>
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
          <path d={d} fill="none" stroke="var(--accent)" strokeOpacity={0.25} strokeWidth={5} strokeLinejoin="round" />
        </g>
      );
    case "construct":
      return (
        <g>
          {pts.map(([x, y], i) => (
            <path key={i} d={`M${f(x)} ${f(y)}V${baseY}`} stroke="var(--accent)" strokeOpacity={0.35} strokeDasharray="2 3" />
          ))}
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        </g>
      );
    case "glow":
      return <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" filter={`url(#${id}-glow)`} />;
    case "route":
      return <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0.1 5" />;
    case "gold":
      return (
        <g>
          <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinejoin="round" />
          <path d={d} fill="none" stroke="var(--accent)" strokeOpacity={0.4} strokeWidth={0.8} transform="translate(0 3.5)" />
        </g>
      );
    default:
      return <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
  }
}

/** 마지막 점에 꽂는 지도 핀 (사회 테마) */
function PinAt({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${f(x)} ${f(y - 2)})`}>
      <path d="M0 0L-4.5 -7A5 5 0 1 1 4.5 -7Z" fill="var(--danger)" />
      <circle cx="0" cy="-9.2" r="1.8" fill="var(--surface)" />
    </g>
  );
}

const niceMax = (v: number) => {
  const h = v / 3600;
  const steps = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];
  return (steps.find((s) => s >= h) ?? Math.ceil(h / 50) * 50) * 3600;
};

function YGrid({ max, top, bottom, left, right }: { max: number; top: number; bottom: number; left: number; right: number }) {
  return (
    <g>
      {[0, 0.5, 1].map((k) => {
        const y = bottom - (bottom - top) * k;
        return (
          <g key={k}>
            <path d={`M${left} ${f(y)}H${right}`} stroke="var(--line)" strokeDasharray={k ? "2 3" : undefined} />
            <text x={left - 3} y={f(y + 3)} textAnchor="end" fontSize="8" fill="var(--faint)">
              {hShort(max * k)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Svg({ h, children, label }: { h: number; children: ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="block h-auto w-full" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

// ───────────────────────── 날짜별 누적 막대 ─────────────────────────
/** 날짜별(기간이 길면 주별) 과목 누적 막대 + 평균선 */
export function DailyStack({ days, t }: { days: DayStat[]; t: ChartTheme }) {
  const id = useId().replace(/:/g, "");
  // 62일보다 길면 주 단위로 묶는다
  const weekly = days.length > 62;
  const groups: DayStat[] = weekly
    ? days.reduce<DayStat[]>((acc, d) => {
        const last = acc[acc.length - 1];
        if (last && weekdayOf(d.day) !== 0) {
          last.total += d.total;
          for (const s of RANKED_SUBJECTS) last.by[s] += d.by[s];
        } else acc.push({ day: d.day, total: d.total, by: { ...d.by } });
        return acc;
      }, [])
    : days;
  const H = 170;
  const [left, right, top, bottom] = [30, W - 6, 10, H - 22];
  const max = niceMax(Math.max(3600, ...groups.map((g) => g.total)));
  const n = groups.length;
  const slot = (right - left) / n;
  const bw = Math.max(1.2, Math.min(22, slot * 0.7));
  const avg = groups.reduce((a, g) => a + g.total, 0) / Math.max(1, n);
  const yOf = (v: number) => bottom - (v / max) * (bottom - top);
  const every = Math.max(1, Math.ceil(n / 7));
  return (
    <Svg h={H} label={weekly ? "주별 공부 시간 막대그래프" : "날짜별 공부 시간 막대그래프"}>
      <Defs id={id} />
      <YGrid max={max} top={top} bottom={bottom} left={left} right={right} />
      {groups.map((g, i) => {
        const x = left + slot * i + (slot - bw) / 2;
        let y = bottom;
        return (
          <g key={g.day}>
            {RANKED_SUBJECTS.map((s, k) => {
              const v = g.by[s];
              if (!v) return null;
              const hgt = (v / max) * (bottom - top);
              y -= hgt;
              const isTop = RANKED_SUBJECTS.slice(k + 1).every((x2) => !g.by[x2]);
              return <rect key={s} x={f(x)} y={f(y)} width={f(bw)} height={f(hgt)} rx={isTop ? Math.min(t.radius, bw / 2) : 0} fill={SUBJECT_COLOR[s]} />;
            })}
            {i % every === 0 && (
              <text x={f(x + bw / 2)} y={H - 8} textAnchor="middle" fontSize="8" fill="var(--faint)">
                {weekly ? `${dayLabel(g.day)}주` : n <= 7 ? WEEKDAYS[weekdayOf(g.day)] : dayLabel(g.day)}
              </text>
            )}
          </g>
        );
      })}
      {avg > 0 && (
        <g>
          <path d={`M${left} ${f(yOf(avg))}H${right}`} stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="4 3" />
          <text x={right} y={f(yOf(avg) - 3)} textAnchor="end" fontSize="8" fontWeight="700" fill="var(--accent)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">
            평균 {hmText(avg)}
          </text>
        </g>
      )}
    </Svg>
  );
}

// ───────────────────────── 과목 비율 도넛 ─────────────────────────
export function SubjectDonut({ by, t }: { by: BySubject; t: ChartTheme }) {
  const total = RANKED_SUBJECTS.reduce((a, s) => a + by[s], 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0" role="img" aria-label="과목별 공부 비율">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
        {total > 0 &&
          RANKED_SUBJECTS.map((s) => {
            const frac = by[s] / total;
            if (!frac) return null;
            const seg = (
              <circle
                key={s}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={SUBJECT_COLOR[s]}
                strokeWidth={t.cell === "seal" ? 20 : 18}
                strokeDasharray={`${f(Math.max(0, frac * C - (t.radius ? 1.5 : 0)))} ${f(C)}`}
                strokeDashoffset={f(-acc * C)}
                strokeLinecap={t.cell === "ink" || t.cell === "dot" ? "round" : "butt"}
                transform="rotate(-90 70 70)"
              />
            );
            acc += frac;
            return seg;
          })}
        <text x="70" y="66" textAnchor="middle" fontSize="10" fill="var(--muted)">
          합계
        </text>
        <text x="70" y="82" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)" className="num">
          {hShort(total)}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {RANKED_SUBJECTS.map((s) => (
          <li key={s} className="flex items-center gap-2 text-[12px]">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: SUBJECT_COLOR[s] }} />
            <span className="w-7 shrink-0 font-semibold">{s}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full" style={{ width: `${total ? (by[s] / total) * 100 : 0}%`, background: SUBJECT_COLOR[s] }} />
            </span>
            <span className="num w-9 shrink-0 text-right text-muted">{total ? Math.round((by[s] / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── 요일별 평균 ─────────────────────────
export function WeekdayBars({ avgs, t }: { avgs: number[]; t: ChartTheme }) {
  const H = 130;
  const [left, right, top, bottom] = [30, W - 6, 14, H - 20];
  const max = niceMax(Math.max(1800, ...avgs));
  const slot = (right - left) / 7;
  const bw = slot * 0.56;
  const best = avgs.indexOf(Math.max(...avgs));
  return (
    <Svg h={H} label="요일별 평균 공부 시간">
      <YGrid max={max} top={top} bottom={bottom} left={left} right={right} />
      {avgs.map((v, i) => {
        const x = left + slot * i + (slot - bw) / 2;
        const hgt = (v / max) * (bottom - top);
        const top2 = bottom - hgt;
        const hi = i === best && v > 0;
        return (
          <g key={i}>
            <rect x={f(x)} y={f(top2)} width={f(bw)} height={f(hgt)} rx={t.radius} fill={hi ? "var(--accent)" : "color-mix(in srgb, var(--accent) 35%, transparent)"} />
            {hi && (
              <text x={f(x + bw / 2)} y={f(top2 - 3)} textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--accent)">
                {hShort(v)}
              </text>
            )}
            <text x={f(x + bw / 2)} y={H - 6} textAnchor="middle" fontSize="9" fontWeight={hi ? 800 : 500} fill={hi ? "var(--text)" : "var(--faint)"}>
              {WEEKDAYS[i]}
            </text>
          </g>
        );
      })}
    </Svg>
  );
}

// ───────────────────────── 24시간 시계 (시간대) ─────────────────────────
export function HourClock({ hours, t, center }: { hours: number[]; t: ChartTheme; center: string }) {
  const id = useId().replace(/:/g, "");
  const max = Math.max(1, ...hours);
  const [cx, cy, r0, r1] = [110, 110, 42, 98];
  const polar = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const wedge = (h: number, v: number) => {
    const r = r0 + ((r1 - r0) * v) / max;
    const a0 = h * 15 + 1.2;
    const a1 = (h + 1) * 15 - 1.2;
    const [x0, y0] = polar(r0, a0);
    const [x1, y1] = polar(r, a0);
    const [x2, y2] = polar(r, a1);
    const [x3, y3] = polar(r0, a1);
    return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}A${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r0} ${r0} 0 0 0 ${f(x0)} ${f(y0)}Z`;
  };
  return (
    <svg viewBox="-16 -14 252 248" className="mx-auto block h-auto w-full max-w-[270px]" role="img" aria-label="시간대별 공부량 24시간 시계">
      <Defs id={id} />
      <circle cx={cx} cy={cy} r={r1} fill="none" stroke="var(--line)" strokeDasharray="2 4" />
      <circle cx={cx} cy={cy} r={r0} fill="none" stroke="var(--line)" />
      {hours.map((v, h) =>
        v > 0 ? (
          <path key={h} d={wedge(h, v)} fill="var(--accent)" fillOpacity={0.25 + (0.75 * v) / max} filter={t.line === "glow" ? `url(#${id}-glow)` : t.line === "brush" ? `url(#${id}-brush)` : undefined} />
        ) : null,
      )}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = polar(r1 + 10, h * 15);
        return (
          <text key={h} x={f(x)} y={f(y + 3)} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">
            {h}시
          </text>
        );
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fill="var(--muted)">
        주로
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--text)">
        {center.split(" ")[0]}
      </text>
    </svg>
  );
}

// ───────────────────────── 잔디 (달력 히트맵) ─────────────────────────
function Cell({ x, y, s, t, level }: { x: number; y: number; s: number; t: ChartTheme; level: number }) {
  const fill = level ? `color-mix(in srgb, var(--accent) ${[0, 28, 50, 74, 100][level]}%, var(--surface-2))` : "var(--surface-2)";
  const c = s / 2;
  switch (t.cell) {
    case "ink":
    case "dot":
      return <circle cx={f(x + c)} cy={f(y + c)} r={f(t.cell === "dot" ? c * (level ? 0.55 + level * 0.11 : 0.4) : c * 0.92)} fill={fill} />;
    case "hex": {
      const r = c * 1.05;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        return `${f(x + c + r * Math.cos(a))},${f(y + c + r * Math.sin(a))}`;
      }).join(" ");
      return <polygon points={pts} fill={fill} />;
    }
    case "coin":
      return (
        <g>
          <circle cx={f(x + c)} cy={f(y + c)} r={f(c * 0.95)} fill={fill} />
          {level > 0 && <rect x={f(x + c - s * 0.13)} y={f(y + c - s * 0.13)} width={f(s * 0.26)} height={f(s * 0.26)} fill="var(--surface)" />}
        </g>
      );
    case "seal":
      return (
        <g transform={level >= 3 ? `rotate(-6 ${f(x + c)} ${f(y + c)})` : undefined}>
          <rect x={f(x)} y={f(y)} width={f(s)} height={f(s)} rx={0.8} fill={fill} />
          {level >= 3 && <rect x={f(x + s * 0.2)} y={f(y + s * 0.2)} width={f(s * 0.6)} height={f(s * 0.6)} fill="none" stroke="var(--surface)" strokeOpacity={0.6} strokeWidth={0.7} />}
        </g>
      );
    case "square":
      return <rect x={f(x)} y={f(y)} width={f(s)} height={f(s)} fill={fill} stroke="var(--line)" strokeWidth={0.4} />;
    default:
      return <rect x={f(x)} y={f(y)} width={f(s)} height={f(s)} rx={f(s * 0.22)} fill={fill} />;
  }
}

/** 깃허브 잔디처럼: 세로 = 요일, 가로 = 주. 진하기 5단계 (공부한 날의 4분위로 나눔) */
export function Heatmap({ days, t }: { days: DayStat[]; t: ChartTheme }) {
  if (!days.length) return null;
  const first = days[0].day - weekdayOf(days[0].day);
  const weeks = Math.ceil((days[days.length - 1].day - first + 1) / 7);
  const gap = weeks > 30 ? 1 : 2;
  const left = 16;
  const s = Math.min(16, (W - left - 4 - gap * (weeks - 1)) / weeks);
  const H = 7 * (s + gap) + 16;
  const active = days.map((d) => d.total).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => active[Math.min(active.length - 1, Math.floor(p * active.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const levelOf = (v: number) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
  const months: { x: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const m = new Date((first + w * 7) * 86400000).getUTCMonth();
    if (m !== lastMonth) {
      if (w > 0 || weeks <= 6) months.push({ x: left + w * (s + gap), label: `${m + 1}월` });
      lastMonth = m;
    }
  }
  return (
    <Svg h={H} label="날짜별 공부량 잔디 그림">
      {["월", "수", "금"].map((d, i) => (
        <text key={d} x={0} y={f(12 + (i * 2) * (s + gap) + s * 0.75)} fontSize="7.5" fill="var(--faint)">
          {d}
        </text>
      ))}
      {days.map((d) => {
        const w = Math.floor((d.day - first) / 7);
        return <Cell key={d.day} x={left + w * (s + gap)} y={12 + weekdayOf(d.day) * (s + gap)} s={s} t={t} level={levelOf(d.total)} />;
      })}
      {months.map((m) => (
        <text key={m.x} x={f(m.x)} y={8} fontSize="7.5" fill="var(--faint)">
          {m.label}
        </text>
      ))}
    </Svg>
  );
}

// ───────────────────────── 주별 추세 + 4주 이동 평균 ─────────────────────────
export function WeeklyTrend({ weeks, t }: { weeks: { week: number; total: number; avg4: number | null }[]; t: ChartTheme }) {
  const id = useId().replace(/:/g, "");
  const H = 160;
  const [left, right, top, bottom] = [30, W - 8, 16, H - 20];
  const max = niceMax(Math.max(3600, ...weeks.map((w) => w.total)));
  const slot = (right - left) / weeks.length;
  const bw = slot * 0.5;
  const xc = (i: number) => left + slot * i + slot / 2;
  const yOf = (v: number) => bottom - (v / max) * (bottom - top);
  const pts = weeks.map((w, i) => (w.avg4 == null ? null : ([xc(i), yOf(w.avg4)] as [number, number]))).filter((p): p is [number, number] => !!p);
  return (
    <Svg h={H} label="주별 공부 시간과 4주 이동 평균">
      <Defs id={id} />
      <YGrid max={max} top={top} bottom={bottom} left={left} right={right} />
      {weeks.map((w, i) => (
        <g key={w.week}>
          <rect x={f(xc(i) - bw / 2)} y={f(yOf(w.total))} width={f(bw)} height={f(bottom - yOf(w.total))} rx={t.radius} fill="color-mix(in srgb, var(--accent) 30%, transparent)" />
          {(i % 2 === weeks.length % 2 || weeks.length <= 6) && (
            <text x={f(xc(i))} y={H - 6} textAnchor="middle" fontSize="7.5" fill="var(--faint)">
              {dayLabel(w.week)}
            </text>
          )}
        </g>
      ))}
      <ThemedLine pts={pts} t={t} id={id} baseY={bottom} />
      {pts.map(([x, y], i) => (i === pts.length - 1 && t.marker === "pin" ? <PinAt key={i} x={x} y={y} /> : <Marker key={i} x={x} y={y} t={t} r={2.6} />))}
    </Svg>
  );
}

// ───────────────────────── 한 번 공부 길이 분포 ─────────────────────────
export function LengthHistogram({ bins, t }: { bins: number[]; t: ChartTheme }) {
  const H = 130;
  const [left, right, top, bottom] = [8, W - 8, 14, H - 22];
  const max = Math.max(1, ...bins);
  const total = bins.reduce((a, b) => a + b, 0);
  const slot = (right - left) / bins.length;
  return (
    <Svg h={H} label="한 번에 공부한 길이 분포">
      <path d={`M${left} ${bottom}H${right}`} stroke="var(--line)" />
      {bins.map((v, i) => {
        const hgt = (v / max) * (bottom - top);
        const x = left + slot * i + 2;
        return (
          <g key={i}>
            <rect x={f(x)} y={f(bottom - hgt)} width={f(slot - 4)} height={f(hgt)} rx={t.radius} fill="var(--live)" fillOpacity={0.35 + (0.65 * v) / max} />
            {v > 0 && (
              <text x={f(x + (slot - 4) / 2)} y={f(bottom - hgt - 3)} textAnchor="middle" fontSize="8" fill="var(--muted)">
                {total ? Math.round((v / total) * 100) : 0}%
              </text>
            )}
            <text x={f(x + (slot - 4) / 2)} y={H - 8} textAnchor="middle" fontSize="7.5" fill="var(--faint)">
              {LENGTH_BINS[i].label}
            </text>
          </g>
        );
      })}
    </Svg>
  );
}

// ───────────────────────── 과목 균형 레이더 ─────────────────────────
export function BalanceRadar({ by, t }: { by: BySubject; t: ChartTheme }) {
  const id = useId().replace(/:/g, "");
  const [cx, cy, R] = [110, 104, 72];
  const max = Math.max(1, ...RANKED_SUBJECTS.map((s) => by[s]));
  const pt = (i: number, k: number) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    return [cx + R * k * Math.cos(a), cy + R * k * Math.sin(a)] as [number, number];
  };
  const poly = (k: number) => RANKED_SUBJECTS.map((_, i) => pt(i, k).map(f).join(",")).join(" ");
  const vals = RANKED_SUBJECTS.map((s) => by[s] / max);
  const shape = vals.map((v, i) => pt(i, Math.max(0.04, v)));
  return (
    <svg viewBox="-6 0 232 210" className="mx-auto block h-auto w-full max-w-[270px]" role="img" aria-label="과목 균형 레이더 그래프">
      <Defs id={id} />
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(k)} fill="none" stroke="var(--line)" strokeDasharray={k < 1 ? "2 3" : undefined} />
      ))}
      {RANKED_SUBJECTS.map((s, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.2);
        return (
          <g key={s}>
            <path d={`M${cx} ${cy}L${f(x)} ${f(y)}`} stroke="var(--line)" />
            <text x={f(lx)} y={f(ly + 3)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={SUBJECT_COLOR[s]}>
              {s}
            </text>
          </g>
        );
      })}
      <polygon
        points={shape.map((p) => p.map(f).join(",")).join(" ")}
        fill="color-mix(in srgb, var(--accent) 22%, transparent)"
        stroke={t.line === "brush" ? "var(--text)" : "var(--accent)"}
        strokeWidth={t.line === "brush" ? 2.6 : 1.8}
        strokeLinejoin="round"
        strokeDasharray={t.line === "route" ? "0.1 4.5" : undefined}
        strokeLinecap="round"
        filter={t.line === "glow" ? `url(#${id}-glow)` : t.line === "brush" ? `url(#${id}-brush)` : undefined}
      />
      {shape.map(([x, y], i) => (
        <Marker key={i} x={x} y={y} t={t} r={2.4} color={SUBJECT_COLOR[RANKED_SUBJECTS[i]]} />
      ))}
    </svg>
  );
}
