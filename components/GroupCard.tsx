"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card } from "@/components/ui";
import { hm } from "@/lib/format";
import { myGroup } from "@/lib/mock";

/** 스터디그룹 — 초대코드 6자리, 지금 공부 중인 멤버는 초록 점 */
export default function GroupCard() {
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const members = [...myGroup.members].sort((a, b) => b.todaySec - a.todaySec);

  async function copy() {
    try {
      await navigator.clipboard.writeText(myGroup.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 무시
    }
  }

  return (
    <Card flush>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-[12px] text-muted">스터디그룹</p>
          <p className="text-[16px] font-bold">{myGroup.name}</p>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 active:bg-line">
          <span className="num text-[14px] font-bold tracking-[0.15em]">{myGroup.code}</span>
          {copied ? <Check size={15} className="text-live" /> : <Copy size={15} className="text-muted" />}
        </button>
      </div>

      <ul className="border-t border-line">
        {members.map((m, i) => (
          <li key={m.nickname} className={`flex items-center gap-3 px-4 py-2.5 ${m.me ? "bg-accent-soft" : ""}`}>
            <span className="num w-4 text-[13px] font-semibold text-muted">{i + 1}</span>
            <span className={`size-2 rounded-full ${m.studying ? "live-dot bg-live" : "bg-faint/50"}`} />
            <span className="flex-1 text-[14px]">
              {m.nickname}
              {m.me && <span className="ml-1.5 text-[12px] text-accent">나</span>}
            </span>
            <span className="num text-[13px] text-muted">{hm(m.todaySec)}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 border-t border-line p-4">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="초대코드 6자리"
          className="num h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-[15px] tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-faint focus:border-accent"
        />
        <button
          disabled={joinCode.length !== 6}
          className="h-11 shrink-0 rounded-xl bg-accent px-4 text-[14px] font-bold text-bg disabled:opacity-30"
        >
          그룹 가입
        </button>
      </div>
    </Card>
  );
}
