'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { UserProfile, DailyNutrition, NutritionLog } from '@/types';

export type MealItem = {
  id: string;
  name: string;
  mealType: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type NutritionData = {
  loading: boolean;
  kcal: number;
  kcalTarget: number;
  remaining: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  closed: boolean;
  meals: MealItem[];
  refetch: () => Promise<void>;
  logText: (text: string) => Promise<void>;
  logging: boolean;
};

const stripTags = (s: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export function useNutrition(): NutritionData {
  const { dataVersion } = useFitClaude();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [localVersion, setLocalVersion] = useState(0);

  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/nutrition/today?tz=${encodeURIComponent(tz())}`);
      if (r.ok) setToday(await r.json());
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, n] = await Promise.all([
        fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/nutrition/today?tz=${encodeURIComponent(tz())}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (cancelled) return;
      setProfile(p);
      setToday(n);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataVersion, localVersion]);

  const logText = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLogging(true);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, topic: 'nutrition', timezone: tz() }),
      });
    } catch {
      /* ignore; refetch will reflect state */
    } finally {
      setLogging(false);
      setLocalVersion((v) => v + 1); // trigger refetch of profile+today
    }
  }, []);

  const kcalTarget = profile?.dailyCalorieTarget ?? 2200;
  const totals = today?.totals;
  const kcal = Math.round(totals?.calories ?? 0);
  const meals: MealItem[] = (today?.logs ?? []).map((l: NutritionLog) => ({
    id: l.id,
    name: stripTags(l.rawInput) || 'Meal',
    mealType: l.mealType,
    calories: Math.round(l.calories ?? 0),
    proteinG: Math.round(l.proteinG ?? 0),
    carbsG: Math.round(l.carbsG ?? 0),
    fatG: Math.round(l.fatG ?? 0),
  }));

  return {
    loading,
    kcal,
    kcalTarget,
    remaining: kcalTarget - kcal,
    proteinG: Math.round(totals?.proteinG ?? 0),
    carbsG: Math.round(totals?.carbsG ?? 0),
    fatG: Math.round(totals?.fatG ?? 0),
    closed: !!today?.closed,
    meals,
    refetch,
    logText,
    logging,
  };
}
