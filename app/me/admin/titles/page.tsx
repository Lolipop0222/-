"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, EyeOff, Gift, Plus, Search, Trash2, UserMinus, X } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { TitleBadge } from "@/components/TitleBadge";
import { Badge, ErrorText, InfoText, InputRow, PrimaryButton, Segmented, SubHeader, inputCls } from "@/components/ui";
import { isAdmin, notReady } from "@/lib/account";
import {
  MANUAL,
  METRICS,
  UNIT_SUFFIX,
  adminDeleteTitle,
  adminFindUsers,
  adminGrantTitle,
  adminListTitles,
  adminRevokeTitle,
  adminSaveTitle,
  adminTitleHolders,
  goalForDisplay,
  metricById,
  type AdminTitle,
  type FoundUser,
  type Holder,
  type TitleDraft,
} from "@/lib/adminTitles";
import { GRADES, type TitleGrade } from "@/lib/titles";
import { koreanError } from "@/lib/supabase";

/**
 * 관리자 → 칭호 관리: 칭호 고치기·새로 만들기·숨기기·지우기, 닉네임으로 주기·회수하기.
 * DB 함수(09-admin-titles.sql)가 관리자인지 확인한다.
 */
export default function AdminTitlesPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [titles, setTitles] = useState<AdminTitle[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    try {
      setTitles(await adminListTitles());
      setError(null);
    } catch (e) {
      if (notReady(e)) setReady(false);
      else setError(koreanError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    isAdmin().then((v) => {
      if (!alive) return;
      setAdmin(v);
      if (v) void reload();
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [open]);

  const categories = useMemo(() => [...new Set((titles ?? []).map((t) => t.category))], [titles]);
  const shown = useMemo(() => {
    const t = q.trim();
    return (titles ?? []).filter((x) => !t || x.name.includes(t) || x.category.includes(t) || x.description.includes(t));
  }, [titles, q]);

  if (admin === false) {
    return (
      <>
        <SubHeader title="칭호 관리" back="/me/admin" />
        <p className="pt-10 text-center text-[14px] text-muted">관리자만 쓸 수 있는 화면이에요.</p>
      </>
    );
  }
  if (!ready) {
    return (
      <>
        <SubHeader title="칭호 관리" back="/me/admin" />
        <p className="px-5 pt-10 text-center text-[14px] leading-relaxed text-muted">
          데이터베이스 업데이트가 필요해요.
          <br />
          SQL Editor에서 04-titles.sql → 09-admin-titles.sql 순서로 실행해 주세요.
        </p>
      </>
    );
  }
  if (admin === null || !titles) {
    return (
      <>
        <SubHeader title="칭호 관리" back="/me/admin" />
        {error ? <ErrorText>{error}</ErrorText> : <AppLoader label="칭호 불러오는 중…" />}
      </>
    );
  }

  if (open) {
    const t = open === "new" ? null : (titles.find((x) => x.code === open) ?? null);
    return (
      <TitleEditor
        key={open}
        title={t}
        categories={categories}
        onBack={() => setOpen(null)}
        onSaved={async (code) => {
          await reload();
          setOpen(code);
        }}
        onDeleted={async () => {
          await reload();
          setOpen(null);
        }}
        onChanged={reload}
      />
    );
  }

  // 분류별로 묶기 (정렬 순서 유지)
  const groups: { category: string; items: AdminTitle[] }[] = [];
  for (const t of shown) {
    const g = groups.find((x) => x.category === t.category);
    if (g) g.items.push(t);
    else groups.push({ category: t.category, items: [t] });
  }

  return (
    <>
      <SubHeader
        title="칭호 관리"
        back="/me/admin"
        right={
          <button type="button" onClick={() => setOpen("new")} className="mr-2 flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-bg">
            <Plus size={15} /> 새 칭호
          </button>
        }
      />
      <div className="space-y-4 px-5 pb-10 pt-2">
        <p className="text-[12px] leading-relaxed text-muted">
          칭호를 눌러 이름·등급·조건을 고치거나, 닉네임으로 직접 주고 회수할 수 있어요. 고친 내용은 학생들에게 바로 반영돼요.
        </p>
        <InputRow icon={<Search size={18} />}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="칭호 이름·분류 찾기" aria-label="칭호 찾기" className={inputCls} />
        </InputRow>
        {error && <ErrorText>{error}</ErrorText>}
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="mb-1.5 px-1 text-[12px] font-semibold text-faint">{g.category}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {g.items.map((t) => (
                <li key={t.code}>
                  <button type="button" onClick={() => setOpen(t.code)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className={`flex min-w-0 items-center gap-1.5 ${t.active ? "" : "opacity-50"}`}>
                        <TitleBadge name={t.name} grade={t.grade} size="sm" />
                        {!t.active && <EyeOff size={13} className="shrink-0 text-faint" aria-label="숨김" />}
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-muted">{t.metric === MANUAL ? "관리자가 직접 주는 칭호" : t.description}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num text-[12px] font-semibold text-muted">{t.holders}명</span>
                      {t.custom && <Badge tone="accent">직접 만듦</Badge>}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="py-8 text-center text-[13px] text-faint">찾는 칭호가 없어요.</p>}
      </div>
    </>
  );
}

// ───────────────────────── 칭호 고치기 / 만들기 ─────────────────────────

const HOW = ["직접 주기", "자동으로"] as const;

function TitleEditor({
  title,
  categories,
  onBack,
  onSaved,
  onDeleted,
  onChanged,
}: {
  title: AdminTitle | null;
  categories: string[];
  onBack: () => void;
  onSaved: (code: string) => Promise<void>;
  onDeleted: () => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const isNew = !title;
  const [name, setName] = useState(title?.name ?? "");
  const [grade, setGrade] = useState<TitleGrade>(title?.grade ?? "rare");
  const [category, setCategory] = useState(title?.category ?? "이벤트");
  const [description, setDescription] = useState(title?.description ?? "");
  const [how, setHow] = useState<(typeof HOW)[number]>(!title || title.metric === MANUAL ? "직접 주기" : "자동으로");
  const [metric, setMetric] = useState(title && title.metric !== MANUAL ? title.metric : "total_sec");
  const [goal, setGoal] = useState(title && title.metric !== MANUAL ? String(goalForDisplay(title)) : "10");
  const [active, setActive] = useState(title?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const m = metricById(metric);
  const unit = how === "직접 주기" ? "flag" : (m?.unit ?? "flag");

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const draft: TitleDraft = {
        code: title?.code ?? null,
        name,
        grade,
        category,
        description: description.trim() || (how === "직접 주기" ? "관리자가 주는 칭호" : `${m?.label ?? ""} ${goal}${UNIT_SUFFIX[unit]}`.trim()),
        metric: how === "직접 주기" ? MANUAL : metric,
        goal: unit === "flag" ? null : Number(goal),
        active,
      };
      const code = await adminSaveTitle(draft);
      setNotice(isNew ? "새 칭호를 만들었어요. 아래에서 학생에게 줄 수 있어요." : "저장했어요.");
      await onSaved(code);
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!title || !window.confirm(`'${title.name}' 칭호를 지울까요? 가진 학생 ${title.holders}명에게서도 사라져요. 되돌릴 수 없어요.`)) return;
    setBusy(true);
    try {
      await adminDeleteTitle(title.code);
      await onDeleted();
    } catch (e) {
      setError(koreanError(e));
      setBusy(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <button type="button" onClick={onBack} aria-label="목록으로" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-[17px] font-semibold">{isNew ? "새 칭호" : "칭호 고치기"}</h1>
      </header>
      <div className="space-y-5 px-5 pb-12 pt-2">
        {/* 미리보기 */}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-5">
          <TitleBadge name={name.trim() || "칭호 이름"} grade={grade} size="md" />
          <p className="px-4 text-center text-[12px] text-muted">{description.trim() || "설명"}</p>
          {!active && <Badge>숨김 — 학생에게 안 보여요</Badge>}
        </div>

        <Field label="이름" hint={`${name.trim().length}/20`}>
          <InputRow icon={null}>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="예: 야자 지박령" aria-label="칭호 이름" className={inputCls} />
          </InputRow>
        </Field>

        <Field label="등급">
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={grade === g.id}
                onClick={() => setGrade(g.id)}
                className={`rounded-xl border-2 px-2 py-1.5 ${grade === g.id ? "border-accent" : "border-transparent bg-surface"}`}
              >
                <TitleBadge name={g.label} grade={g.id} size="sm" />
              </button>
            ))}
          </div>
          {grade === "hidden" && <p className="mt-1.5 text-[12px] text-faint">히든은 얻기 전까지 학생에게 이름·설명이 ???로 보여요.</p>}
        </Field>

        <Field label="분류" hint="칭호 목록에서 묶이는 이름">
          <InputRow icon={null}>
            <input value={category} onChange={(e) => setCategory(e.target.value.slice(0, 12))} placeholder="예: 이벤트" aria-label="분류" className={inputCls} />
          </InputRow>
          <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] ${c === category ? "border-accent text-accent" : "border-line text-muted"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="설명" hint={`${description.trim().length}/100`}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 100))}
            rows={2}
            placeholder="학생에게 보이는 설명 (예: 11월 야자 개근 이벤트 참가자)"
            aria-label="설명"
            className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none placeholder:text-faint focus:border-accent"
          />
        </Field>

        <Field label="얻는 방법">
          <Segmented items={HOW} value={how} onChange={setHow} />
          {how === "직접 주기" ? (
            <p className="mt-2 text-[12px] text-faint">자동으로는 안 생기고, 아래 &lsquo;칭호 주기&rsquo;로 준 학생만 가져요.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                aria-label="조건"
                className="h-12 w-full rounded-2xl border border-line bg-surface px-3 text-[14px] outline-none focus:border-accent"
              >
                {METRICS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              {unit !== "flag" ? (
                <InputRow icon={null}>
                  <input
                    inputMode="decimal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value.replace(/[^\d.]/g, "").slice(0, 7))}
                    aria-label="목표"
                    className={inputCls}
                  />
                  <span className="shrink-0 pr-1 text-[14px] text-muted">{UNIT_SUFFIX[unit]} 이상</span>
                </InputRow>
              ) : (
                <p className="text-[12px] text-faint">이 조건을 한 번이라도 채우면 얻어요.</p>
              )}
              <p className="text-[12px] text-faint">학생이 앱을 열거나 공부를 마칠 때 서버가 판정해서 자동으로 줘요. 지난 기록도 소급돼요.</p>
            </div>
          )}
        </Field>

        <label className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span>
            <span className="block text-[14px] font-semibold">학생에게 보이기</span>
            <span className="text-[12px] text-muted">끄면 목록에서 숨기고 새로 얻지도 않아요 (이미 얻은 기록은 남음)</span>
          </span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-accent" />
        </label>

        {error && <ErrorText>{error}</ErrorText>}
        {notice && <InfoText>{notice}</InfoText>}
        <PrimaryButton onClick={save} disabled={busy || !name.trim() || !category.trim() || (unit !== "flag" && !(Number(goal) > 0))}>
          {busy ? "저장 중…" : isNew ? "칭호 만들기" : "저장"}
        </PrimaryButton>

        {title && (
          <>
            <GiveCard code={title.code} onChanged={onChanged} />
            <Holders code={title.code} auto={title.metric !== MANUAL} onChanged={onChanged} />
            {title.custom ? (
              <button type="button" onClick={remove} disabled={busy} className="mx-auto flex items-center gap-1.5 text-[13px] text-danger">
                <Trash2 size={15} /> 이 칭호 지우기
              </button>
            ) : (
              <p className="text-center text-[12px] text-faint">기본 칭호는 지울 수 없어요. 필요 없으면 &lsquo;학생에게 보이기&rsquo;를 끄세요.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="text-[13px] font-semibold">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ───────────────────────── 주기 · 가진 학생 ─────────────────────────

const GRANT_MSG: Record<string, string> = {
  ok: "칭호를 줬어요. 그 학생이 다음에 앱을 열면 알림이 떠요.",
  no_user: "그 닉네임의 학생이 없어요.",
  no_title: "없는 칭호예요.",
  already: "이미 가진 학생이에요.",
};

function GiveCard({ code, onChanged }: { code: string; onChanged: () => Promise<void> }) {
  const [nick, setNick] = useState("");
  const [found, setFound] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 닉네임 자동 완성 (입력이 멈추면 찾기)
  useEffect(() => {
    const t = nick.trim();
    if (!t) return;
    let alive = true;
    const id = setTimeout(() => {
      adminFindUsers(t).then(
        (r) => alive && setFound(r),
        () => alive && setFound([]),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [nick]);

  async function give(name = nick) {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminGrantTitle(name, code);
      setMsg({ ok: r === "ok", text: GRANT_MSG[r] ?? r });
      if (r === "ok") {
        setNick("");
        setFound([]);
        await onChanged();
        window.dispatchEvent(new Event("daego-holders-changed"));
      }
    } catch (e) {
      setMsg({ ok: false, text: koreanError(e) });
    } finally {
      setBusy(false);
    }
  }

  const suggestions = nick.trim() ? found.filter((f) => f.nickname !== nick.trim()) : [];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
        <Gift size={17} className="text-accent" /> 칭호 주기
      </h2>
      <div className="mt-3 flex gap-2">
        <div className="min-w-0 flex-1">
          <InputRow icon={null}>
            <input
              value={nick}
              onChange={(e) => {
                setNick(e.target.value);
                setMsg(null);
                if (!e.target.value.trim()) setFound([]);
              }}
              onKeyDown={(e) => e.key === "Enter" && give()}
              placeholder="닉네임"
              aria-label="줄 학생 닉네임"
              className={inputCls}
            />
            {nick && (
              <button type="button" aria-label="지우기" onClick={() => (setNick(""), setFound([]))} className="grid size-8 shrink-0 place-items-center text-faint">
                <X size={16} />
              </button>
            )}
          </InputRow>
        </div>
        <button type="button" onClick={() => give()} disabled={busy || !nick.trim()} className="shrink-0 rounded-2xl bg-accent px-4 text-[14px] font-bold text-bg disabled:opacity-40">
          {busy ? "…" : "주기"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((f) => (
            <li key={f.nickname}>
              <button type="button" onClick={() => setNick(f.nickname)} className="rounded-full border border-line px-2.5 py-1 text-[12px]">
                {f.nickname} <span className="text-faint">{f.grade}-{f.class_no}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={`mt-2 text-[12px] ${msg.ok ? "text-live" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}

function Holders({ code, auto, onChanged }: { code: string; auto: boolean; onChanged: () => Promise<void> }) {
  const [list, setList] = useState<Holder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("daego-holders-changed", on);
    return () => window.removeEventListener("daego-holders-changed", on);
  }, []);

  useEffect(() => {
    let alive = true;
    adminTitleHolders(code).then(
      (r) => alive && setList(r),
      (e) => alive && setError(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [code, tick]);

  async function revoke(h: Holder) {
    if (!window.confirm(`${h.nickname} 님에게서 이 칭호를 회수할까요?${auto ? "\n자동 칭호라도 다시 생기지 않아요 (다시 주기는 가능)." : ""}`)) return;
    try {
      await adminRevokeTitle(h.nickname, code);
      setTick((t) => t + 1);
      await onChanged();
    } catch (e) {
      setError(koreanError(e));
    }
  }

  return (
    <section>
      <h2 className="mb-2 px-1 text-[15px] font-semibold">가진 학생 {list ? `${list.length}명` : ""}</h2>
      {error && <ErrorText>{error}</ErrorText>}
      {!list && !error && <AppLoader size="inline" />}
      {list && list.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[13px] text-faint">아직 가진 학생이 없어요.</p>}
      {list && list.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((h) => (
            <li key={h.nickname} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{h.nickname}</span>
                <span className="text-[11px] text-faint">
                  {h.grade}-{h.class_no} · {new Date(h.earned_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })}
                </span>
              </span>
              <button type="button" onClick={() => revoke(h)} className="flex shrink-0 items-center gap-1 rounded-xl border border-line px-2.5 py-1.5 text-[12px] text-danger">
                <UserMinus size={14} /> 회수
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

