'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkouts, type RoutineCard, type RoutineGroup } from '@/components/redesign/workouts/useWorkouts';
import { ScreenHeader } from '@/components/redesign/ui';
import { PlusIcon, SearchIcon, SpinIcon, TrainIcon, ChevronLeftIcon } from '@/components/redesign/icons';

// Screen 05 · Workouts ("Train") — grouped layout (Option A)
export default function TrainPage() {
  const w = useWorkouts();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const q = search.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!q) return w.routineGroups;
    return w.routineGroups
      .map((g) => ({ ...g, routines: g.routines.filter((r) => r.name.toLowerCase().includes(q) || r.muscles.some((m) => m.includes(q))) }))
      .filter((g) => g.routines.length > 0);
  }, [w.routineGroups, q]);

  const toggle = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="animate-fadeup space-y-4 pb-2">
      <ScreenHeader
        eyebrow={`${w.routines.length} routines · ${w.routineGroups.length} groups`}
        title="Your workouts"
        back
        right={
          <Link href="/v2/program?new=1" aria-label="Add program" className="grad-ember flex h-10 w-10 items-center justify-center rounded-[13px] text-[#0A0C10]" style={{ boxShadow: 'var(--rd-glow-ember)' }}>
            <PlusIcon size={19} />
          </Link>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-2 rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3.5 py-2.5">
        <SearchIcon size={17} className="text-[var(--rd-text-faint)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search routines…"
          className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
        />
      </div>

      {/* Groups */}
      {w.loading ? (
        <div className="space-y-2.5">{[0, 1, 2].map((i) => <div key={i} className="rd-card h-[76px] animate-pulse-soft" />)}</div>
      ) : groups.length === 0 ? (
        <div className="rd-card p-6 text-center">
          <p className="text-[13px] text-[var(--rd-text-muted)]">{q ? 'No routines match.' : 'No routines yet.'}</p>
          {!q && <p className="mt-1 text-[12px] text-[var(--rd-text-faint)]">Ask the coach to generate one.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <Group key={g.id} group={g} collapsed={!q && collapsed.has(g.id)} onToggle={() => toggle(g.id)} onOpen={(r) => router.push(`/v2/train/routine/${r.latestId}`)} onSpin={(r) => w.spin(r)} busyKey={w.busy} />
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ group, collapsed, onToggle, onOpen, onSpin, busyKey }: {
  group: RoutineGroup; collapsed: boolean; onToggle: () => void; onOpen: (r: RoutineCard) => void; onSpin: (r: RoutineCard) => void; busyKey: string | null;
}) {
  const rgb = (a: number) => `rgba(${group.accent},${a})`;
  return (
    <section>
      <button onClick={onToggle} className="mb-2.5 flex w-full items-center gap-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `rgb(${group.accent})` }} />
        <span className="font-label text-[12px] font-bold tracking-[.12em] text-[var(--rd-ink)]">{group.name.toUpperCase()}</span>
        <span className="font-label text-[12px] text-[var(--rd-text-faint)]">{group.routines.length}</span>
        <span className="h-px flex-1" style={{ background: 'var(--rd-border)' }} />
        <ChevronLeftIcon size={16} className="text-[var(--rd-text-muted)] transition-transform" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(-90deg)' }} />
      </button>
      {!collapsed && (
        <div className="space-y-2.5">
          {group.routines.map((r) => (
            <div key={r.key} className="rd-card flex items-center gap-3 p-3.5" style={{ borderColor: rgb(0.22) }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: rgb(0.14), color: `rgb(${group.accent})` }}>
                <TrainIcon size={20} />
              </span>
              <button onClick={() => onOpen(r)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[15px] font-semibold text-[var(--rd-ink)]">{r.name}</p>
                <p className="font-label mt-0.5 truncate text-[11px] capitalize text-[var(--rd-text-faint)]">
                  {r.exerciseCount} Ex · {r.estMinutes}m{r.muscles.length ? ` · ${r.muscles.join(', ')}` : ''}
                </p>
              </button>
              <button onClick={() => onSpin(r)} aria-label="Spin" className="shrink-0 text-[var(--rd-text-muted)]">
                <SpinIcon size={16} className={busyKey === r.key ? 'animate-spinslow' : ''} />
              </button>
              <button onClick={() => onOpen(r)} aria-label="Open" className="shrink-0 text-[var(--rd-text-muted)]">
                <ChevronLeftIcon size={18} className="rotate-180" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
