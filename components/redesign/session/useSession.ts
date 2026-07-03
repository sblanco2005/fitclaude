'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Workout } from '@/types';

export type SetEntry = {
  weightKg: number; // total weight lifted, in kg
  reps: number;
  done: boolean;
  lastWeightKg?: number;
  lastReps?: number;
};

export type SessionExercise = {
  woExerciseId: string; // WorkoutExercise.id — what /log expects
  name: string;
  muscle: string;
  equipment: string;
  isBarbell: boolean;
  youtubeUrl?: string;
  videoDuration?: string;
  sets: SetEntry[];
};

const parseFirstInt = (s: string | null | undefined, fallback: number): number => {
  const m = (s ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : fallback;
};

function buildExercises(w: Workout): SessionExercise[] {
  return (w.exercises ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const setCount = Math.max(1, e.sets || 1);
      const targetReps = parseFirstInt(e.reps, 10);
      const equipment = e.exercise?.equipmentRequired ?? '';
      // last-time reference from prior setLogs, if any
      let last: { weight: number; reps: number }[] = [];
      try {
        if (e.setLogs) last = JSON.parse(e.setLogs);
      } catch {
        last = [];
      }
      const sets: SetEntry[] = Array.from({ length: setCount }, (_, i) => ({
        weightKg: e.weightKg ?? last[i]?.weight ?? 0,
        reps: targetReps,
        done: false,
        lastWeightKg: last[i]?.weight,
        lastReps: last[i]?.reps,
      }));
      const video = e.exercise?.videos?.[0];
      return {
        woExerciseId: e.id,
        name: e.exercise?.name || e.variation?.name || 'Exercise',
        muscle: e.exercise?.muscleGroup ?? '',
        equipment,
        isBarbell: /barbell/i.test(equipment),
        youtubeUrl: video ? `https://youtube.com/watch?v=${video.youtubeVideoId}` : undefined,
        videoDuration: video?.status ? undefined : undefined,
        sets,
      };
    });
}

export function useSession(id: string) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startedAt] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let w: Workout | null = null;
      try {
        const r = await fetch(`/api/workouts/${id}`);
        if (r.ok) w = await r.json();
      } catch {
        w = null;
      }
      if (!w) {
        // fallback: find in recent list
        try {
          const r = await fetch('/api/workouts?daysBack=2');
          const list = r.ok ? await r.json() : [];
          w = (Array.isArray(list) ? list : []).find((x: Workout) => x.id === id) ?? null;
        } catch {
          w = null;
        }
      }
      if (cancelled) return;
      setWorkout(w);
      setExercises(w ? buildExercises(w) : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateSet = useCallback((exIdx: number, setIdx: number, patch: Partial<SetEntry>) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) },
      ),
    );
  }, []);

  const stats = useMemo(() => {
    let volume = 0;
    let setsLogged = 0;
    exercises.forEach((ex) =>
      ex.sets.forEach((s) => {
        if (s.done) {
          setsLogged += 1;
          volume += s.weightKg * s.reps;
        }
      }),
    );
    return { volume: Math.round(volume), setsLogged };
  }, [exercises]);

  const save = useCallback(
    async (fatigueRating: number | null, note: string) => {
      setSaving(true);
      const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const payload = {
        exercises: exercises.map((ex) => ({
          exerciseId: ex.woExerciseId,
          setLogs: JSON.stringify(
            ex.sets.filter((s) => s.done).map((s, i) => ({ set: i + 1, weight: s.weightKg, reps: s.reps })),
          ),
        })),
        durationMinutes,
      };
      try {
        const r = await fetch(`/api/workouts/${id}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // fatigue + coach note aren't handled by /log — persist via workout PATCH
        if (r.ok && (fatigueRating != null || note)) {
          await fetch(`/api/workouts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fatigueRating, notes: note || undefined }),
          }).catch(() => {});
        }
        return r.ok;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [exercises, id, startedAt],
  );

  return {
    loading,
    saving,
    workout,
    exercises,
    updateSet,
    stats,
    startedAt,
    save,
    name: workout?.name?.trim() || workout?.workoutType || 'Workout',
  };
}
