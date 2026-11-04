"use client";

import { useEffect, useState } from "react";
import type { MealsResponse } from "@/lib/meals";
import type { ScheduleResponse } from "@/lib/neis";

// 같은 달을 여러 화면에서 열어도 한 번만 받는다
const cache = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(url)); // 실패하면 다음에 다시 시도
    cache.set(url, p);
  }
  return p;
}

/** /api/{kind}/{yyyymm} 를 받아온다. 받는 중이면 null, 실패하면 empty */
function useMonthly<T>(kind: "meals" | "schedule", yyyymm: string | null, empty: T): T | null {
  const url = yyyymm ? `/api/${kind}/${yyyymm}` : null;
  const [data, setData] = useState<{ url: string; res: T } | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    load<T>(url)
      .then((res) => alive && setData({ url, res }))
      .catch(() => alive && setData({ url, res: empty }));
    return () => {
      alive = false;
    };
    // empty는 고정값
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return data && data.url === url ? data.res : null;
}

const NO_MEALS: MealsResponse = { source: "none", meals: {} };
const NO_EVENTS: ScheduleResponse = { source: "none", events: {} };

export const useMonthMeals = (yyyymm: string | null) => useMonthly("meals", yyyymm, NO_MEALS);
export const useMonthSchedule = (yyyymm: string | null) => useMonthly("schedule", yyyymm, NO_EVENTS);
