'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkouts, type RoutineCard } from '@/components/redesign/workouts/useWorkouts';
import { ScreenHeader, FilterChips } from '@/components/redesign/ui';
import { PlusIcon, SpinIcon, TrainIcon } from '@/components/redesign/icons';

// Screen 05 · Workouts ("Train") — accent: ember
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
        back
        right={
          <Link
            href="/v2/train/add"
            aria-label="Add program"
            className="grad-ember flex h-9 w-9 items-center justify-center rounded-[11px] text-[#0A0C10]"
            style={{ boxShadow: 'var(--rd-glow-ember)' }}
          >
            <PlusIcon size={18} />
          </Link>
        }
      />

      {/* Featured next-up (kept above filters so "Hit it" is always visible) */}
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

      {/* Filters (below the featured hero) */}
      <FilterChips options={chips} value={filter} onChange={setFilter} accent="var(--rd-ember)" />

      {/* Routine grid */}
      {w.loading ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rd-card h-[132px] animate-pulse-soft" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rd-card p-6 text-center">
          <p className="text-[13px] text-[var(--rd-text-muted)]">No routines yet.</p>
          <p className="mt-1 text-[12px] text-[var(--rd-text-faint)]">Ask the coach to generate one.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="font-label text-[11px] tracking-[.1em] text-[var(--rd-text-faint)]">
              ALL ROUTINES · {list.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {list.map((r, i) => (
              <RoutineTile
                key={r.key}
                r={r}
                accent={TILE_ACCENTS[i % TILE_ACCENTS.length]}
                onOpen={() => router.push(`/v2/train/routine/${r.latestId}`)}
                onSpin={() => w.spin(r)}
                spinning={w.busy === r.key}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Accent palette cycled across tiles (violet / amber / lime / ember)
const TILE_ACCENTS = ['155,123,255', '255,178,62', '200,255,77', '255,138,91'];

// Deterministic bar heights from the routine key — a decorative volume/intensity glyph
function volumeBars(key: string, n = 6): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = key.charCodeAt((i * 7) % Math.max(1, key.length)) || 65;
    out.push(35 + ((c * (i + 3)) % 66));
  }
  return out;
}

function RoutineTile({
  r,
  accent,
  onOpen,
  onSpin,
  spinning,
}: {
  r: RoutineCard;
  accent: string; // "r,g,b"
  onOpen: () => void;
  onSpin: () => void;
  spinning: boolean;
}) {
  const bars = volumeBars(r.key);
  const rgb = (a: number) => `rgba(${accent},${a})`;
  return (
    <div
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-[18px] p-3.5"
      style={{ background: rgb(0.06), border: `1px solid ${rgb(0.22)}` }}
    >
      {/* decorative glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3.5 -top-3.5 h-[60px] w-[60px] rounded-full"
        style={{ background: `radial-gradient(circle, ${rgb(0.26)}, transparent 70%)` }}
      />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ background: rgb(0.15), color: `rgb(${accent})` }}>
          <TrainIcon size={18} />
        </span>
        <button onClick={onSpin} aria-label="Spin" className="relative z-10" style={{ color: `rgb(${accent})` }}>
          <SpinIcon size={15} className={spinning ? 'animate-spinslow' : ''} />
        </button>
      </div>
      <button onClick={onOpen} className="relative z-10 text-left">
        <div className="truncate font-display text-[15px] font-bold leading-tight text-[var(--rd-ink)]">{r.name}</div>
        <div className="font-label mt-1 truncate text-[10px] capitalize text-[var(--rd-text-faint)]">
          {r.exerciseCount} ex · {r.estMinutes}m{r.muscles.length ? ` · ${r.muscles[0]}` : ''}
        </div>
      </button>
      <div className="flex h-[22px] items-end gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-[3px]"
            style={{ height: `${h}%`, background: i === bars.length - 3 ? `rgb(${accent})` : rgb(0.4) }}
          />
        ))}
      </div>
    </div>
  );
}
