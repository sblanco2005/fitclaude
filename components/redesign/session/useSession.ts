'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Workout, WorkoutExercise } from '@/types';
import { LB_PER_KG, lbToKg, kgToLb, formatWeight, buildSetLogs, sessionVolumeLb } from './weightMath';

// Weights are canonicalized to POUNDS (matches V1) so Last/PR from history are
// consistent. Conversion/log helpers live in ./weightMath (unit-tested); re-export
// the ones existing imports use.
export { LB_PER_KG, lbToKg, kgToLb, formatWeight };

export type PriorSet = { weight: number; reps: number }; // weight in lb

export type SetEntry = {
  weightLb: number; // total lifted, in lb (canonical, matches V1 storage)
  reps: number;
  done: boolean;
  lastWeightLb?: number;
  lastReps?: number;
};

export type SessionExercise = {
  woExerciseId: string;
  name: string;
  muscle: string;
  equipment: string;
  isBarbell: boolean;
  youtubeUrl?: string;
  youtubeId?: string;
  gifUrl?: string;
  lastSets: PriorSet[];
  pr: PriorSet | null;
  sets: SetEntry[];
};

// ── Cardio session (no weights — time / distance / reps per segment) ──────────
export type DistUnit = 'm' | 'km' | 'mi';
export type SegmentLog = { durationSec: number; distance: number; distanceUnit: DistUnit; reps: number | null; done: boolean };
export type SessionSegment = {
  woExerciseId: string;
  name: string;
  youtubeUrl?: string;
  youtubeId?: string;
  gifUrl?: string;
  target: { durationSec: number | null; distance: number | null; distanceUnit: DistUnit | null; reps: number | null };
  rounds: SegmentLog[]; // one per round (sets = rounds)
};

const parseFirstInt = (s: string | null | undefined, fallback: number): number => {
  const m = (s ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : fallback;
};

const exName = (e: WorkoutExercise) => (e.exercise?.name || e.variation?.name || 'Exercise');

// Parse a setLogs JSON blob to an array, tolerating legacy DOUBLE-encoded values.
function parseJsonArray(raw: string | null | undefined): unknown[] {
  try {
    let v = raw ? JSON.parse(raw) : [];
    if (typeof v === 'string') v = JSON.parse(v); // legacy double-encoded
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseSetLogs(raw: string | null | undefined): PriorSet[] {
  return parseJsonArray(raw).map((l) => {
    const o = l as { weight?: number; reps?: number };
    return { weight: Number(o.weight) || 0, reps: Number(o.reps) || 0 };
  });
}

// Build per-exercise "last session" sets + all-time PR from workout history.
function buildHistory(all: Workout[], currentId: string) {
  const sorted = [...all].sort((a, b) => +new Date(b.date || b.createdAt) - +new Date(a.date || a.createdAt));
  const lastByName = new Map<string, PriorSet[]>();
  const prByName = new Map<string, PriorSet>();
  for (const w of sorted) {
    for (const we of w.exercises ?? []) {
      const name = exName(we).toLowerCase();
      const logs = parseSetLogs(we.setLogs);
      if (!logs.length) continue;
      if (w.id !== currentId && !lastByName.has(name)) lastByName.set(name, logs);
      for (const l of logs) {
        if (l.weight <= 0) continue;
        const best = prByName.get(name);
        if (!best || l.weight > best.weight || (l.weight === best.weight && l.reps > best.reps)) {
          prByName.set(name, { weight: l.weight, reps: l.reps });
        }
      }
    }
  }
  return { lastByName, prByName };
}

function buildExercises(w: Workout, lastByName: Map<string, PriorSet[]>, prByName: Map<string, PriorSet>): SessionExercise[] {
  return (w.exercises ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const name = exName(e);
      const key = name.toLowerCase();
      const last = lastByName.get(key) ?? [];
      const pr = prByName.get(key) ?? null;
      const setCount = Math.max(1, e.sets || 1);
      const targetReps = parseFirstInt(e.reps, 8);
      const templateLb = e.weightKg != null ? kgToLb(e.weightKg) : 0;
      const equipment = e.exercise?.equipmentRequired ?? '';
      const sets: SetEntry[] = Array.from({ length: setCount }, (_, i) => {
        const ref = last[i];
        return {
          weightLb: ref?.weight ?? templateLb ?? 0,
          reps: ref?.reps ?? targetReps,
          done: false,
          lastWeightLb: ref?.weight,
          lastReps: ref?.reps,
        };
      });
      const video = e.exercise?.videos?.[0];
      return {
        woExerciseId: e.id,
        name,
        muscle: e.exercise?.muscleGroup ?? '',
        equipment,
        isBarbell: /barbell/i.test(name) || /barbell/i.test(equipment),
        youtubeUrl: video ? `https://youtube.com/watch?v=${video.youtubeVideoId}` : undefined,
        youtubeId: video?.youtubeVideoId,
        gifUrl: e.exercise?.gifUrl ?? undefined,
        lastSets: last,
        pr,
        sets,
      };
    });
}

type CardioRound = { durationSec: number; distance: number; distanceUnit: DistUnit; reps: number | null };
function parseCardioLogs(raw: string | null | undefined): CardioRound[] {
  return parseJsonArray(raw).map((l) => {
    const o = l as { durationSec?: number; distance?: number; distanceUnit?: string; reps?: number | null };
    return {
      durationSec: Number(o.durationSec) || 0,
      distance: Number(o.distance) || 0,
      distanceUnit: (o.distanceUnit as DistUnit) || 'm',
      reps: o.reps == null ? null : Number(o.reps),
    };
  });
}

// Last actuals per cardio segment (most recent completed session).
function buildCardioLast(all: Workout[], currentId: string): Map<string, CardioRound[]> {
  const sorted = [...all].sort((a, b) => +new Date(b.date || b.createdAt) - +new Date(a.date || a.createdAt));
  const lastByName = new Map<string, CardioRound[]>();
  for (const w of sorted) {
    if (w.id === currentId) continue;
    for (const we of w.exercises ?? []) {
      const name = (we.exercise?.name || we.notes?.split('|')[0] || '').toLowerCase();
      if (!name) continue;
      const logs = parseCardioLogs(we.setLogs);
      if (logs.length && !lastByName.has(name)) lastByName.set(name, logs);
    }
  }
  return lastByName;
}

function buildSegments(w: Workout, lastByName: Map<string, CardioRound[]>): SessionSegment[] {
  return (w.exercises ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const name = e.exercise?.name || e.notes?.split('|')[0] || 'Segment';
      const rounds = Math.max(1, e.sets || 1);
      const target = {
        durationSec: e.durationSeconds ?? null,
        distance: e.distance ?? null,
        distanceUnit: (e.distanceUnit as DistUnit) ?? null,
        reps: e.reps ? (parseInt(e.reps, 10) || null) : null,
      };
      const last = lastByName.get(name.toLowerCase()) ?? [];
      const roundEntries: SegmentLog[] = Array.from({ length: rounds }, (_, i) => {
        const l = last[i];
        return {
          durationSec: l?.durationSec ?? target.durationSec ?? 0,
          distance: l?.distance ?? target.distance ?? 0,
          distanceUnit: (l?.distanceUnit ?? target.distanceUnit ?? 'm') as DistUnit,
          reps: l?.reps ?? target.reps ?? null,
          done: false,
        };
      });
      const video = e.exercise?.videos?.[0];
      return {
        woExerciseId: e.id,
        name,
        youtubeUrl: video ? `https://youtube.com/watch?v=${video.youtubeVideoId}` : undefined,
        youtubeId: video?.youtubeVideoId,
        gifUrl: e.exercise?.gifUrl ?? undefined,
        target,
        rounds: roundEntries,
      };
    });
}

export function useSession(id: string) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [segments, setSegments] = useState<SessionSegment[]>([]);
  const [defaultUnit, setDefaultUnit] = useState<'kg' | 'lb'>('lb');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startedAt] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [wRes, allRes, pRes] = await Promise.all([
        fetch(`/api/workouts/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/workouts?daysBack=90').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      let w: Workout | null = wRes;
      const all: Workout[] = Array.isArray(allRes) ? allRes : [];
      if (!w) w = all.find((x) => x.id === id) ?? null;
      if (cancelled) return;
      setDefaultUnit(pRes?.weightUnit === 'kg' ? 'kg' : 'lb');
      setWorkout(w);
      if (w) {
        if (w.category === 'cardio') {
          setSegments(buildSegments(w, buildCardioLast(all, id)));
        } else {
          const { lastByName, prByName } = buildHistory(all, id);
          setExercises(buildExercises(w, lastByName, prByName));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateSet = useCallback((exIdx: number, setIdx: number, patch: Partial<SetEntry>) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) })),
    );
  }, []);

  const updateSegment = useCallback((segIdx: number, roundIdx: number, patch: Partial<SegmentLog>) => {
    setSegments((prev) =>
      prev.map((seg, i) => (i !== segIdx ? seg : { ...seg, rounds: seg.rounds.map((r, j) => (j !== roundIdx ? r : { ...r, ...patch })) })),
    );
  }, []);

  const addSet = useCallback((exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const ref = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { weightLb: ref?.weightLb ?? 0, reps: ref?.reps ?? 8, done: false }] };
      }),
    );
  }, []);

  const removeSet = useCallback((exIdx: number) => {
    setExercises((prev) => prev.map((ex, i) => (i !== exIdx || ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.slice(0, -1) })));
  }, []);

  // Copy the last edited set into all remaining sets of the exercise
  const fillRemaining = useCallback((exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const src = [...ex.sets].reverse().find((s) => s.weightLb > 0) ?? ex.sets[0];
        return { ...ex, sets: ex.sets.map((s) => ({ ...s, weightLb: src.weightLb, reps: src.reps })) };
      }),
    );
  }, []);

  const removeExercise = useCallback(async (exIdx: number) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));
    fetch(`/api/workouts/${id}/exercises/${ex.woExerciseId}`, { method: 'DELETE' }).catch(() => {});
  }, [exercises, id]);

  const swapExercise = useCallback(async (exIdx: number) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    try {
      const sug = await fetch(`/api/workouts/${id}/exercises/${ex.woExerciseId}/suggest`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!sug?.id) return;
      const r = await fetch(`/api/workouts/${id}/exercises/${ex.woExerciseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newExerciseId: sug.id }),
      });
      if (!r.ok) return;
      const updated = await r.json();
      const eq = updated.exercise?.equipmentRequired || '';
      const nm = updated.exercise?.name || sug.name || ex.name;
      setExercises((prev) =>
        prev.map((e, i) =>
          i !== exIdx
            ? e
            : {
                ...e,
                name: nm,
                muscle: updated.exercise?.muscleGroup || e.muscle,
                equipment: eq,
                isBarbell: /barbell/i.test(nm) || /barbell/i.test(eq),
                youtubeUrl: updated.exercise?.videos?.[0] ? `https://youtube.com/watch?v=${updated.exercise.videos[0].youtubeVideoId}` : undefined,
                youtubeId: updated.exercise?.videos?.[0]?.youtubeVideoId,
                gifUrl: updated.exercise?.gifUrl ?? undefined,
                lastSets: [],
                pr: null,
                sets: e.sets.map((s) => ({ ...s, done: false })),
              },
        ),
      );
    } catch {
      /* ignore */
    }
  }, [exercises, id]);

  const moveExercise = useCallback((exIdx: number, dir: -1 | 1) => {
    setExercises((prev) => {
      const next = [...prev];
      const target = exIdx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[exIdx], next[target]] = [next[target], next[exIdx]];
      fetch(`/api/workouts/${id}/exercises/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map((e) => e.woExerciseId) }),
      }).catch(() => {});
      return next;
    });
  }, [id]);

  const stats = useMemo(() => {
    let volumeLb = 0;
    let setsLogged = 0;
    exercises.forEach((ex) => {
      volumeLb += sessionVolumeLb(ex.sets);
      setsLogged += ex.sets.filter((s) => s.done).length;
    });
    segments.forEach((seg) => { setsLogged += seg.rounds.filter((r) => r.done).length; });
    return { volumeKg: Math.round(lbToKg(volumeLb)), volumeLb: Math.round(volumeLb), setsLogged };
  }, [exercises, segments]);

  const save = useCallback(
    async (fatigueRating: number | null, note: string) => {
      setSaving(true);
      const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const cardio = workout?.category === 'cardio';
      // NOTE: the /log route JSON.stringifies each entry.setLogs, so we send an
      // ARRAY (not a pre-stringified string) — otherwise it double-encodes and
      // history/Last can't be read back.
      const payload = {
        exercises: cardio
          ? segments.map((seg) => ({
              exerciseId: seg.woExerciseId,
              setLogs: seg.rounds.filter((r) => r.done).map((r) => ({ durationSec: r.durationSec, distance: r.distance, distanceUnit: r.distanceUnit, reps: r.reps })),
            }))
          : exercises.map((ex) => ({
              exerciseId: ex.woExerciseId,
              setLogs: buildSetLogs(ex.sets),
            })),
        durationMinutes,
      };
      try {
        const r = await fetch(`/api/workouts/${id}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
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
    [exercises, segments, workout, id, startedAt],
  );

  return {
    loading,
    saving,
    workout,
    isCardio: workout?.category === 'cardio',
    exercises,
    segments,
    defaultUnit,
    updateSet,
    updateSegment,
    addSet,
    removeSet,
    fillRemaining,
    removeExercise,
    swapExercise,
    moveExercise,
    stats,
    startedAt,
    save,
    name: workout?.name?.trim() || workout?.workoutType || 'Workout',
  };
}
