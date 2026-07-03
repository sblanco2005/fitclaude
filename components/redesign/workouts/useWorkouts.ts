'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { Workout, TodayWorkout } from '@/types';

export type RoutineCard = {
  key: string;
  latestId: string;
  displayId: number | null;
  name: string;
  workoutType: string;
  category: string;
  exerciseCount: number;
  muscles: string[];
  estMinutes: number;
};

export type Featured = {
  routineName: string;
  displayId: string | number | null;
  exerciseCount: number;
  muscles: string[];
  estMinutes: number;
  completed: boolean;
  latestId: string | null;
} | null;

const consolidate = (m: string): string => {
  const s = (m || '').toLowerCase();
  if (['glutes', 'hamstrings', 'quadriceps', 'quads', 'calves'].includes(s)) return 'legs';
  if (['biceps', 'triceps', 'forearms'].includes(s)) return 'arms';
  return s;
};
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function routineKey(w: Workout) {
  return (w.name?.trim() || w.workoutType || 'routine').toLowerCase();
}

export function useWorkouts() {
  const { dataVersion } = useFitClaude();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [today, setToday] = useState<TodayWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState(0);

  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [w, t] = await Promise.all([
        fetch('/api/workouts?daysBack=90').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`/api/program/today?tz=${encodeURIComponent(tz())}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      setWorkouts(Array.isArray(w) ? w : []);
      setToday(t && t.program === null ? null : t);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataVersion, localVersion]);

  const refetch = useCallback(() => setLocalVersion((v) => v + 1), []);

  // Group workouts into routine cards
  const groups = new Map<string, Workout[]>();
  workouts.forEach((w) => {
    const k = routineKey(w);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  });

  const routines: RoutineCard[] = Array.from(groups.entries()).map(([key, list]) => {
    const latest = [...list].sort((a, b) => +new Date(b.date || b.createdAt) - +new Date(a.date || a.createdAt))[0];
    const muscles = Array.from(
      new Set((latest.exercises ?? []).map((e) => consolidate(e.exercise?.muscleGroup ?? '')).filter(Boolean)),
    ).slice(0, 3);
    const displayId = list.reduce<number | null>((min, w) => {
      if (w.displayId == null) return min;
      return min == null ? w.displayId : Math.min(min, w.displayId);
    }, null);
    const count = (latest.exercises ?? []).length;
    return {
      key,
      latestId: latest.id,
      displayId,
      name: titleCase(latest.name?.trim() || latest.workoutType),
      workoutType: latest.workoutType,
      category: latest.category || 'lifting',
      exerciseCount: count,
      muscles,
      estMinutes: Math.max(0, count * 8),
    };
  }).sort((a, b) => (b.latestId > a.latestId ? 1 : -1));

  // Featured next-up from today's program day
  let featured: Featured = null;
  if (today && today.dayType !== 'rest' && today.dayLabel) {
    const muscles = Array.from(
      new Set((today.exerciseTemplate ?? []).map((e) => consolidate(e.muscle_group)).filter(Boolean)),
    ).slice(0, 3);
    const count = today.exerciseTemplate?.length ?? 0;
    const match = routines.find((r) => r.name.toLowerCase() === (today.routineName ?? today.dayLabel).toLowerCase());
    featured = {
      routineName: today.dayLabel,
      displayId: today.routineDisplayId ?? match?.displayId ?? null,
      exerciseCount: count,
      muscles,
      estMinutes: Math.max(0, count * 8),
      completed: !!today.completedToday,
      latestId: match?.latestId ?? null,
    };
  } else if (routines.length) {
    const r = routines[0];
    featured = {
      routineName: r.name,
      displayId: r.displayId,
      exerciseCount: r.exerciseCount,
      muscles: r.muscles,
      estMinutes: r.estMinutes,
      completed: false,
      latestId: r.latestId,
    };
  }

  const categories = Array.from(new Set(routines.map((r) => titleCase(r.category))));

  // Spin: regenerate via coach chat
  const spin = useCallback(async (r: RoutineCard) => {
    setBusy(r.key);
    const muscleList = r.muscles.join(', ') || r.workoutType;
    const msg = `Generate a new ${muscleList} workout with ${r.exerciseCount} exercises. This replaces my "${r.name}" routine — keep the same muscle focus but give me different exercises.`;
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, topic: 'workout', timezone: tz() }),
      });
    } finally {
      setBusy(null);
      setLocalVersion((v) => v + 1);
    }
  }, []);

  // Start ("Hit it"): duplicate the routine into a fresh session, return new id
  const startSession = useCallback(async (latestId: string): Promise<string | null> => {
    try {
      const r = await fetch(`/api/workouts/${latestId}/duplicate`, { method: 'POST' });
      if (!r.ok) return null;
      const w = await r.json();
      return w?.id ?? null;
    } catch {
      return null;
    }
  }, []);

  return { loading, routines, featured, categories, busy, spin, startSession, refetch };
}
