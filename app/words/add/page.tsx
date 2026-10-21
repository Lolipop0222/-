"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PrimaryButton, SubHeader } from "@/components/ui";
import { books } from "@/lib/mock";

const POS = ["n.", "v.", "adj.", "adv.", "prep.", "기타"];

/** 손으로 단어를 입력하는 화면 — 스캔보다 먼저 만든다 */
export default function AddWordPage() {
  const [book, setBook] = useState(books[0].title);
  const [day, setDay] = useState("12");
  const [en, setEn] = useState("");
  const [ko, setKo] = useState("");
  const [pos, setPos] = useState("v.");
  const [added, setAdded] = useState<string[]>([]);

  const canSave = en.trim() && ko.trim() && day;

  function save() {
    if (!canSave) return;
    setAdded((a) => [en.trim(), ...a]);
    setEn("");
    setKo("");
  }

  return (
    <>
      <SubHeader title="단어 직접 입력" back="/words" />
      <div className="space-y-5 px-5 pt-2">
        <div className="grid grid-cols-[1fr_88px] gap-3">
          <Field label="교재">
            <select value={book} onChange={(e) => setBook(e.target.value)} className={inputCls}>
              {books.map((b) => (
                <option key={b.id}>{b.title}</option>
              ))}
            </select>
          </Field>
          <Field label="DAY">
            <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))} className={`${inputCls} num`} />
          </Field>
        </div>

        <Field label="영어">
          <input
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder="abandon"
            autoCapitalize="off"
            autoCorrect="off"
            className={`${inputCls} text-[20px] font-semibold`}
          />
        </Field>

        <Field label="품사">
          <div className="flex flex-wrap gap-2">
            {POS.map((p) => (
              <button
                key={p}
                onClick={() => setPos(p)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${
                  pos === p ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="뜻">
          <input value={ko} onChange={(e) => setKo(e.target.value)} placeholder="버리다, 포기하다" className={inputCls} />
        </Field>

        <PrimaryButton onClick={save} disabled={!canSave}>
          저장하고 다음 단어
        </PrimaryButton>

        {added.length > 0 && (
          <div className="rounded-2xl bg-surface p-4">
            <p className="mb-2 text-[13px] text-muted">
              DAY {day}에 {added.length}개 추가됨
            </p>
            <ul className="flex flex-wrap gap-2">
              {added.map((w, i) => (
                <li key={i} className="flex items-center gap-1 rounded-lg bg-live-soft px-2 py-1 text-[13px] text-live">
                  <Check size={14} /> {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[16px] outline-none placeholder:text-faint focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
