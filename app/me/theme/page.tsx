"use client";

import { Check, MonitorSmartphone, Play } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { SubHeader } from "@/components/ui";
import { THEMES, type ThemeChoice, type ThemeInfo } from "@/lib/themes";

const DOTS = ["var(--s-kor)", "var(--s-eng)", "var(--s-math)", "var(--s-sci)", "var(--s-soc)", "var(--s-his)", "var(--s-lec)"];

/** 내정보 → 테마. 미리보기 칸마다 data-theme을 붙여 그 테마의 실제 색으로 그린다 */
export default function ThemePage() {
  const { choice, setChoice } = useTheme();

  return (
    <>
      <SubHeader title="테마" back="/me" />
      <div className="space-y-3 px-5 pt-2">
        <p className="text-[13px] text-muted">고르면 바로 바뀌어요. 테마는 이 기기에만 저장돼요.</p>

        <button
          type="button"
          onClick={() => setChoice("system")}
          aria-pressed={choice === "system"}
          className={`flex w-full items-center gap-3 rounded-2xl border bg-surface px-4 py-3.5 text-left ${choice === "system" ? "border-accent ring-1 ring-accent" : "border-line"}`}
        >
          <MonitorSmartphone size={22} className="text-accent" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">시스템 설정 따라가기</span>
            <span className="block text-[12px] text-muted">휴대폰이 다크 모드면 기본 다크, 아니면 라이트</span>
          </span>
          {choice === "system" && <Check size={20} className="text-accent" />}
        </button>

        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <ThemeCard key={t.id} t={t} selected={choice === t.id} onPick={() => setChoice(t.id as ThemeChoice)} />
          ))}
        </div>
      </div>
    </>
  );
}

function ThemeCard({ t, selected, onPick }: { t: ThemeInfo; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`${t.name} 테마`}
      className={`overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] ${selected ? "border-accent ring-2 ring-accent" : "border-line"}`}
    >
      {/* 미리보기: 이 안은 그 테마의 색 */}
      <div data-theme={t.id} className="theme-preview p-3">
        <div className="rounded-xl bg-stage p-2.5 text-center">
          <p className="num text-[20px] font-bold leading-none text-stage-text">1:24:07</p>
          <div className="mx-auto mt-2 grid size-7 place-items-center rounded-full bg-text text-bg">
            <Play size={12} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-line bg-surface p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold">오늘 공부</span>
            <span className="rounded bg-accent-soft px-1 text-[9px] font-bold text-accent">3위</span>
          </div>
          <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
            {DOTS.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted">급식 · 디데이 · 순위</p>
        </div>
        <div className="mt-2 flex h-6 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-bg">공부 시작</div>
      </div>
      <div className="flex items-start gap-1 bg-surface px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{t.name}</span>
          <span className="block text-[11px] leading-snug text-muted">{t.desc}</span>
        </span>
        {selected && <Check size={18} className="mt-0.5 shrink-0 text-accent" />}
      </div>
    </button>
  );
}
