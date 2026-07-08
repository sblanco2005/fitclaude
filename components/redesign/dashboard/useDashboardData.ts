'use client';

import { useEffect, useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { UserProfile, DailyNutrition, TrainingProgram, TodayWorkout, Workout } from '@/types';

const DAY_TYPE_COLOR: Record<string, string> = {
  coached: 'var(--rd-ember)',
  pt_session: 'var(--rd-violet)',
  class: 'var(--rd-amber)',
  rest: 'var(--rd-border-strong)',
};

export type DayCell = {
  label: string; // M T W T F S S
  state: 'done' | 'today' | 'planned' | 'rest';
  dot?: string;
};

export type MacroRow = { label: string; value: number; target: number; color: string };

export type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  kcal: number;
  dateLabel: string;
  kind: 'workout' | 'activity';
  workoutId?: string;
};

type Activity = { id: string; name: string; durationMinutes: number | null; date: string };

export type DashboardData = {
  loading: boolean;
  kcal: number;
  kcalTarget: number;
  macros: MacroRow[];
  streak: number;
  week: DayCell[];
  weekNumber: number | null;
  today: {
    hasPlan: boolean;
    isRest: boolean;
    dayLabel: string;
    exerciseCount: number;
    estMinutes: number;
    muscles: string;
    completed: boolean;
    routineId: string | null;
  };
  recentActivity: ActivityItem[];
};

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// JS getDay(): 0=Sun..6=Sat  →  program weekday: 0=Mon..6=Sun
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
const localDateKey = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA');
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function useDashboardData(): DashboardData {
  const { dataVersion } = useFitClaude();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [today, setToday] = useState<TodayWorkout | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const getJson = async (url: string) => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };
    const load = async () => {
      const [p, n, prog, t, w, a] = await Promise.all([
        getJson('/api/profile'),
        getJson(`/api/nutrition/today?tz=${encodeURIComponent(tz)}`),
        getJson('/api/program'),
        getJson(`/api/program/today?tz=${encodeURIComponent(tz)}`),
        getJson('/api/workouts?daysBack=30'),
        getJson('/api/activities?daysBack=14'),
      ]);
      if (cancelled) return;
      setProfile(p ?? null);
      setNutrition(n ?? null);
      setActivities(Array.isArray(a) ? a : []);
      // /api/program returns the program object directly, or { program: null }
      setProgram(prog?.id ? prog : null);
      // /api/program/today returns today's day object, or { program: null }
      setToday(t && t.program === null ? null : (t ?? null));
      setWorkouts(Array.isArray(w) ? w : []);
      setLoading(false);
    };
    load();
    // Refetch when the user returns to this screen — Next's router cache can
    // re-show a previously-rendered page without re-running this effect, so a
    // change made on another screen (e.g. moving a program day) would look stale.
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dataVersion]);

  // ---- Macros ----
  const kcalTarget = profile?.dailyCalorieTarget ?? 2200;
  const proteinTarget = profile?.dailyProteinTarget ?? 160;
  const carbsPct = profile?.carbsPercent ?? 45;
  const fatPct = profile?.fatPercent ?? 30;
  const carbsTarget = Math.round((kcalTarget * (carbsPct / 100)) / 4);
  const fatTarget = Math.round((kcalTarget * (fatPct / 100)) / 9);
  const totals = nutrition?.totals;
  const kcal = Math.round(totals?.calories ?? 0);
  const macros: MacroRow[] = [
    { label: 'Protein', value: Math.round(totals?.proteinG ?? 0), target: proteinTarget, color: 'var(--rd-macro-protein)' },
    { label: 'Carbs', value: Math.round(totals?.carbsG ?? 0), target: carbsTarget, color: 'var(--rd-macro-carbs)' },
    { label: 'Fat', value: Math.round(totals?.fatG ?? 0), target: fatTarget, color: 'var(--rd-macro-fat)' },
  ];

  // ---- Streak: consecutive days (ending today or yesterday) with a completed workout ----
  const completedKeys = new Set(
    workouts.filter((w) => w.completed && w.date).map((w) => localDateKey(w.date as string)),
  );
  let streak = 0;
  {
    const cursor = new Date();
    if (!completedKeys.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (completedKeys.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // ---- This-week strip ----
  const todayWeekday = today?.weekday ?? mondayIndex(new Date());
  const currentWeek = program?.currentWeek ?? null;
  const daysThisWeek = (program?.days ?? []).filter((d) => d.weekNumber === currentWeek);
  // weekdays before today that had a completed workout in the last 30d
  const doneWeekdays = new Set<number>();
  workouts.forEach((w) => {
    if (w.completed && w.date) doneWeekdays.add(mondayIndex(new Date(w.date as string)));
  });
  const week: DayCell[] = WEEK_LABELS.map((label, wd) => {
    const day = daysThisWeek.find((d) => d.weekday === wd);
    if (wd === todayWeekday) return { label, state: 'today' };
    if (wd < todayWeekday && doneWeekdays.has(wd)) return { label, state: 'done' };
    if (!day || day.dayType === 'rest') return { label, state: 'rest' };
    return { label, state: 'planned', dot: DAY_TYPE_COLOR[day.dayType] ?? 'var(--rd-violet)' };
  });

  // ---- Today's plan ----
  const isRest = !today || today.dayType === 'rest';
  const exercises = today?.exerciseTemplate ?? [];
  const muscles = Array.from(
    new Set(exercises.map((e) => e.muscle_group).filter(Boolean)),
  )
    .slice(0, 3)
    .join(', ');

  // ---- Recent activity: completed workouts + logged activities, newest first ----
  const dateLabel = (iso: string): string => {
    const k = localDateKey(iso);
    const today0 = localDateKey(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (k === today0) return 'Today';
    if (k === localDateKey(y)) return 'Yesterday';
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const wItems: ActivityItem[] = workouts
    .filter((w) => w.completed && w.date)
    .map((w) => {
      const exCount = (w.exercises ?? []).length;
      const dur = w.durationMinutes ?? 0;
      return {
        id: `w-${w.id}`,
        title: titleCase(w.name?.trim() || w.workoutType || 'Workout'),
        meta: `${exCount} ex${dur ? ` · ${dur} min` : ''}`,
        kcal: dur ? Math.round(dur * 7) : exCount * 45,
        dateLabel: dateLabel(w.date as string),
        kind: 'workout' as const,
        workoutId: w.id,
        _t: +new Date(w.date as string),
      } as ActivityItem & { _t: number };
    });
  const aItems = activities.map((a) => ({
    id: `a-${a.id}`,
    title: a.name || 'Activity',
    meta: a.durationMinutes ? `${a.durationMinutes} min` : 'Activity',
    kcal: Math.round((a.durationMinutes ?? 0) * 8),
    dateLabel: dateLabel(a.date),
    kind: 'activity' as const,
    _t: +new Date(a.date),
  }));
  const recentActivity: ActivityItem[] = [...wItems, ...aItems]
    .sort((x, y) => (y as ActivityItem & { _t: number })._t - (x as ActivityItem & { _t: number })._t)
    .slice(0, 3);

  return {
    loading,
    kcal,
    kcalTarget,
    macros,
    streak,
    week,
    weekNumber: currentWeek,
    today: {
      hasPlan: !!today && !isRest,
      isRest,
      dayLabel: today?.dayLabel ?? 'Rest day',
      exerciseCount: exercises.length,
      estMinutes: Math.max(0, exercises.length * 8),
      muscles,
      completed: !!today?.completedToday,
      routineId: today?.routineId ?? null,
    },
    recentActivity,
  };
}
