'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Exercise, ExerciseVideoLink } from '@/types';

const consolidate = (m: string): string => {
  const s = (m || '').toLowerCase();
  if (['glutes', 'hamstrings', 'quadriceps', 'quads', 'calves'].includes(s)) return 'Legs';
  if (['biceps', 'triceps', 'forearms'].includes(s)) return 'Arms';
  if (s === 'chest') return 'Chest';
  if (s === 'back') return 'Back';
  if (s === 'shoulders') return 'Shoulders';
  if (s === 'core' || s === 'abs') return 'Core';
  if (s === 'full_body') return 'Full body';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Other';
};

export const primaryVideo = (ex: Exercise): ExerciseVideoLink | null => {
  const vids = ex.videos ?? [];
  return vids.find((v) => v.videoType === 'tutorial' && v.isPrimary) ?? vids.find((v) => v.videoType === 'tutorial') ?? vids[0] ?? null;
};

export const FILTERS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

export function useExercises(filter: string, search: string) {
  const [all, setAll] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/exercises');
        const data = r.ok ? await r.json() : [];
        if (!cancelled) setAll(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setAll([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((ex) => {
      const bucketOk = filter === 'All' || consolidate(ex.muscleGroup) === filter;
      const searchOk = !q || ex.name.toLowerCase().includes(q);
      return bucketOk && searchOk;
    });
  }, [all, filter, search]);

  return { loading, exercises, total: all.length };
}
