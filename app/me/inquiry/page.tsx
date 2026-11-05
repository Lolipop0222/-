"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircleReply, Trash2 } from "lucide-react";
import { Badge, Card, ErrorText, InfoText, PrimaryButton, Segmented, SubHeader } from "@/components/ui";
import {
  INQUIRY_CATEGORIES,
  deleteInquiry,
  kstDateTime,
  loadMyInquiries,
  notReady,
  sendInquiry,
  type Inquiry,
  type InquiryCategory,
} from "@/lib/account";
import { koreanError } from "@/lib/supabase";

const MAX = 1000;

/** 내정보 → 문의함. 앱 관리자에게 질문·오류·제안을 보내고 답변을 본다 (내 문의는 나와 관리자만 봐요) */
export default function InquiryPage() {
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [ready, setReady] = useState(true);
  const [category, setCategory] = useState<InquiryCategory>("질문");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRows(await loadMyInquiries());
    } catch (e) {
      setRows([]);
      if (notReady(e)) setReady(false);
      else setError(koreanError(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadMyInquiries().then(
      (r) => alive && setRows(r),
      (e) => {
        if (!alive) return;
        setRows([]);
        if (notReady(e)) setReady(false);
        else setError(koreanError(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    if (busy || body.trim().length < 5) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await sendInquiry(category, body);
      setBody("");
      setSent(true);
      await reload();
    } catch (e) {
      setError(koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 문의를 지울까요?")) return;
    try {
      await deleteInquiry(id);
      await reload();
    } catch (e) {
      setError(koreanError(e));
    }
  }

  if (!ready) {
    return (
      <>
        <SubHeader title="문의함" back="/me" />
        <p className="px-5 pt-6 text-center text-[14px] text-muted">준비 중이에요 (데이터베이스 업데이트가 필요해요)</p>
      </>
    );
  }

  return (
    <>
      <SubHeader title="문의함" back="/me" />
      <div className="space-y-4 px-5 pt-2">
        <Card>
          <p className="text-[13px] leading-relaxed text-muted">
            궁금한 점, 고장 난 곳, 있었으면 하는 기능을 앱 관리자에게 보내 주세요. 문의는 <b className="text-text">나와 관리자만</b> 볼 수 있어요.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Segmented items={INQUIRY_CATEGORIES} value={category} onChange={setCategory} />
            <div className="rounded-2xl border border-line bg-bg px-4 py-3 focus-within:border-accent">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX))}
                rows={5}
                maxLength={MAX}
                placeholder="내용 (5자 이상)"
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-faint"
              />
              <p className="num text-right text-[12px] text-faint">
                {body.length}/{MAX}
              </p>
            </div>
            <p className="px-1 text-[12px] text-faint">이메일·전화번호 같은 개인정보는 쓰지 마세요. 하루 5개까지 보낼 수 있어요.</p>
            {error && <ErrorText>{error}</ErrorText>}
            {sent && <InfoText>보냈어요. 답변이 오면 아래에 보여요.</InfoText>}
            <PrimaryButton disabled={busy || body.trim().length < 5}>{busy ? "보내는 중…" : "보내기"}</PrimaryButton>
          </form>
        </Card>

        <h2 className="px-1 pt-2 text-[15px] font-semibold">내 문의</h2>
        {rows === null && <p className="px-1 text-[13px] text-faint">불러오는 중…</p>}
        {rows?.length === 0 && <p className="px-1 text-[13px] text-faint">아직 보낸 문의가 없어요.</p>}
        {rows?.map((q) => (
          <Card key={q.id}>
            <div className="flex items-center gap-2">
              <Badge tone={q.reply ? "live" : "neutral"}>{q.reply ? "답변 완료" : "답변 대기"}</Badge>
              <Badge>{q.category}</Badge>
              <span className="flex-1 text-right text-[12px] text-faint">{kstDateTime(q.created_at)}</span>
              <button type="button" onClick={() => remove(q.id)} aria-label="문의 지우기" className="-mr-1 grid size-8 place-items-center rounded-full text-faint active:bg-surface-2">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{q.body}</p>
            {q.reply && (
              <div className="mt-3 rounded-xl bg-surface-2 p-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
                  <MessageCircleReply size={14} /> 관리자 답변 {q.replied_at && <span className="font-normal text-faint">· {kstDateTime(q.replied_at)}</span>}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{q.reply}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
