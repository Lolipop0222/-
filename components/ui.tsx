import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** 탭 화면 상단 제목 */
export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div>
        {sub && <p className="mb-1 text-[13px] text-muted">{sub}</p>}
        <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
      </div>
      {right}
    </header>
  );
}

/** 하위 화면 상단 (뒤로가기) */
export function SubHeader({ title, back, right }: { title: string; back: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <Link href={back} aria-label="뒤로" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
        <ArrowLeft size={22} />
      </Link>
      <h1 className="flex-1 text-[17px] font-semibold">{title}</h1>
      {right}
    </header>
  );
}

/** flush: 안쪽 여백 없이 (목록을 꽉 채울 때) */
export function Card({ children, className = "", flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return <section className={`rounded-2xl border border-line bg-surface ${flush ? "overflow-hidden" : "p-4"} ${className}`}>{children}</section>;
}

export function SectionTitle({ children, href, action }: { children: ReactNode; href?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {href && (
        <Link href={href} className="flex items-center text-[13px] text-muted">
          {action ?? "전체"}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

type Tone = "accent" | "live" | "warn" | "danger" | "neutral";

const TONE: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  live: "bg-live-soft text-live",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-muted",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

/** 가로 탭 (전교/학년/반/그룹 같은 것) */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${
            value === item ? "bg-bg text-text shadow" : "text-muted"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({
  children,
  href,
  onClick,
  className = "",
  disabled,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const cls = `flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-bold text-bg transition active:scale-[0.98] disabled:opacity-40 ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function ListRow({
  icon,
  label,
  value,
  href,
  danger,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  href?: string;
  danger?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className={danger ? "text-danger" : "text-muted"}>{icon}</span>}
      <span className={`flex-1 text-[15px] ${danger ? "text-danger" : ""}`}>{label}</span>
      {value && <span className="text-[13px] text-muted">{value}</span>}
      {href && <ChevronRight size={18} className="text-faint" />}
    </>
  );
  const cls = "flex min-h-13 items-center gap-3 px-4 py-3 active:bg-surface-2";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button className={`${cls} w-full text-left`}>{inner}</button>
  );
}
