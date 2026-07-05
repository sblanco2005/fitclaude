'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { UserProfile, DailyNutrition, NutritionLog, DailyNutritionSummary, RecentNutritionItem } from '@/types';

export type WeekBar = { label: string; magnitude: number; state: 'today' | 'logged' | 'future' };

export type MealItem = {
  id: string;
  name: string;
  mealType: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealEdit = {
  rawInput?: string;
  mealType?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
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
  weekDeficit: number; // Σ(target − consumed) across the week (positive = deficit)
  weekKg: number; // weekDeficit / 7700
  weekBars: WeekBar[];
  refetch: () => Promise<void>;
  logText: (text: string) => Promise<void>;
  logBarcode: (code: string) => Promise<'logged' | 'notfound' | 'error'>;
  editMeal: (id: string, patch: MealEdit) => Promise<boolean>;
  deleteMeal: (id: string) => Promise<boolean>;
  closeDay: () => Promise<boolean>;
  recentItems: RecentNutritionItem[];
  recentLoading: boolean;
  fetchRecent: () => Promise<void>;
  logRecent: (item: RecentNutritionItem) => Promise<boolean>;
  logging: boolean;
};

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
const dateKey = (d: Date | string) => new Date(d).toLocaleDateString('en-CA');

const stripTags = (s: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export function useNutrition(): NutritionData {
  const { dataVersion } = useFitClaude();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [summaries, setSummaries] = useState<DailyNutritionSummary[]>([]);
  const [recentItems, setRecentItems] = useState<RecentNutritionItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [localVersion, setLocalVersion] = useState(0);
  const autoClosed = useRef(false);

  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  const bump = () => setLocalVersion((v) => v + 1);

  // Close any prior un-summarized days, once per mount.
  useEffect(() => {
    if (autoClosed.current) return;
    autoClosed.current = true;
    fetch('/api/nutrition/auto-close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz() }),
    }).then(() => bump()).catch(() => {});
  }, []);

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
      const [p, n, s] = await Promise.all([
        fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/nutrition/today?tz=${encodeURIComponent(tz())}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/nutrition/summaries?daysBack=14').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      if (cancelled) return;
      setProfile(p);
      setToday(n);
      setSummaries(Array.isArray(s) ? s : []);
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

  const logBarcode = useCallback(async (code: string): Promise<'logged' | 'notfound' | 'error'> => {
    const clean = code.trim();
    if (!clean) return 'error';
    setLogging(true);
    try {
      const look = await fetch(`/api/nutrition/barcode?barcode=${encodeURIComponent(clean)}`);
      const data = look.ok ? await look.json() : null;
      if (!data?.found || !data.food) return 'notfound';
      const f = data.food;
      const post = await fetch('/api/nutrition/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          calories: f.calories,
          proteinG: f.proteinG,
          carbsG: f.carbsG,
          fatG: f.fatG,
          servingUnit: f.servingUnit,
          quantity: 1,
          timezone: tz(),
        }),
      });
      return post.ok ? 'logged' : 'error';
    } catch {
      return 'error';
    } finally {
      setLogging(false);
      setLocalVersion((v) => v + 1);
    }
  }, []);

  const editMeal = useCallback(async (id: string, patch: MealEdit): Promise<boolean> => {
    try {
      const r = await fetch(`/api/nutrition/log/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      bump();
    }
  }, []);

  const deleteMeal = useCallback(async (id: string): Promise<boolean> => {
    try {
      const r = await fetch(`/api/nutrition/log/${id}`, { method: 'DELETE' });
      return r.ok;
    } catch {
      return false;
    } finally {
      bump();
    }
  }, []);

  const closeDay = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/nutrition/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz() }),
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      bump();
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const r = await fetch('/api/nutrition/recent-items?days=14&limit=50');
      const data = r.ok ? await r.json() : null;
      setRecentItems(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
    } catch {
      setRecentItems([]);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const logRecent = useCallback(async (item: RecentNutritionItem): Promise<boolean> => {
    try {
      const r = await fetch('/api/nutrition/log-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        }),
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      bump();
    }
  }, []);

  const kcalTarget = profile?.dailyCalorieTarget ?? 2200;
  const totals = today?.totals;
  const kcal = Math.round(totals?.calories ?? 0);

  // ---- Weekly deficit (Mon–Sun of the current week) ----
  const todayWd = mondayIndex(new Date());
  const summaryByDay = new Map<string, number>();
  summaries.forEach((s) => summaryByDay.set(dateKey(s.date), s.calories));
  const monday = new Date();
  monday.setDate(monday.getDate() - todayWd);
  let weekDeficit = 0;
  const weekBars: WeekBar[] = WEEK_LABELS.map((label, wd) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + wd);
    const isToday = wd === todayWd;
    const consumed = isToday ? kcal : summaryByDay.get(dateKey(d));
    if (consumed == null) return { label, magnitude: 0, state: 'future' as const };
    weekDeficit += kcalTarget - consumed;
    return { label, magnitude: Math.abs(kcalTarget - consumed), state: isToday ? ('today' as const) : ('logged' as const) };
  });
  const weekKg = weekDeficit / 7700;
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
    weekDeficit: Math.round(weekDeficit),
    weekKg,
    weekBars,
    refetch,
    logText,
    logBarcode,
    editMeal,
    deleteMeal,
    closeDay,
    recentItems,
    recentLoading,
    fetchRecent,
    logRecent,
    logging,
  };
}
