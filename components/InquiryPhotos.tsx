"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { inquiryPhotoUrls } from "@/lib/photos";

/**
 * 문의에 붙은 사진 (비공개 inquiry 버킷 → 1시간짜리 서명 주소). 누르면 화면 가득 크게.
 * 학생 문의함과 관리자 화면에서 같이 쓴다.
 */
export function InquiryPhotos({ paths }: { paths: string[] | undefined }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const key = (paths ?? []).join("|");
  useEffect(() => {
    if (!key) return;
    let alive = true;
    inquiryPhotoUrls(key.split("|")).then((u) => alive && setUrls(u));
    return () => {
      alive = false;
    };
  }, [key]);
  if (!paths?.length) return null;
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {paths.map((p, i) => (
          <button key={p} type="button" onClick={() => urls[p] && setOpen(urls[p])} className="size-16 overflow-hidden rounded-xl border border-line bg-surface-2" aria-label={`첨부 사진 ${i + 1} 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소 */}
            {urls[p] && <img src={urls[p]} alt="" className="size-full object-cover" loading="lazy" />}
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-stage/95 p-4" onClick={() => setOpen(null)} role="dialog" aria-label="첨부 사진">
          {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소 */}
          <img src={open} alt="첨부 사진" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" aria-label="닫기" className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] grid size-10 place-items-center rounded-full bg-surface-2 text-text">
            <X size={22} />
          </button>
        </div>
      )}
    </>
  );
}
