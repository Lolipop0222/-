"use client";

import { useCallback, useEffect, useState } from "react";
import { useStudy } from "@/components/StudyProvider";
import { requestTitleCheck } from "@/lib/titles";
import {
  addTask,
  isPlannerMissing,
  kstDateStart,
  loadDay,
  loadTasks,
  removeTask,
  saveDay,
  updateTask,
  type PlannerDay,
  type Task,
} from "@/lib/planner";
import { loadDaySessions, type StudySession } from "@/lib/study";
import type { Subject } from "@/lib/subjects";
import { koreanError } from "@/lib/supabase";

export type PlannerState = {
  ready: boolean;
  /** 플래너 테이블이 아직 없음 (schema.sql을 다시 실행하기 전) */
  unavailable: boolean;
  tasks: Task[];
  day: PlannerDay;
  sessions: StudySession[];
  dayStart: number;
  error: string | null;
  add: (title: string, subject: Subject | null) => Promise<boolean>;
  update: (id: string, patch: Partial<Pick<Task, "title" | "subject" | "done">>) => Promise<void>;
  remove: (task: Task) => Promise<void>;
  saveDay: (patch: Partial<PlannerDay>) => Promise<void>;
};

/** 하루치 플래너. date = "2026-11-05" (null이면 아직 날짜를 모름) */
export function usePlanner(date: string | null): PlannerState {
  const study = useStudy();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [day, setDay] = useState<PlannerDay>({ comment: "", memo: "" });
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayStart = date ? kstDateStart(date) : 0;

  const fail = useCallback((e: unknown) => {
    if (isPlannerMissing(e)) setUnavailable(true);
    else setError(koreanError(e));
  }, []);

  // 과제·코멘트는 날짜가 바뀔 때
  useEffect(() => {
    if (!date) return;
    let alive = true;
    Promise.all([loadTasks(date), loadDay(date)]).then(
      ([t, d]) => {
        if (!alive) return;
        setTasks(t);
        setDay(d);
        setUnavailable(false);
        setError(null);
        setLoaded(date);
      },
      (e) => {
        if (!alive) return;
        setTasks([]);
        setLoaded(date);
        fail(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [date, fail]);

  // 공부 기록은 타이머가 저장할 때마다 다시 (과제별 시간·TIMETABLE이 바로 바뀌게)
  useEffect(() => {
    if (!date) return;
    let alive = true;
    loadDaySessions(kstDateStart(date)).then(
      (s) => alive && setSessions(s),
      (e) => alive && setError(koreanError(e)),
    );
    return () => {
      alive = false;
    };
  }, [date, study.version]);

  const add = useCallback(
    async (title: string, subject: Subject | null) => {
      if (!date) return false;
      try {
        const t = await addTask(date, title, subject);
        setTasks((list) => [...list, t]);
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [date, fail],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Task, "title" | "subject" | "done">>) => {
      const before = tasks;
      setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t))); // 먼저 화면에 반영
      try {
        await updateTask(id, patch);
        if (patch.done) requestTitleCheck(); // 과제 완료 → 칭호(계획의 달인) 판정
      } catch (e) {
        setTasks(before);
        fail(e);
      }
    },
    [tasks, fail],
  );

  const remove = useCallback(
    async (task: Task) => {
      const before = tasks;
      setTasks((list) => list.filter((t) => t.id !== task.id));
      try {
        await removeTask(task);
      } catch (e) {
        setTasks(before);
        fail(e);
      }
    },
    [tasks, fail],
  );

  const save = useCallback(
    async (patch: Partial<PlannerDay>) => {
      if (!date) return;
      setDay((d) => ({ ...d, ...patch }));
      try {
        await saveDay(date, patch);
      } catch (e) {
        fail(e);
      }
    },
    [date, fail],
  );

  return { ready: loaded === date && !!date, unavailable, tasks, day, sessions, dayStart, error, add, update, remove, saveDay: save };
}
