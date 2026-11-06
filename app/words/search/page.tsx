"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AppLoader } from "@/components/BrandLoader";
import { useProfile } from "@/components/AuthProvider";
import { InputRow, SubHeader, inputCls } from "@/components/ui";
import { BoxBadge, SpeakButton, WordDetail } from "@/components/words/parts";
import { loadDay, loadIndex, type WmIndexEntry, type WmWord } from "@/lib/wordmaster";
import { useWordStore } from "@/lib/wordProgress";

const LIMIT = 60;

/** 2,000단어 찾기 — 영어(앞부분이 맞는 것부터)나 뜻으로 */
export default function WordSearchPage() {
  const profile = useProfile();
  const store = useWordStore(profile.id);
  const [index, setIndex] = useState<WmIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<WmWord | null>(null);

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);

  const results = useMemo(() => {
    if (!index) return [];
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const starts: WmIndexEntry[] = [];
    const has: WmIndexEntry[] = [];
    for (const e of index) {
      const w = e[2].toLowerCase();
      if (w.startsWith(t)) starts.push(e);
      else if (w.includes(t) || e[3].includes(t)) has.push(e);
    }
    return [...starts, ...has];
  }, [index, q]);

  async function toggle(e: WmIndexEntry) {
    if (open === e[0]) {
      setOpen(null);
      return;
    }
    setOpen(e[0]);
    setDetail(null);
    try {
      const d = await loadDay(e[1]);
      setDetail(d.words.find((w) => w.id === e[0]) ?? null);
    } catch {
      setDetail(null);
    }
  }

  return (
    <>
      <SubHeader title="단어 찾기" back="/words" />
      <div className="px-5 pb-8">
        <InputRow icon={<Search size={18} />}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예: prevail, 우세하다"
            aria-label="찾을 단어"
            className={inputCls}
            enterKeyHint="search"
          />
          {q && (
            <button type="button" aria-label="지우기" onClick={() => setQ("")} className="grid size-8 shrink-0 place-items-center text-faint">
              <X size={16} />
            </button>
          )}
        </InputRow>

        {error && <p className="py-10 text-center text-[14px] text-danger">{error}</p>}
        {!index && !error && <AppLoader size="inline" label="단어 목록 불러오는 중…" />}
        {index && !q.trim() && <p className="py-10 text-center text-[13px] text-faint">영어 철자나 한국어 뜻을 입력하세요.</p>}
        {index && q.trim() && results.length === 0 && <p className="py-10 text-center text-[13px] text-faint">찾는 단어가 없어요.</p>}

        {results.length > 0 && (
          <>
            <p className="mt-3 px-1 text-[12px] text-faint">
              {results.length}개{results.length > LIMIT && ` 중 ${LIMIT}개`}
            </p>
            <ul className="mt-1 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {results.slice(0, LIMIT).map((e) => {
                const isOpen = open === e[0];
                return (
                  <li key={e[0]}>
                    <div className="flex items-center gap-2 pl-4 pr-2">
                      <button type="button" onClick={() => toggle(e)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-baseline gap-3 py-2.5 text-left">
                        <span className="max-w-[60%] shrink-0 text-[15px] font-semibold">{e[2]}</span>
                        <span className="min-w-0 truncate text-[13px] text-muted">{e[3]}</span>
                      </button>
                      <BoxBadge p={store.progress.get(e[0])} />
                      <SpeakButton text={e[2]} size={16} />
                    </div>
                    {isOpen && (
                      <div className="border-t border-line bg-surface-2/40 px-4 py-4">
                        {detail && detail.id === e[0] ? (
                          <>
                            <WordDetail word={detail} allSentences />
                            <Link href={`/words/day/${e[1]}`} className="mt-4 inline-block text-[13px] font-semibold text-accent">
                              DAY {e[1]}로 가기 →
                            </Link>
                          </>
                        ) : (
                          <AppLoader size="inline" />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
