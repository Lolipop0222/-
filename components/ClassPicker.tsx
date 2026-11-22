"use client";

import { MAX_CLASS } from "@/lib/subjects";

/** 반 고르기 (1~12반, 6칸씩 두 줄). 가입 화면·학년·반·계열 화면에서 쓴다 */
export default function ClassPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[12px] text-muted">반</p>
      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="반">
        {Array.from({ length: MAX_CLASS }, (_, i) => i + 1).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            onClick={() => onChange(c)}
            className={`num h-10 rounded-xl border text-[14px] font-semibold ${value === c ? "border-transparent bg-accent text-bg" : "border-line bg-surface text-muted"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
