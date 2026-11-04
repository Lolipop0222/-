"use client";

import { useEffect, useState } from "react";
import type { MealsResponse } from "@/lib/meals";

// 같은 달을 여러 화면에서 열어도 한 번만 받는다
const cache = new Map<string, Promise<MealsResponse>>();

function load(yyyymm: string) {
  let p = cache.get(yyyymm);
  if (!p) {
    p = fetch(`/api/meals/${yyyymm}`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<MealsResponse>;
    });
    p.catch(() => cache.delete(yyyymm)); // 실패하면 다음에 다시 시도
    cache.set(yyyymm, p);
  }
  return p;
}

/** 한 달 급식. 받는 중이면 null */
export function useMonthMeals(yyyymm: string | null): MealsResponse | null {
  const [data, setData] = useState<{ key: string; res: MealsResponse } | null>(null);

  useEffect(() => {
    if (!yyyymm) return;
    let alive = true;
    load(yyyymm)
      .then((res) => alive && setData({ key: yyyymm, res }))
      .catch(() => alive && setData({ key: yyyymm, res: { source: "none", meals: {} } }));
    return () => {
      alive = false;
    };
  }, [yyyymm]);

  return data && data.key === yyyymm ? data.res : null;
}
