"use client";

import { AppLoader } from "@/components/BrandLoader";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, MessageCircleReply, Trash2, X } from "lucide-react";
import { useProfile } from "@/components/AuthProvider";
import { InquiryPhotos } from "@/components/InquiryPhotos";
import { Badge, Card, ErrorText, InfoText, PrimaryButton, SubHeader } from "@/components/ui";
import { INQUIRY_PHOTO_MAX, removeInquiryPhotos, shrinkPhoto, uploadInquiryPhoto } from "@/lib/photos";
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

/**
 * 내정보 → 문의함. 앱 관리자에게 질문·오류·제안·칭호 인증을 보내고 답변을 본다 (내 문의는 나와 관리자만 봐요).
 * 사진은 5장까지 첨부 (긴 쪽 1600px로 줄여서 비공개 저장소에 올림, 2026-11-22).
 */
export default function InquiryPage() {
  const profile = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);
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
    const uploaded: string[] = [];
    try {
      for (const p of photos) uploaded.push(await uploadInquiryPhoto(profile.id, p.blob));
      await sendInquiry(category, body, uploaded);
      setBody("");
      setPhotos([]);
      setSent(true);
      await reload();
    } catch (e) {
      await removeInquiryPhotos(uploaded); // 보내기 실패 → 올린 사진 정리
      const m = (e as { message?: string })?.message ?? "";
      setError(/bucket not found|42703|photos/i.test(m) ? "사진 첨부는 아직 준비 중이에요 (데이터베이스 업데이트가 필요해요)" : koreanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const room = INQUIRY_PHOTO_MAX - photos.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > room) setError(`사진은 ${INQUIRY_PHOTO_MAX}장까지 첨부할 수 있어요`);
    try {
      const next: { blob: Blob; url: string }[] = [];
      for (const f of files) {
        const blob = await shrinkPhoto(f);
        next.push({ blob, url: URL.createObjectURL(blob) });
      }
      setPhotos((p) => [...p, ...next].slice(0, INQUIRY_PHOTO_MAX));
    } catch (e) {
      setError(koreanError(e));
    }
  }

  async function remove(q: Inquiry) {
    if (!confirm("이 문의를 지울까요?")) return;
    try {
      await deleteInquiry(q.id);
      await removeInquiryPhotos(q.photos ?? []);
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
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="분류">
              {INQUIRY_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${category === c ? "border-accent bg-accent text-bg" : "border-line text-muted"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {category === "칭호 인증" && (
              <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-[12px] leading-relaxed text-accent">
                <b>능화반 · 대능인 · 능화 추락자</b> 같은 스페셜 칭호는 인증 사진(반 명단·안내문 등)을 첨부해 보내 주세요. 관리자가 확인하면 칭호를 드려요. 다른 친구의 이름이 보이면 가려 주세요.
              </p>
            )}
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
            {/* 사진 첨부 (5장까지) */}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (void addFiles(e.target.files), (e.target.value = ""))} />
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <span key={p.url} className="relative size-16 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 올리기 전 미리보기 (blob 주소) */}
                  <img src={p.url} alt={`첨부 사진 ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={`첨부 사진 ${i + 1} 빼기`}
                    onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                    className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-surface/90 text-text"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {photos.length < INQUIRY_PHOTO_MAX && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-faint active:bg-surface-2"
                >
                  <ImagePlus size={18} />
                  <span className="num text-[10px]">
                    {photos.length}/{INQUIRY_PHOTO_MAX}
                  </span>
                </button>
              )}
            </div>
            <p className="px-1 text-[12px] text-faint">이메일·전화번호 같은 개인정보는 쓰지 마세요. 사진은 5장까지, 하루 5개까지 보낼 수 있어요.</p>
            {error && <ErrorText>{error}</ErrorText>}
            {sent && <InfoText>보냈어요. 답변이 오면 아래에 보여요.</InfoText>}
            <PrimaryButton disabled={busy || body.trim().length < 5}>{busy ? "보내는 중…" : "보내기"}</PrimaryButton>
          </form>
        </Card>

        <h2 className="px-1 pt-2 text-[15px] font-semibold">내 문의</h2>
        {rows === null && <AppLoader size="inline" />}
        {rows?.length === 0 && <p className="px-1 text-[13px] text-faint">아직 보낸 문의가 없어요.</p>}
        {rows?.map((q) => (
          <Card key={q.id}>
            <div className="flex items-center gap-2">
              <Badge tone={q.reply ? "live" : "neutral"}>{q.reply ? "답변 완료" : "답변 대기"}</Badge>
              <Badge>{q.category}</Badge>
              <span className="flex-1 text-right text-[12px] text-faint">{kstDateTime(q.created_at)}</span>
              <button type="button" onClick={() => remove(q)} aria-label="문의 지우기" className="-mr-1 grid size-8 place-items-center rounded-full text-faint active:bg-surface-2">
                <Trash2 size={16} />
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{q.body}</p>
            <InquiryPhotos paths={q.photos} />
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
