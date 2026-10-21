"use client";

import { useState } from "react";
import { AlertTriangle, Camera, ImagePlus, Trash2 } from "lucide-react";
import { PrimaryButton, SubHeader } from "@/components/ui";
import { scanResult } from "@/lib/mock";

type Step = "pick" | "loading" | "confirm";

/**
 * 단어장 사진 스캔.
 * 인식 결과는 완벽하지 않으므로 '확인·수정' 화면이 반드시 있어야 한다.
 * (실제 인식은 3단계에서 /api/scan 서버 코드로 붙인다)
 */
export default function ScanPage() {
  const [step, setStep] = useState<Step>("pick");
  const [rows, setRows] = useState(scanResult);
  const [day, setDay] = useState("15");

  function fakeScan() {
    setStep("loading");
    setTimeout(() => setStep("confirm"), 1200);
  }

  function update(i: number, key: "en" | "pos" | "ko", v: string) {
    setRows((r) => r.map((row, n) => (n === i ? { ...row, [key]: v } : row)));
  }

  if (step !== "confirm") {
    return (
      <>
        <SubHeader title="사진 스캔" back="/words" />
        <div className="px-5 pt-2">
          <div className="grid aspect-[3/4] place-items-center rounded-3xl border-2 border-dashed border-line bg-surface">
            {step === "loading" ? (
              <div className="text-center">
                <div className="mx-auto size-10 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
                <p className="mt-4 text-[14px] text-muted">단어를 읽고 있어요…</p>
              </div>
            ) : (
              <div className="px-8 text-center">
                <Camera size={44} className="mx-auto text-faint" />
                <p className="mt-4 text-[15px] font-semibold">단어장 펼친 면을 찍어주세요</p>
                <p className="mt-1 text-[13px] text-muted">영단어·품사·뜻이 다 보이게, 그림자 없이</p>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
            <PrimaryButton onClick={fakeScan} disabled={step === "loading"}>
              <Camera size={20} /> 촬영하기
            </PrimaryButton>
            <button
              onClick={fakeScan}
              disabled={step === "loading"}
              aria-label="앨범에서 고르기"
              className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-muted"
            >
              <ImagePlus size={22} />
            </button>
          </div>
          <p className="mt-4 text-center text-[12px] text-faint">하루 스캔 10회까지 · 오늘 남은 횟수 8회</p>
        </div>
      </>
    );
  }

  return (
    <>
      <SubHeader title="인식 결과 확인" back="/words" />
      <div className="px-5 pt-2">
        <div className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          인식이 완벽하지 않아요. 틀린 곳을 눌러서 고친 뒤 저장하세요.
        </div>

        <label className="mt-4 flex items-center gap-3">
          <span className="text-[14px] font-medium text-muted">저장할 DAY</span>
          <input
            inputMode="numeric"
            value={day}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))}
            className="num h-10 w-20 rounded-xl border border-line bg-surface px-3 text-center text-[16px] font-semibold outline-none focus:border-accent"
          />
        </label>

        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2.5">
              <div className="grid flex-1 grid-cols-[1fr_52px] gap-x-2 gap-y-1">
                <input value={r.en} onChange={(e) => update(i, "en", e.target.value)} className={cellCls + " font-semibold"} />
                <input value={r.pos} onChange={(e) => update(i, "pos", e.target.value)} className={cellCls + " text-center text-muted"} />
                <input value={r.ko} onChange={(e) => update(i, "ko", e.target.value)} className={cellCls + " col-span-2 text-muted"} />
              </div>
              <button
                aria-label="삭제"
                onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
                className="grid size-9 place-items-center rounded-lg text-faint active:bg-surface-2"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>

        <div className="sticky bottom-16 -mx-5 mt-5 bg-gradient-to-t from-bg from-70% to-transparent px-5 pb-4 pt-6">
          <PrimaryButton href="/words">
            DAY {day || "?"}에 {rows.length}개 저장
          </PrimaryButton>
        </div>
      </div>
    </>
  );
}

const cellCls = "h-9 w-full rounded-lg bg-transparent px-2 text-[15px] outline-none focus:bg-surface-2";
