"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock, MonitorSmartphone, Play } from "lucide-react";
import { useStudy } from "@/components/StudyProvider";
import { useTheme } from "@/components/ThemeProvider";
import { InfoText, SubHeader } from "@/components/ui";
import { isAdmin } from "@/lib/account";
import { subjectLevel, useMyLevel } from "@/lib/levels";
import { SUBJECT_COLOR } from "@/lib/subjects";
import { THEMES, THEME_SUBJECT_LEVEL, type ThemeChoice, type ThemeInfo } from "@/lib/themes";

const DOTS = ["var(--s-kor)", "var(--s-eng)", "var(--s-math)", "var(--s-sci)", "var(--s-soc)", "var(--s-his)", "var(--s-lec)"];

/**
 * 내정보 → 테마. 미리보기 칸마다 data-theme을 붙여 그 테마의 실제 색·무늬로 그린다.
 * 과목 테마는 그 과목 레벨 60에 열린다 (관리자는 언제나). 잠긴 테마도 미리보기는 보인다.
 */
export default function ThemePage() {
  const { choice, setChoice } = useTheme();
  const study = useStudy();
  const { level } = useMyLevel(study.version);
  const [admin, setAdmin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [equip, setEquip] = useState<ThemeInfo | null>(null);
  const equipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    isAdmin().then((v) => alive && setAdmin(v));
    return () => {
      alive = false;
      if (equipTimer.current) clearTimeout(equipTimer.current);
    };
  }, []);

  /** 과목 테마 장착 연출 (globals.css .equip) — 약 2초 뒤 저절로, 누르면 바로 닫힌다 */
  function showEquip(t: ThemeInfo) {
    if (equipTimer.current) clearTimeout(equipTimer.current);
    setEquip(t);
    equipTimer.current = setTimeout(() => setEquip(null), 2100);
  }

  const base = THEMES.filter((t) => !t.subject);
  const subjects = THEMES.filter((t) => t.subject);
  const subjLv = (t: ThemeInfo) => {
    const s = level?.subjects.find((x) => x.subject === t.subject);
    return s ? subjectLevel(s.sec, s.cap) : 1;
  };
  const unlocked = (t: ThemeInfo) => admin || subjLv(t) >= THEME_SUBJECT_LEVEL;

  return (
    <>
      <SubHeader title="테마" back="/me" />
      <div className="space-y-3 px-5 pb-8 pt-2">
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

        <section className="pt-3">
          <h2 className="text-[16px] font-bold">과목 테마</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            과목마다 무늬와 문양이 다른 특별 테마예요. 그 <b className="text-text">과목 레벨이 {THEME_SUBJECT_LEVEL}</b>이 되면 열려요.
            {admin && " (관리자는 미리 써 볼 수 있어요)"}
          </p>
          {notice && (
            <div className="mt-2">
              <InfoText>{notice}</InfoText>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {subjects.map((t) => {
              const open = unlocked(t);
              return (
                <ThemeCard
                  key={t.id}
                  t={t}
                  selected={choice === t.id}
                  locked={!open}
                  lockText={`${t.subject} Lv.${subjLv(t)} / ${THEME_SUBJECT_LEVEL}`}
                  onPick={() => {
                    if (open) {
                      setNotice(null);
                      if (choice !== t.id) showEquip(t);
                      setChoice(t.id as ThemeChoice);
                    } else {
                      setNotice(`'${t.name}'은 ${t.subject} 레벨 ${THEME_SUBJECT_LEVEL}에 열려요. 지금 ${t.subject} 레벨은 ${subjLv(t)}이에요.`);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>

        <section className="pt-3">
          <h2 className="text-[16px] font-bold">기본 테마</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {base.map((t) => (
              <ThemeCard key={t.id} t={t} selected={choice === t.id} onPick={() => setChoice(t.id as ThemeChoice)} />
            ))}
          </div>
        </section>
      </div>

      {equip && (
        <div data-theme={equip.id} className="equip" role="status" onClick={() => setEquip(null)}>
          <div className="equip-orn" aria-hidden />
          <p className="equip-name">{equip.name}</p>
          <p className="equip-motto">{equip.motto}</p>
          <p className="equip-sub">{equip.subject} 테마를 꼈어요</p>
        </div>
      )}
    </>
  );
}

function ThemeCard({ t, selected, locked = false, lockText, onPick }: { t: ThemeInfo; selected: boolean; locked?: boolean; lockText?: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`${t.name} 테마${locked ? " (잠김)" : ""}`}
      className={`relative overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] ${selected ? "border-accent ring-2 ring-accent" : "border-line"}`}
    >
      {/* 미리보기: 이 안은 그 테마의 색·무늬 */}
      <div data-theme={t.id} className="theme-preview p-3">
        <div className="rounded-xl bg-stage p-2.5 text-center">
          <p className="num text-[20px] font-bold leading-none text-stage-text">1:24:07</p>
          <div className="mx-auto mt-2 grid size-7 place-items-center rounded-full bg-text text-bg">
            <Play size={12} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
        <div className="card mt-2 rounded-xl border border-line bg-surface p-2">
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
          <span className="flex items-center gap-1.5 text-[14px] font-semibold">
            {t.subject && <span className="size-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[t.subject] }} />}
            {t.name}
          </span>
          <span className="block text-[11px] leading-snug text-muted">{t.desc}</span>
          {locked && lockText && (
            <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-faint">
              <Lock size={11} /> {lockText}
            </span>
          )}
        </span>
        {selected && <Check size={18} className="mt-0.5 shrink-0 text-accent" />}
      </div>
    </button>
  );
}
