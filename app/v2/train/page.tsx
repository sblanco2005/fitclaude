'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkouts, type RoutineCard, type RoutineGroup } from '@/components/redesign/workouts/useWorkouts';
import { ScreenHeader } from '@/components/redesign/ui';
import { PlusIcon, SearchIcon, SpinIcon, TrainIcon, ChevronLeftIcon, CheckIcon, CloseIcon } from '@/components/redesign/icons';
import { FromYouTubeSheet } from '@/components/redesign/program/FromYouTubeSheet';

// Screen 05 · Workouts ("Train") — grouped layout (Option A)
export default function TrainPage() {
  const w = useWorkouts();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);

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

  const toggleSelect = (r: RoutineCard) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(r.key) ? next.delete(r.key) : next.add(r.key);
    return next;
  });

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); setConfirmDel(false); };

  const runDelete = async () => {
    setDeleting(true);
    const list = w.routines.filter((r) => selected.has(r.key));
    await w.bulkDelete(list);
    setDeleting(false);
    exitSelect();
  };

  const hasDeletable = w.routines.some((r) => !r.programId);

  return (
    <div className="animate-fadeup space-y-4 pb-2">
      <ScreenHeader
        eyebrow={selectMode ? `${selected.size} selected` : `${w.routines.length} routines · ${w.routineGroups.length} groups`}
        title="Your workouts"
        back
        right={
          selectMode ? (
            <button onClick={exitSelect} className="font-label rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3 py-2 text-[13px] font-semibold text-[var(--rd-text-secondary)]">Done</button>
          ) : (
            <div className="flex items-center gap-2">
              {hasDeletable && (
                <button onClick={() => setSelectMode(true)} className="font-label rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3 py-2 text-[13px] font-semibold text-[var(--rd-text-secondary)]">Select</button>
              )}
              <button onClick={() => setShowChooser(true)} aria-label="New routine" className="grad-ember flex h-10 w-10 items-center justify-center rounded-[13px] text-[#0A0C10]" style={{ boxShadow: 'var(--rd-glow-ember)' }}>
                <PlusIcon size={19} />
              </button>
            </div>
          )
        }
      />

      {selectMode && (
        <p className="text-[12px] text-[var(--rd-text-faint)]">Select routines to delete. Program routines can only be removed from the Program page.</p>
      )}

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
        <div className="space-y-5" style={{ paddingBottom: selectMode ? 72 : 0 }}>
          {groups.map((g) => (
            <Group
              key={g.id}
              group={g}
              collapsed={!q && collapsed.has(g.id)}
              onToggle={() => toggle(g.id)}
              onOpen={(r) => router.push(`/v2/train/routine/${r.latestId}`)}
              onSpin={(r) => w.spin(r)}
              busyKey={w.busy}
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Bulk-delete action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rd-border)] p-4" style={{ background: '#0F1117', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          <button onClick={() => setConfirmDel(true)} className="h-12 w-full rounded-[13px] text-[15px] font-semibold text-white" style={{ background: 'var(--rd-danger,#E5484D)' }}>
            Delete {selected.size} {selected.size === 1 ? 'routine' : 'routines'}
          </button>
        </div>
      )}

      {/* Confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setConfirmDel(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
          <div className="relative w-full max-w-sm rounded-[20px] border border-[var(--rd-border)] p-5" style={{ background: '#0F1117' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-[18px] font-bold text-[var(--rd-ink)]">Delete {selected.size} {selected.size === 1 ? 'routine' : 'routines'}?</h3>
            <p className="mt-2 text-[13px] text-[var(--rd-text-muted)]">This permanently removes the selected routines and their logged sessions.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDel(false)} disabled={deleting} className="flex-1 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[14px] font-semibold text-[var(--rd-text-secondary)]">Cancel</button>
              <button onClick={runDelete} disabled={deleting} className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white disabled:opacity-60" style={{ background: 'var(--rd-danger,#E5484D)' }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* "+" chooser — new program vs a routine from a YouTube video */}
      {showChooser && (
        <div className="fixed inset-0 z-[55] flex items-end" onClick={() => setShowChooser(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
          <div className="relative w-full rounded-t-[24px] border-t border-[var(--rd-border)] p-5 pb-8" style={{ background: '#0F1117' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[18px] font-bold text-[var(--rd-ink)]">Create a routine</h3>
              <button onClick={() => setShowChooser(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <div className="mt-4 space-y-2.5">
              <button onClick={() => { setShowChooser(false); router.push('/v2/program?new=1'); }} className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card)] p-4 text-left">
                <span className="grad-ember flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-[#0A0C10]"><PlusIcon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-[var(--rd-ink)]">New program</span>
                  <span className="block text-[12px] text-[var(--rd-text-faint)]">Build a weekly program day by day</span>
                </span>
              </button>
              <button onClick={() => { setShowChooser(false); setShowYouTube(true); }} className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card)] p-4 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-white" style={{ background: 'var(--rd-youtube)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15.5 15.19 12 10 8.5v7ZM12 4c4.5 0 7.5.35 7.5.35.9.1 1.6.8 1.7 1.7 0 0 .3 2 .3 3.95v0c0 1.95-.3 3.95-.3 3.95-.1.9-.8 1.6-1.7 1.7 0 0-3 .35-7.5.35s-7.5-.35-7.5-.35c-.9-.1-1.6-.8-1.7-1.7 0 0-.3-2-.3-3.95v0c0-1.95.3-3.95.3-3.95.1-.9.8-1.6 1.7-1.7C4.5 4.35 7.5 4 12 4Z"/></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-[var(--rd-ink)]">From a YouTube video</span>
                  <span className="block text-[12px] text-[var(--rd-text-faint)]">Paste a link — I&apos;ll read it and build the routine</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showYouTube && <FromYouTubeSheet onClose={() => setShowYouTube(false)} />}
    </div>
  );
}

function Group({ group, collapsed, onToggle, onOpen, onSpin, busyKey, selectMode, selected, onToggleSelect }: {
  group: RoutineGroup; collapsed: boolean; onToggle: () => void; onOpen: (r: RoutineCard) => void; onSpin: (r: RoutineCard) => void; busyKey: string | null;
  selectMode: boolean; selected: Set<string>; onToggleSelect: (r: RoutineCard) => void;
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
          {group.routines.map((r) => {
            const selectable = selectMode && !r.programId;
            const isSel = selected.has(r.key);
            return (
              <div
                key={r.key}
                role={selectable ? 'button' : undefined}
                onClick={selectable ? () => onToggleSelect(r) : undefined}
                className="rd-card flex items-center gap-3 p-3.5"
                style={{ borderColor: isSel ? 'var(--rd-ember)' : rgb(0.22), background: isSel ? 'rgba(255,107,69,.08)' : undefined, opacity: selectMode && !selectable ? 0.5 : 1 }}
              >
                {selectMode ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border" style={{ borderColor: isSel ? 'var(--rd-ember)' : 'var(--rd-border-strong)', background: isSel ? 'var(--rd-ember)' : 'transparent', color: '#0A0C10' }}>
                    {isSel ? <CheckIcon size={18} /> : !r.programId ? null : <span className="font-label text-[8px] font-bold text-[var(--rd-text-faint)]">PROG</span>}
                  </span>
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: rgb(0.14), color: `rgb(${group.accent})` }}>
                    <TrainIcon size={20} />
                  </span>
                )}
                <button onClick={selectMode ? undefined : () => onOpen(r)} disabled={selectMode} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-semibold text-[var(--rd-ink)]">{r.name}</p>
                  <p className="font-label mt-0.5 truncate text-[11px] capitalize text-[var(--rd-text-faint)]">
                    {r.exerciseCount} Ex · {r.estMinutes}m{r.muscles.length ? ` · ${r.muscles.join(', ')}` : ''}
                  </p>
                </button>
                {!selectMode && (
                  <>
                    <button onClick={() => onSpin(r)} aria-label="Spin" className="shrink-0 text-[var(--rd-text-muted)]">
                      <SpinIcon size={16} className={busyKey === r.key ? 'animate-spinslow' : ''} />
                    </button>
                    <button onClick={() => onOpen(r)} aria-label="Open" className="shrink-0 text-[var(--rd-text-muted)]">
                      <ChevronLeftIcon size={18} className="rotate-180" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
