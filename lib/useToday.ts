"use client";

import { useMemo, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const todayKey = () => new Date().toDateString();

/**
 * 오늘 날짜 (자정 기준). 서버 렌더링 중에는 null.
 * 화면 표시용일 뿐, 공부 시간 계산은 나중에 서버 시각 기준으로 한다.
 */
export function useToday(): Date | null {
  const key = useSyncExternalStore(subscribe, todayKey, () => null);
  return useMemo(() => (key ? new Date(key) : null), [key]);
}
