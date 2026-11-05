"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import {
  addCustomDday,
  deleteCustomDday,
  examsForGrade,
  fetchExams,
  isMissingTable,
  kstToday,
  listCustomDdays,
  mergeDdays,
  type CustomDday,
  type DdayItem,
  type Exam,
} from "@/lib/dday";
import { koreanError } from "@/lib/supabase";

// 시험 목록은 화면을 옮겨 다녀도 한 번만 받는다
let examsCache: Promise<Exam[]> | null = null;
function loadExams() {
  examsCache ??= fetchExams().then(
    (r) => r.exams,
    (e) => {
      examsCache = null;
      throw e;
    },
  );
  return examsCache;
}

export type DdaysState = {
  ready: boolean;
  items: DdayItem[];
  today: string;
  /** ddays 테이블이 아직 없음 → 직접 추가는 못 하고 학교 시험만 보인다 */
  customUnavailable: boolean;
  error: string | null;
  add: (title: string, date: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
};

export function useDdays(): DdaysState {
  const profile = useProfile();
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [custom, setCustom] = useState<CustomDday[] | null>(null);
  const [customUnavailable, setCustomUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    let alive = true;
    // 오늘 날짜는 브라우저에서만 정한다 (서버에서 미리 그릴 때 시각을 쓰지 않게)
    setTimeout(() => alive && setToday(kstToday()), 0);
    loadExams().then(
      (x) => alive && setExams(x),
      () => alive && setExams([]),
    );
    listCustomDdays().then(
      (x) => alive && setCustom(x),
      (e) => {
        if (!alive) return;
        setCustom([]);
        if (isMissingTable(e)) setCustomUnavailable(true);
        else setError(koreanError(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(
    () => (exams && custom && today ? mergeDdays(examsForGrade(exams, profile.grade), custom, today) : []),
    [exams, custom, today, profile.grade],
  );

  const add = useCallback(async (title: string, date: string) => {
    setError(null);
    try {
      const row = await addCustomDday(title, date);
      setCustom((list) => [...(list ?? []), row]);
      return true;
    } catch (e) {
      if (isMissingTable(e)) setCustomUnavailable(true);
      else setError(koreanError(e));
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteCustomDday(id);
      setCustom((list) => (list ?? []).filter((c) => c.id !== id));
    } catch (e) {
      setError(koreanError(e));
    }
  }, []);

  return { ready: !!exams && !!custom && !!today, items, today, customUnavailable, error, add, remove };
}
