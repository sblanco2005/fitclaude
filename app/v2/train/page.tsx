'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkouts, type RoutineCard } from '@/components/redesign/workouts/useWorkouts';
import { ScreenHeader, FilterChips } from '@/components/redesign/ui';
import { PlusIcon, SpinIcon, TrainIcon } from '@/components/redesign/icons';

// Screen 05 · Workouts ("Train") — accent: ember
const CAT_COLOR: Record<string, { color: string; tint: string }> = {
  lifting: { color: 'var(--rd-violet)', tint: 'rgba(155,123,255,.16)' },
  hiit: { color: 'var(--rd-lime)', tint: 'rgba(200,255,77,.14)' },
  cardio: { color: 'var(--rd-amber)', tint: 'rgba(255,178,62,.14)' },
};
const catStyle = (c: string) => CAT_COLOR[(c || '').toLowerCase()] ?? { color: 'var(--rd-ember)', tint: 'rgba(255,107,69,.14)' };

export default function TrainPage() {
  const w = useWorkouts();
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [starting, setStarting] = useState(false);

  const chips = useMemo(() => ['All', ...w.categories], [w.categories]);
  const list = filter === 'All' ? w.routines : w.routines.filter((r) => r.category.toLowerCase() === filter.toLowerCase());

  const featuredRoutine = w.routines.find((r) => r.latestId === w.featured?.latestId);

  const hitIt = async (latestId: string | null) => {
    if (!latestId || starting) return;
    setStarting(true);
    const id = await w.startSession(latestId);
    setStarting(false);
    if (id) router.push(`/v2/train/session/${id}`);
  };

  return (
    <div className="animate-fadeup space-y-4 pb-2">
      <ScreenHeader
        eyebrow={`${w.routines.length} routines`}
        title="Your workouts"
        right={
          <Link
            href="/v2/coach"
            aria-label="New routine"
            className="grad-ember flex h-9 w-9 items-center justify-center rounded-[11px] text-[#0A0C10]"
            style={{ boxShadow: 'var(--rd-glow-ember)' }}
          >
            <PlusIcon size={18} />
          </Link>
        }
      />

      <FilterChips options={chips} value={filter} onChange={setFilter} accent="var(--rd-ember)" />

      {/* Featured next-up */}
      {w.featured && (
        <section
          className="relative overflow-hidden rounded-[20px] border p-5"
          style={{ borderColor: 'rgba(255,107,69,.32)', background: 'rgba(255,107,69,.06)' }}
        >
          <div className="flex items-start justify-between">
            <p className="font-label text-[10px] tracking-[.16em] text-[var(--rd-ember)]">
              {w.featured.completed ? 'COMPLETED' : 'NEXT UP'}
              {w.featured.displayId != null && ` · #${w.featured.displayId}`}
            </p>
            {w.featured.estMinutes > 0 && (
              <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{w.featured.estMinutes} min</span>
            )}
          </div>
          <h2 className="font-display mt-1.5 text-[21px] font-bold text-[var(--rd-ink)]">{w.featured.routineName}</h2>
          {w.featured.muscles.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {w.featured.muscles.map((m) => (
                <span
                  key={m}
                  className="font-label rounded-[8px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-2 py-1 text-[10px] capitalize text-[var(--rd-text-secondary)]"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => hitIt(w.featured?.latestId ?? null)}
              disabled={!w.featured.latestId || starting}
              className="grad-ember relative flex h-11 flex-1 items-center justify-center overflow-hidden rounded-[13px] text-[14px] font-semibold text-[#0A0C10] disabled:opacity-60"
              style={{ boxShadow: 'var(--rd-glow-ember)' }}
            >
              <span className="relative z-10">{starting ? 'Starting…' : 'Hit it'}</span>
              {!starting && (
                <span
                  aria-hidden
                  className="animate-sheen absolute inset-y-0 -left-1/3 z-0 w-1/3"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }}
                />
              )}
            </button>
            {featuredRoutine && (
              <button
                onClick={() => w.spin(featuredRoutine)}
                disabled={w.busy === featuredRoutine.key}
                className="flex h-11 items-center gap-1.5 rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 text-[14px] font-semibold text-[var(--rd-text-secondary)]"
              >
                <SpinIcon size={15} className={w.busy === featuredRoutine.key ? 'animate-spinslow' : ''} />
                Spin
              </button>
            )}
          </div>
        </section>
      )}

      {/* Routine list */}
      {w.loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rd-card h-[72px] animate-pulse-soft" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rd-card p-6 text-center">
          <p className="text-[13px] text-[var(--rd-text-muted)]">No routines yet.</p>
          <p className="mt-1 text-[12px] text-[var(--rd-text-faint)]">Ask the coach to generate one.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => (
            <RoutineRow key={r.key} r={r} onSpin={() => w.spin(r)} spinning={w.busy === r.key} onOpen={() => router.push(`/v2/train/routine/${r.latestId}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineRow({ r, onSpin, spinning, onOpen }: { r: RoutineCard; onSpin: () => void; spinning: boolean; onOpen: () => void }) {
  const s = catStyle(r.category);
  return (
    <div className="rd-card flex items-center gap-3 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]" style={{ background: s.tint, color: s.color }}>
        <TrainIcon size={20} />
      </span>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[14px] font-semibold text-[var(--rd-ink)]">{r.name}</p>
        <p className="font-label mt-0.5 text-[11px] capitalize text-[var(--rd-text-faint)]">
          {r.exerciseCount} exercises{r.muscles.length ? ` · ${r.muscles.join(', ')}` : ''}
        </p>
      </button>
      <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{r.estMinutes}m</span>
      <button onClick={onSpin} aria-label="Spin" className="text-[var(--rd-text-muted)]">
        <SpinIcon size={16} className={spinning ? 'animate-spinslow' : ''} />
      </button>
    </div>
  );
}
