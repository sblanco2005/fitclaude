'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LoggedMeal, GeneratedRoutine } from './ChatCards';

export type CoachMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meal?: LoggedMeal;
  routine?: GeneratedRoutine;
};

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
let localId = 0;
const nextId = () => `local-${localId++}`;

async function buildMealCard(logId: string): Promise<LoggedMeal | undefined> {
  try {
    const r = await fetch(`/api/nutrition/today?tz=${encodeURIComponent(tz())}`);
    if (!r.ok) return undefined;
    const data = await r.json();
    const log = (data.logs ?? []).find((l: { id: string }) => l.id === logId);
    if (!log) return undefined;
    return {
      mealType: log.mealType ?? undefined,
      calories: log.calories ?? 0,
      proteinG: log.proteinG ?? 0,
      carbsG: log.carbsG ?? 0,
      fatG: log.fatG ?? 0,
    };
  } catch {
    return undefined;
  }
}

async function buildRoutineCard(workoutId: string): Promise<GeneratedRoutine | undefined> {
  try {
    const r = await fetch('/api/workouts?daysBack=2');
    if (!r.ok) return undefined;
    const list = await r.json();
    const w = (Array.isArray(list) ? list : []).find((x: { id: string }) => x.id === workoutId);
    if (!w) return undefined;
    const spicy = (w.exercises ?? [])
      .map((e: { variation?: { spicyLevel?: number } | null }) => e.variation?.spicyLevel ?? 0)
      .reduce((a: number, b: number) => Math.max(a, b), 0);
    return {
      name: w.name?.trim() || w.workoutType || 'Routine',
      spicyLevel: spicy || undefined,
      moves: (w.exercises ?? []).map((e: { exercise?: { name?: string } | null; variation?: { name?: string } | null; sets?: number; reps?: string | null }) => ({
        name: e.exercise?.name || e.variation?.name || 'Exercise',
        sets: e.sets,
        reps: e.reps ?? undefined,
      })),
    };
  } catch {
    return undefined;
  }
}

export type CoachContext = 'workout' | 'nutrition';

export function useCoachChat(context: CoachContext = 'workout') {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/chat/history?topic=${context}`);
        if (r.ok) {
          const hist = await r.json();
          setMessages(
            (Array.isArray(hist) ? hist : []).map((m: { id: string; role: 'user' | 'assistant'; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })),
          );
        }
      } finally {
        setHistoryLoaded(true);
        scrollToBottom();
      }
    })();
  }, [scrollToBottom, context]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || loading) return;
      setMessages((m) => [...m, { id: nextId(), role: 'user', content: clean }]);
      setLoading(true);
      scrollToBottom();
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: clean, topic: context, timezone: tz() }),
        });
        const data = r.ok ? await r.json() : { response: 'Something went wrong. Try again.' };
        const [meal, routine] = await Promise.all([
          data.nutrition_log_id ? buildMealCard(data.nutrition_log_id) : Promise.resolve(undefined),
          data.workout_id ? buildRoutineCard(data.workout_id) : Promise.resolve(undefined),
        ]);
        setMessages((m) => [
          ...m,
          {
            id: data.assistantMessageId ?? nextId(),
            role: 'assistant',
            content: data.response ?? data.message ?? '',
            meal,
            routine,
          },
        ]);
      } catch {
        setMessages((m) => [...m, { id: nextId(), role: 'assistant', content: 'Network error. Try again.' }]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [loading, scrollToBottom, context],
  );

  return { messages, loading, historyLoaded, send, listRef };
}
