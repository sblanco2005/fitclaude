'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Workout, WorkoutExercise } from '@/types';
import { CheckIcon, ChevronLeftIcon, SpinIcon, LibraryIcon, SearchIcon, CloseIcon } from '@/components/redesign/icons';

type LibEx = { id: string; name: string; muscleGroup: string; exerciseType: string };

// Screen 09 · Workout Detail — accent: ember
const titleCase = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [w, setW] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  // Library picker
  const [libFor, setLibFor] = useState<WorkoutExercise | null>(null);
  const [lib, setLib] = useState<LibEx[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libSearch, setLibSearch] = useState('');

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

  // Reorder — optimistic, then persist the full order.
  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= exercises.length) return;
    const next = [...exercises];
    [next[idx], next[j]] = [next[j], next[idx]];
    setW((prev) => (prev ? { ...prev, exercises: next.map((e, i) => ({ ...e, order: i + 1 })) } : prev));
    await fetch(`/api/workouts/${id}/exercises/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map((e) => e.id) }),
    }).catch(() => {});
  };

  const openLibrary = async (e: WorkoutExercise) => {
    setLibFor(e);
    setLibSearch('');
    setLibLoading(true);
    const list = await fetch('/api/exercises').then((x) => (x.ok ? x.json() : [])).catch(() => []);
    setLib(Array.isArray(list) ? list : []);
    setLibLoading(false);
  };

  const pickFromLibrary = async (exerciseId: string) => {
    if (!libFor) return;
    const target = libFor.id;
    setLibFor(null);
    setSwapping(target);
    try {
      await fetch(`/api/workouts/${id}/exercises/${target}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newExerciseId: exerciseId }),
      });
      await load();
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

  const libFiltered = libSearch.trim()
    ? lib.filter((x) => x.name.toLowerCase().includes(libSearch.trim().toLowerCase()) || x.muscleGroup.includes(libSearch.trim().toLowerCase()))
    : lib;

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
        <Chip lime><CheckIcon size={12} /> Ready</Chip>
      </div>

      {/* Hit it */}
      <button
        onClick={hitIt}
        disabled={starting}
        className="grad-ember relative flex h-12 w-full items-center justify-center overflow-hidden rounded-[14px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60"
        style={{ boxShadow: 'var(--rd-glow-ember)' }}
      >
        <span className="relative z-10">{starting ? 'Starting…' : 'Hit it'}</span>
        {!starting && <span aria-hidden className="animate-sheen absolute inset-y-0 -left-1/3 z-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }} />}
      </button>

      {/* Exercise rows */}
      <div className="space-y-2.5">
        {exercises.map((e, i) => (
          <div key={e.id} className="rd-card flex items-center gap-3 p-3.5">
            <span className="font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--rd-card)] text-[13px] font-bold text-[var(--rd-text-muted)]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[var(--rd-ink)]">{e.exercise?.name || e.variation?.name || 'Exercise'}</p>
              <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">
                {e.sets} × {e.reps ?? '–'}
                {e.weightKg ? ` · ${Math.round(e.weightKg)} kg` : ''}
                {e.restSeconds ? ` · rest ${e.restSeconds}s` : ''}
              </p>
            </div>

            {/* Reorder */}
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-[var(--rd-text-muted)] disabled:opacity-20">
                <ChevronLeftIcon size={16} className="rotate-90" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label="Move down" className="text-[var(--rd-text-muted)] disabled:opacity-20">
                <ChevronLeftIcon size={16} className="-rotate-90" />
              </button>
            </div>

            {/* Replace from library */}
            <button onClick={() => openLibrary(e)} disabled={swapping === e.id} aria-label="Replace exercise" className="shrink-0 text-[var(--rd-text-muted)]">
              {swapping === e.id ? <SpinIcon size={17} className="animate-spinslow" /> : <LibraryIcon size={17} />}
            </button>
          </div>
        ))}
      </div>

      {/* Library picker */}
      {libFor && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setLibFor(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
          <div className="relative flex max-h-[80%] w-full flex-col overflow-hidden rounded-t-[24px] border-t border-[var(--rd-border)] pb-6" style={{ background: '#0F1117' }} onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pb-1 pt-5">
              <div>
                <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">REPLACING</p>
                <h3 className="font-display mt-0.5 text-[18px] font-bold text-[var(--rd-ink)]">{libFor.exercise?.name || 'Exercise'}</h3>
              </div>
              <button onClick={() => setLibFor(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <div className="px-5 pb-3 pt-3">
              <div className="flex items-center gap-2 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3.5 py-2.5">
                <SearchIcon size={17} className="text-[var(--rd-text-faint)]" />
                <input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search exercises…" autoFocus className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none" />
              </div>
            </div>
            <div className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-5">
              {libLoading ? (
                <p className="py-8 text-center text-[13px] text-[var(--rd-text-faint)]">Loading…</p>
              ) : libFiltered.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[var(--rd-text-faint)]">No matches.</p>
              ) : (
                libFiltered.map((x) => (
                  <button key={x.id} onClick={() => pickFromLibrary(x.id)} className="flex w-full items-center justify-between rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-left active:bg-[var(--rd-card-glass-hover)]">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--rd-ink)]">{x.name}</span>
                      <span className="font-label block text-[11px] capitalize text-[var(--rd-text-faint)]">{x.muscleGroup} · {x.exerciseType}</span>
                    </span>
                    {x.name === libFor.exercise?.name && <CheckIcon size={16} className="shrink-0 text-[var(--rd-lime)]" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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
