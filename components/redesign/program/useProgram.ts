'use client';

import { useEffect, useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { TrainingProgram, ProgramDay, DayType } from '@/types';

export type SimpleDay = { weekday: number; weekNumber: number; dayType: DayType; dayLabel: string };
export type ProgramSummary = {
  id: string;
  name: string | null;
  isActive: boolean;
  totalWeeks: number;
  currentWeek: number;
  days: SimpleDay[];
  source?: { name: string | null; username: string | null } | null;
};

export const DAY_ACCENT: Record<DayType, string> = {
  coached: '255,107,69',   // ember
  pt_session: '155,123,255', // violet
  class: '255,178,62',     // amber
  rest: '95,100,112',      // faint
};
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  coached: 'Coach Fit',
  pt_session: 'My Own',
  class: 'Class',
  rest: 'Rest',
};

// Cardio days are stored as dayType:'coached' + workoutType:'cardio'; surface them
// with their own accent/label.
export const CARDIO_ACCENT = '34,211,238'; // cyan
export const isCardioDay = (d: { workoutType?: string | null }) => d.workoutType === 'cardio';
export const dayAccent = (d: { dayType: DayType; workoutType?: string | null }) =>
  isCardioDay(d) ? CARDIO_ACCENT : DAY_ACCENT[d.dayType];
export const dayTypeLabel = (d: { dayType: DayType; workoutType?: string | null }) =>
  isCardioDay(d) ? 'Cardio' : DAY_TYPE_LABEL[d.dayType];

// JS getDay() Sun=0..Sat=6 → program weekday Mon=0..Sun=6
export const todayWeekdayMon = () => {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
};

export function useProgram() {
  const { dataVersion } = useFitClaude();
  const [active, setActive] = useState<TrainingProgram | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [a, list] = await Promise.all([
        fetch('/api/program', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/program/list', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      if (cancelled) return;
      setActive(a?.id ? a : null);
      setPrograms(Array.isArray(list) ? list : []);
      setLoading(false);
    };
    load();
    // Refetch on return so the screen reflects changes made elsewhere.
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

  return { loading, active, programs };
}

// Muscle/subtitle helper for a coached day (from its exercise template)
export function daySubtitle(day: ProgramDay): string {
  if (day.dayType === 'rest') return '';
  if (day.dayType === 'pt_session') return 'Log your own workout';
  if (day.dayType === 'class') return 'Log when done';
  const ex = day.exerciseTemplate ?? [];
  if (isCardioDay(day)) {
    const names = ex.map((e) => e.name).filter(Boolean).slice(0, 3);
    return names.length ? names.join(' · ') : `${ex.length} segment${ex.length === 1 ? '' : 's'}`;
  }
  const muscles = Array.from(new Set(ex.map((e) => e.muscle_group).filter(Boolean))).slice(0, 3);
  if (muscles.length) return muscles.join(', ');
  return ex.length ? `${ex.length} exercises` : 'Coached';
}
