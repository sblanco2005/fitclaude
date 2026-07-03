'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Workout } from '@/types';
import { CheckIcon, ChevronLeftIcon, SpinIcon } from '@/components/redesign/icons';

// Screen 09 · Workout Detail — accent: ember
const titleCase = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [w, setW] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`/api/workouts/${id}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setW(r);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const exercises = (w?.exercises ?? []).slice().sort((a, b) => a.order - b.order);
  const estMin = Math.max(0, exercises.length * 8);
  const name = titleCase(w?.name?.trim() || w?.workoutType) || 'Workout';

  const hitIt = async () => {
    if (starting) return;
    setStarting(true);
    const r = await fetch(`/api/workouts/${id}/duplicate`, { method: 'POST' }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setStarting(false);
    if (r?.id) router.push(`/v2/train/session/${r.id}`);
  };

  const swap = async (woExId: string) => {
    setSwapping(woExId);
    try {
      const sug = await fetch(`/api/workouts/${id}/exercises/${woExId}/suggest`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (sug?.id) {
        await fetch(`/api/workouts/${id}/exercises/${woExId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newExerciseId: sug.id }),
        });
        await load();
      }
    } finally {
      setSwapping(null);
    }
  };

  if (loading) return <div className="rd-card mt-6 h-[400px] animate-pulse-soft" />;
  if (!w) {
    return (
      <div className="rd-card mt-10 p-6 text-center">
        <p className="text-[14px] text-[var(--rd-text-muted)]">Routine not found.</p>
        <button onClick={() => router.push('/v2/train')} className="mt-3 text-[13px] font-semibold text-[var(--rd-ember)]">Back to Train</button>
      </div>
    );
  }

  return (
    <div className="animate-fadeup space-y-4">
      {/* Top */}
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => router.push('/v2/train')} aria-label="Back" className="text-[var(--rd-text-muted)]">
          <ChevronLeftIcon size={22} />
        </button>
        <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">
          {w.displayId != null ? `#${w.displayId} · ` : ''}{titleCase(w.workoutType)}
        </p>
        <span className="w-[22px]" />
      </div>

      <h1 className="font-display text-[25px] font-bold text-[var(--rd-ink)]">{name}</h1>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        <Chip>{exercises.length} exercises</Chip>
        <Chip>~{estMin} min</Chip>
        <Chip lime>
          <CheckIcon size={12} /> Ready
        </Chip>
      </div>

      {/* Exercise rows */}
      <div className="space-y-2.5">
        {exercises.map((e, i) => (
          <div key={e.id} className="rd-card flex items-center gap-3 p-3.5">
            <span className="font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--rd-card)] text-[13px] font-bold text-[var(--rd-text-muted)]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[var(--rd-ink)]">
                {e.exercise?.name || e.variation?.name || 'Exercise'}
              </p>
              <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">
                {e.sets} × {e.reps ?? '–'}
                {e.weightKg ? ` · ${Math.round(e.weightKg)} kg` : ''}
                {e.restSeconds ? ` · rest ${e.restSeconds}s` : ''}
              </p>
            </div>
            <button onClick={() => swap(e.id)} aria-label="Swap" className="text-[var(--rd-text-muted)]">
              <SpinIcon size={16} className={swapping === e.id ? 'animate-spinslow' : ''} />
            </button>
          </div>
        ))}
      </div>

      {/* Hit it */}
      <button
        onClick={hitIt}
        disabled={starting}
        className="grad-ember relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-[14px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60"
        style={{ boxShadow: 'var(--rd-glow-ember)' }}
      >
        <span className="relative z-10">{starting ? 'Starting…' : 'Hit it'}</span>
        {!starting && (
          <span aria-hidden className="animate-sheen absolute inset-y-0 -left-1/3 z-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }} />
        )}
      </button>
    </div>
  );
}

function Chip({ children, lime }: { children: React.ReactNode; lime?: boolean }) {
  return (
    <span
      className="font-label flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium"
      style={{
        borderColor: lime ? 'rgba(200,255,77,.3)' : 'var(--rd-border)',
        color: lime ? 'var(--rd-lime)' : 'var(--rd-text-muted)',
        background: 'var(--rd-card-glass)',
      }}
    >
      {children}
    </span>
  );
}
