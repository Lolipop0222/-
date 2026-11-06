"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ImageOff, KeyRound, UserX } from "lucide-react";
import PrintArchiveLogo from "@/components/PrintArchiveLogo";
import { ProfileAvatar } from "@/components/TitleBadge";
import { Badge, Card, ErrorText, InputRow, PrimaryButton, SubHeader, inputCls } from "@/components/ui";
import {
  adminDeleteUser,
  adminIssueRecoveryCode,
  adminListInquiries,
  adminListPhotos,
  adminRemoveAvatar,
  adminReply,
  isAdmin,
  kstDateTime,
  type AdminInquiry,
  type AdminPhoto,
} from "@/lib/account";
import { koreanError } from "@/lib/supabase";

/**
 * 관리자 화면 — 문의 답변, 복구 코드 대신 만들어 주기.
 * 관리자 여부는 DB(admins 테이블)가 정한다. 이 화면을 열어도 관리자가 아니면 DB 함수가 모두 거절한다.
 */
export default function AdminPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    isAdmin().then((v) => alive && setAdmin(v));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <SubHeader title="관리자" back="/me" />
      <div className="space-y-4 px-5 pt-2">
        {admin === null && <p className="text-[13px] text-faint">확인 중…</p>}
        {admin === false && <p className="pt-6 text-center text-[14px] text-muted">관리자만 쓸 수 있는 화면이에요.</p>}
        {admin && (
          <>
            <Link href="/prints" className="block">
              <Card className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <PrintArchiveLogo width={140} />
                  <p className="mt-1.5 text-[13px] text-muted">프린트 올리기·지우기 (프린트 아카이브 화면 오른쪽 위 &quot;올리기&quot;)</p>
                </div>
                <ChevronRight size={20} className="text-faint" />
              </Card>
            </Link>
            <PhotoReview />
            <DeleteUserCard />
            <IssueCodeCard />
            <Inquiries />
          </>
        )}
      </div>
    </>
  );
}

function IssueCodeCard() {
  const [nickname, setNickname] = useState("");
  const [result, setResult] = useState<{ nickname: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue() {
    if (busy || !nickname.trim()) return;
    if (!confirm(`'${nickname.trim()}' 학생 본인이 맞는지 직접 확인했나요? 새 복구 코드를 만들면 그 학생의 예전 코드는 못 쓰게 돼요.`)) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult({ nickname: nickname.trim(), code: await adminIssueRecoveryCode(nickname) });
      setNickname("");
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-accent" />
        <h2 className="text-[16px] font-bold">복구 코드 만들어 주기</h2>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        비밀번호도 복구 코드도 잃어버린 학생에게, <b className="text-text">본인 확인을 직접 한 다음</b> 새 코드를 만들어 전해 주세요. 학생은 로그인 화면 → 비밀번호를
        잊었어요에서 씁니다.
      </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          issue();
        }}
      >
        <InputRow icon={<KeyRound size={18} />}>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="학생 닉네임" className={inputCls} />
        </InputRow>
        {error && <ErrorText>{error}</ErrorText>}
        {result && (
          <div className="rounded-xl border border-accent/40 bg-accent-soft p-4 text-center">
            <p className="text-[12px] text-muted">{result.nickname} 학생의 새 복구 코드</p>
            <p className="num mt-1 select-all font-mono text-[22px] font-bold tracking-[0.12em] text-accent">{result.code}</p>
          </div>
        )}
        <PrimaryButton disabled={busy || !nickname.trim()}>{busy ? "만드는 중…" : "새 코드 만들기"}</PrimaryButton>
      </form>
    </Card>
  );
}

function Inquiries() {
  const [rows, setRows] = useState<AdminInquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await adminListInquiries());
    } catch (e) {
      setRows([]);
      setError(koreanError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    adminListInquiries().then(
      (r) => alive && setRows(r),
      (e) => alive && (setRows([]), setError(koreanError(e))),
    );
    return () => {
      alive = false;
    };
  }, []);

  const waiting = rows?.filter((r) => !r.reply).length ?? 0;

  return (
    <>
      <h2 className="px-1 pt-2 text-[15px] font-semibold">
        문의 {rows && <span className="text-muted">· 답변 대기 {waiting}개</span>}
      </h2>
      {error && <ErrorText>{error}</ErrorText>}
      {rows === null && <AppLoader size="inline" />}
      {rows?.length === 0 && !error && <p className="px-1 text-[13px] text-faint">아직 문의가 없어요.</p>}
      {rows?.map((q) => <InquiryItem key={q.id + (q.replied_at ?? "")} q={q} onSaved={reload} />)}
    </>
  );
}

function InquiryItem({ q, onSaved }: { q: AdminInquiry; onSaved: () => Promise<void> }) {
  const [reply, setReply] = useState(q.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminReply(q.id, reply);
      await onSaved();
    } catch (e) {
      setError(koreanError(e));
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={q.reply ? "live" : "warn"}>{q.reply ? "답변 완료" : "답변 대기"}</Badge>
        <Badge>{q.category}</Badge>
        <span className="text-[13px] font-semibold">{q.nickname}</span>
        <span className="text-[12px] text-muted">
          {q.grade}학년 {q.class_no}반
        </span>
        <span className="flex-1 text-right text-[12px] text-faint">{kstDateTime(q.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{q.body}</p>
      <div className="mt-3 rounded-xl border border-line bg-bg px-3 py-2 focus-within:border-accent">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value.slice(0, 1000))}
          rows={3}
          maxLength={1000}
          placeholder="답변 (비우고 저장하면 답변을 지워요)"
          className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
        />
      </div>
      {error && (
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy || reply === (q.reply ?? "")}
        className="mt-2 h-10 w-full rounded-xl bg-accent-soft text-[14px] font-semibold text-accent disabled:opacity-40"
      >
        {busy ? "저장 중…" : "답변 저장"}
      </button>
    </Card>
  );
}

// ───────────────────────── 사진 프로필 검토 ─────────────────────────

function PhotoReview() {
  const [rows, setRows] = useState<AdminPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await adminListPhotos());
    } catch (e) {
      setRows([]);
      setError(koreanError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    adminListPhotos().then(
      (r) => alive && setRows(r),
      (e) => alive && (setRows([]), setError(koreanError(e))),
    );
    return () => {
      alive = false;
    };
  }, []);

  async function act(p: AdminPhoto, kind: "photo" | "account") {
    const msg =
      kind === "photo"
        ? `${p.nickname} 학생의 사진을 내릴까요? 사진 파일도 지워져요.`
        : `${p.nickname} 학생의 계정을 삭제할까요?\n공부 기록·칭호·문의 등 모든 기록이 지워지고 되돌릴 수 없어요.`;
    if (!confirm(msg)) return;
    if (kind === "account" && prompt(`확인을 위해 닉네임 '${p.nickname}'을(를) 그대로 써 주세요`) !== p.nickname) return;
    setBusy(p.nickname);
    setError(null);
    try {
      if (kind === "photo") await adminRemoveAvatar(p.nickname);
      else await adminDeleteUser(p.nickname, p.avatar);
      await reload();
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="text-[16px] font-bold">사진 프로필 검토</h2>
      <p className="mt-1 text-[12px] text-muted">최근에 바꾼 사진부터. 부적절하면 사진을 내리거나 계정을 삭제하세요.</p>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {rows === null && <AppLoader size="inline" />}
      {rows?.length === 0 && !error && <p className="mt-3 text-[13px] text-faint">사진을 올린 학생이 없어요.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows?.map((p) => (
          <div key={p.nickname} className="rounded-xl border border-line bg-bg p-2.5 text-center">
            <span className="flex justify-center">
              <ProfileAvatar avatar={p.avatar} nickname={p.nickname} size={72} />
            </span>
            <p className="mt-1.5 truncate text-[13px] font-semibold">{p.nickname}</p>
            <p className="text-[11px] text-faint">
              {p.grade}-{p.class_no}
              {p.avatar_at ? ` · ${kstDateTime(p.avatar_at)}` : ""}
            </p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" disabled={busy !== null} onClick={() => act(p, "photo")} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-surface-2 text-[12px] font-semibold text-muted disabled:opacity-40">
                <ImageOff size={13} /> 내리기
              </button>
              <button type="button" disabled={busy !== null} onClick={() => act(p, "account")} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-danger-soft text-[12px] font-semibold text-danger disabled:opacity-40">
                <UserX size={13} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DeleteUserCard() {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    const n = nickname.trim();
    if (!n || busy) return;
    if (!confirm(`${n} 학생의 계정을 삭제할까요?\n공부 기록·칭호·문의 등 모든 기록이 지워지고 되돌릴 수 없어요.`)) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      // 사진이 있으면 파일도 지운다
      const photos = await adminListPhotos().catch(() => [] as AdminPhoto[]);
      await adminDeleteUser(n, photos.find((p) => p.nickname === n)?.avatar);
      setDone(`${n} 학생의 계정을 삭제했어요.`);
      setNickname("");
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-danger">
        <UserX size={18} /> 계정 삭제
      </h2>
      <p className="mt-1 text-[12px] text-muted">규칙을 어긴 학생의 계정을 닉네임으로 삭제해요. 관리자 계정은 지울 수 없어요.</p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <InputRow icon={<UserX size={18} />}>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="학생 닉네임" className={inputCls} />
        </InputRow>
        {error && <ErrorText>{error}</ErrorText>}
        {done && <p className="rounded-xl bg-live-soft px-4 py-3 text-[14px] text-live">{done}</p>}
        <PrimaryButton tone="danger" disabled={busy || !nickname.trim()}>
          {busy ? "삭제 중…" : "계정 삭제"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
