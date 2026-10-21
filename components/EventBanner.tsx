"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { events } from "@/lib/mock";

/** 학생회·반·입시 공지 배너 (가로로 넘김) */
export default function EventBanner() {
  const [idx, setIdx] = useState(0);

  return (
    <div>
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {events.map((ev) => (
          <article
            key={ev.id}
            className="relative w-full shrink-0 snap-center overflow-hidden rounded-2xl p-4"
            style={{ background: `linear-gradient(135deg, ${ev.color}33, ${ev.color}0d)` }}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: ev.color }}>
              <Megaphone size={14} />
              {ev.category}
            </div>
            <h3 className="mt-2 text-[16px] font-bold leading-snug">{ev.title}</h3>
            <p className="mt-1 text-[13px] text-muted">{ev.body}</p>
          </article>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {events.map((ev, i) => (
          <span key={ev.id} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-text" : "w-1.5 bg-faint"}`} />
        ))}
      </div>
    </div>
  );
}
