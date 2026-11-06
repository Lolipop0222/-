"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileImage, FileText, FileType, Files, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useProfile } from "@/components/AuthProvider";
import PrintArchiveLogo from "@/components/PrintArchiveLogo";
import { Badge, Card, ErrorText, InfoText, Segmented } from "@/components/ui";
import { isAdmin, notReady } from "@/lib/account";
import {
  MAX_PRINT_BYTES,
  PRINT_CATEGORIES,
  PRINT_SUBJECTS,
  deletePrint,
  fileKind,
  loadPrints,
  openPrint,
  sizeText,
  titleFromFileName,
  uploadPrint,
  type Print,
  type PrintCategory,
  type PrintSubject,
} from "@/lib/prints";
import { koreanError } from "@/lib/supabase";

const GRADE_SCOPES = ["내 학년", "전체"] as const;
const NEW_MS = 7 * 24 * 3600_000;

/**
 * 프린트 아카이브 — 관리자가 올린 수행평가 자료·학습지를 학년·분류·과목으로 찾아 연다.
 * 관리자에게는 "프린트 올리기"(여러 파일 한 번에)와 지우기 버튼이 보인다.
 */
export default function PrintsPage() {
  const profile = useProfile();
  const [rows, setRows] = useState<{ list: Print[]; at: number } | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scope, setScope] = useState<(typeof GRADE_SCOPES)[number]>("내 학년");
  const [category, setCategory] = useState<PrintCategory | null>(null);
  const [subject, setSubject] = useState<PrintSubject | null>(null);
  const [q, setQ] = useState("");

  const fail = useCallback((e: unknown) => {
    if (notReady(e)) setReady(false);
    else setError(koreanError(e));
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = await loadPrints();
      setRows({ list, at: Date.now() });
    } catch (e) {
      setRows({ list: [], at: Date.now() });
      fail(e);
    }
  }, [fail]);

  useEffect(() => {
    let alive = true;
    loadPrints().then(
      (list) => alive && setRows({ list, at: Date.now() }),
      (e) => {
        if (!alive) return;
        setRows({ list: [], at: Date.now() });
        fail(e);
      },
    );
    isAdmin().then((v) => alive && setAdmin(v));
    return () => {
      alive = false;
    };
  }, [fail]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (rows?.list ?? []).filter(
      (p) =>
        (scope === "전체" || p.grade == null || p.grade === profile.grade) &&
        (!category || p.category === category) &&
        (!subject || p.subject === subject) &&
        words.every((w) => `${p.title} ${p.memo ?? ""} ${p.file_name}`.toLowerCase().includes(w)),
    );
  }, [rows, scope, category, subject, q, profile.grade]);

  async function open(p: Print, download = false) {
    setError(null);
    try {
      await openPrint(p, download);
    } catch (e) {
      setError(koreanError(e));
    }
  }

  async function remove(p: Print) {
    if (!confirm(`'${p.title}'을(를) 지울까요? 학생들도 더 이상 볼 수 없어요.`)) return;
    try {
      await deletePrint(p);
      await reload();
    } catch (e) {
      setError(koreanError(e));
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="flex h-14 items-center gap-2">
          <Link href="/" aria-label="뒤로" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
            <ArrowLeft size={22} />
          </Link>
          <PrintArchiveLogo width={132} />
          <span className="flex-1" />
          {admin && ready && !uploading && (
            <button type="button" onClick={() => setUploading(true)} className="mr-2 flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-bg">
              <Plus size={16} /> 올리기
            </button>
          )}
        </div>
      </header>

      <div className="space-y-4 px-5 pt-2">
        {!ready ? (
          <p className="pt-6 text-center text-[14px] text-muted">준비 중이에요 (데이터베이스 업데이트가 필요해요)</p>
        ) : (
          <>
            {uploading && (
              <UploadPanel
                onClose={() => setUploading(false)}
                onDone={async () => {
                  await reload();
                }}
              />
            )}

            <p className="text-[13px] text-muted">수행평가 자료·학습지를 모아 두는 곳이에요. 눌러서 열고, ⤓로 내려받아요.</p>

            <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
              <Search size={17} className="text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목으로 찾기" className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-faint" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="지우기" className="text-faint">
                  <X size={16} />
                </button>
              )}
            </label>

            <Segmented items={GRADE_SCOPES} value={scope} onChange={setScope} />
            <ChipRow items={PRINT_CATEGORIES} value={category} onChange={setCategory} allLabel="모든 분류" />
            <ChipRow items={PRINT_SUBJECTS} value={subject} onChange={setSubject} allLabel="모든 과목" />

            {error && <ErrorText>{error}</ErrorText>}
            {rows === null && <AppLoader />}
            {rows && shown.length === 0 && (
              <Card className="py-10 text-center">
                <Files size={28} className="mx-auto text-faint" />
                <p className="mt-2 text-[14px] text-muted">{rows.list.length === 0 ? "아직 올라온 프린트가 없어요" : "조건에 맞는 프린트가 없어요"}</p>
              </Card>
            )}

            <div className="space-y-2 pb-4">
              {shown.map((p) => (
                <PrintItem key={p.id} p={p} isNew={rows ? rows.at - Date.parse(p.created_at) < NEW_MS : false} admin={admin} onOpen={open} onRemove={remove} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function KindIcon({ p }: { p: Print }) {
  const kind = fileKind(p);
  const Icon = kind === "image" ? FileImage : kind === "hwp" || kind === "doc" ? FileType : FileText;
  const label = kind === "pdf" ? "PDF" : kind === "hwp" ? "HWP" : kind === "image" ? "사진" : kind === "doc" ? "문서" : "파일";
  return (
    <span className="flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-xl bg-accent-soft py-2 text-accent">
      <Icon size={20} />
      <span className="text-[9px] font-bold">{label}</span>
    </span>
  );
}

function PrintItem({
  p,
  isNew,
  admin,
  onOpen,
  onRemove,
}: {
  p: Print;
  isNew: boolean;
  admin: boolean;
  onOpen: (p: Print, download?: boolean) => void;
  onRemove: (p: Print) => void;
}) {
  const d = new Date(Date.parse(p.created_at) + 9 * 3600_000);
  return (
    <div className="flex items-stretch gap-1 rounded-2xl border border-line bg-surface">
      <button type="button" onClick={() => onOpen(p)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left active:opacity-70">
        <KindIcon p={p} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {isNew && <Badge tone="live">NEW</Badge>}
            <span className="truncate text-[15px] font-semibold">{p.title}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <Badge tone={p.category === "수행평가" ? "warn" : "accent"}>{p.category}</Badge>
            {p.subject && <Badge>{p.subject}</Badge>}
            <Badge>{p.grade ? `${p.grade}학년` : "전 학년"}</Badge>
            <span className="num text-[11px] text-faint">
              {d.getUTCMonth() + 1}/{d.getUTCDate()} · {sizeText(p.file_size)}
            </span>
          </span>
          {p.memo && <span className="mt-1 block truncate text-[12px] text-muted">{p.memo}</span>}
        </span>
      </button>
      <div className="flex flex-col justify-center pr-1">
        <button type="button" onClick={() => onOpen(p, true)} aria-label="내려받기" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
          <Download size={18} />
        </button>
        {admin && (
          <button type="button" onClick={() => onRemove(p)} aria-label="지우기" className="grid size-10 place-items-center rounded-full text-danger active:bg-surface-2">
            <Trash2 size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

function ChipRow<T extends string>({ items, value, onChange, allLabel }: { items: readonly T[]; value: T | null; onChange: (v: T | null) => void; allLabel: string }) {
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-transparent bg-text text-bg" : "border-line text-muted"}`;
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      <button type="button" onClick={() => onChange(null)} className={chip(value === null)}>
        {allLabel}
      </button>
      {items.map((it) => (
        <button key={it} type="button" onClick={() => onChange(value === it ? null : it)} className={chip(value === it)}>
          {it}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── 관리자: 올리기 ─────────────────────────

type Pending = { file: File; title: string };
const UPLOAD_GRADES = ["전 학년", "1학년", "2학년", "3학년"] as const;

function UploadPanel({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [files, setFiles] = useState<Pending[]>([]);
  const [category, setCategory] = useState<PrintCategory>("학습지");
  const [subject, setSubject] = useState<PrintSubject | null>(null);
  const [grade, setGrade] = useState<(typeof UPLOAD_GRADES)[number]>("전 학년");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.size > 0);
    const big = next.filter((f) => f.size > MAX_PRINT_BYTES);
    setError(big.length ? `50MB보다 큰 파일은 뺐어요: ${big.map((f) => f.name).join(", ")}` : null);
    setDone(null);
    setFiles((cur) => [...cur, ...next.filter((f) => f.size <= MAX_PRINT_BYTES).map((file) => ({ file, title: titleFromFileName(file.name) }))].slice(0, 20));
  }

  async function submit() {
    if (!files.length || busy) return;
    setError(null);
    setDone(null);
    const g = UPLOAD_GRADES.indexOf(grade) || null;
    const failed: Pending[] = [];
    let ok = 0;
    for (const [i, f] of files.entries()) {
      setBusy(`${i + 1}/${files.length} 올리는 중…`);
      try {
        await uploadPrint(f.file, { title: f.title, category, subject, grade: g, memo: memo || null });
        ok++;
      } catch (e) {
        failed.push(f);
        setError(`${f.file.name}: ${koreanError(e)}`);
      }
    }
    setBusy(null);
    setFiles(failed);
    if (ok) setDone(`${ok}개를 올렸어요. 학생들에게 바로 보여요.`);
    await onDone();
  }

  return (
    <Card className="space-y-3 border-accent">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[16px] font-bold">
          <Upload size={18} className="text-accent" /> 프린트 올리기
        </h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="grid size-8 place-items-center rounded-full text-muted active:bg-surface-2">
          <X size={18} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*"
        className="hidden"
        onChange={(e) => (add(e.target.files), (e.target.value = ""))}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), add(e.dataTransfer.files))}
        className={`flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted ${drag ? "border-accent bg-accent-soft" : "border-line bg-bg"}`}
      >
        <Files size={22} />
        <span className="text-[14px] font-semibold">파일 고르기 (여러 개 가능)</span>
        <span className="text-[11px] text-faint">PDF·한글·사진·오피스 · 파일당 50MB · 끌어다 놓아도 돼요</span>
      </button>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <input
                  value={f.title}
                  maxLength={80}
                  onChange={(e) => setFiles((cur) => cur.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  aria-label="제목"
                  className="w-full bg-transparent text-[14px] font-semibold outline-none"
                />
                <p className="truncate text-[11px] text-faint">
                  {f.file.name} · {sizeText(f.file.size)}
                </p>
              </div>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label="빼기" className="text-faint">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-1.5 text-[12px] font-semibold text-muted">분류</p>
        <div className="flex flex-wrap gap-2">
          {PRINT_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${category === c ? "border-transparent bg-accent text-bg" : "border-line text-muted"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-semibold text-muted">과목</p>
        <div className="flex flex-wrap gap-2">
          {[null, ...PRINT_SUBJECTS].map((s) => (
            <button key={s ?? "공통"} type="button" onClick={() => setSubject(s)} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${subject === s ? "border-transparent bg-accent text-bg" : "border-line text-muted"}`}>
              {s ?? "공통"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-semibold text-muted">학년</p>
        <Segmented items={UPLOAD_GRADES} value={grade} onChange={setGrade} />
      </div>
      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value.slice(0, 300))}
        placeholder="메모 (선택) — 예: 11/20까지 제출"
        className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-[14px] outline-none placeholder:text-faint focus:border-accent"
      />

      {error && <ErrorText>{error}</ErrorText>}
      {done && <InfoText>{done}</InfoText>}
      <button
        type="button"
        onClick={submit}
        disabled={!files.length || busy !== null}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-bg disabled:opacity-40"
      >
        <Upload size={18} /> {busy ?? (files.length ? `${files.length}개 올리기` : "파일을 골라 주세요")}
      </button>
    </Card>
  );
}
