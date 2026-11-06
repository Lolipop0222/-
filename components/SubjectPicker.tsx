"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { SUBJECTS, SUBJECT_COLOR, canLecture, detailsFor, type Subject, type Track } from "@/lib/subjects";

export type SubjectChoice = { subject: Subject | null; detail: string | null; lecture: boolean };

/**
 * 과목 → (계열별) 세부 항목 → 인강 고르기. 플래너 과제 추가·편집에서 쓴다.
 * 과목은 학생이 직접 고른다 (과제 이름으로 짐작하지 않음). 다시 누르면 선택 해제.
 */
export default function SubjectPicker({ value, onChange, track }: { value: SubjectChoice; onChange: (v: SubjectChoice) => void; track: Track | null }) {
  const details = detailsFor(track, value.subject);
  const needTrack = !track && !!value.subject && (detailsFor("문과", value.subject).length > 0 || detailsFor("이과", value.subject).length > 0);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {SUBJECTS.map((s) => {
          const on = value.subject === s;
          return (
            <button
              type="button"
              key={s}
              aria-pressed={on}
              onClick={() => onChange(on ? { subject: null, detail: null, lecture: false } : { subject: s, detail: null, lecture: value.lecture && canLecture(s) })}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${on ? "border-transparent text-on-subject" : "border-line text-muted"}`}
              style={on ? { background: SUBJECT_COLOR[s] } : undefined}
            >
              {s}
            </button>
          );
        })}
      </div>
      {value.subject && (details.length > 0 || canLecture(value.subject) || needTrack) && (
        <div className="flex flex-wrap gap-1.5 border-l-2 pl-2" style={{ borderColor: SUBJECT_COLOR[value.subject] }}>
          {details.map((d) => {
            const on = value.detail === d;
            return (
              <button
                type="button"
                key={d}
                aria-pressed={on}
                onClick={() => onChange({ ...value, detail: on ? null : d })}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${on ? "border-text bg-surface-2 text-text" : "border-line text-muted"}`}
              >
                {d}
              </button>
            );
          })}
          {canLecture(value.subject) && (
            <button
              type="button"
              aria-pressed={value.lecture}
              onClick={() => onChange({ ...value, lecture: !value.lecture })}
              className={`lecture-chip flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${value.lecture ? "border-text text-text" : "border-dashed border-line text-muted"}`}
              style={value.lecture ? ({ "--chip": SUBJECT_COLOR[value.subject] } as CSSProperties) : undefined}
            >
              <MonitorPlay size={11} /> 인강
            </button>
          )}
          {needTrack && (
            <Link href="/me/track" className="px-1 py-0.5 text-[11px] font-semibold text-accent underline underline-offset-2">
              계열 고르기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
