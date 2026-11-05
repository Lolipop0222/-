"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Badge, Card, ErrorText, InputRow, PrimaryButton, SubHeader, inputCls } from "@/components/ui";
import { adminIssueRecoveryCode, adminListInquiries, adminReply, isAdmin, kstDateTime, type AdminInquiry } from "@/lib/account";
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
      {rows === null && <p className="px-1 text-[13px] text-faint">불러오는 중…</p>}
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
