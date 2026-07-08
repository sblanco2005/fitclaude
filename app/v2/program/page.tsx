'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramDay, DayType } from '@/types';
import { useProgram, daySubtitle, DAY_ACCENT, DAY_TYPE_LABEL, todayWeekdayMon, type ProgramSummary } from '@/components/redesign/program/useProgram';
import { useFitClaude } from '@/context/FitClaudeContext';
import { NewProgramSheet } from '@/components/redesign/program/NewProgramSheet';
import { ScreenHeader } from '@/components/redesign/ui';
import { ChevronLeftIcon, CloseIcon, PlusIcon } from '@/components/redesign/icons';

// Screen 14 · Program — accent: ember
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const titleCase = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
const tabLabel = (p: ProgramSummary, i: number) => p.name || (p.isActive ? 'Main' : `Program ${i + 1}`);

export default function ProgramPage() {
  const router = useRouter();
  const { loading, active, programs } = useProgram();
  const { bumpDataVersion } = useFitClaude();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [week, setWeek] = useState(1);
  const [detail, setDetail] = useState<ProgramDay | null>(null);
  const [starting, setStarting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeSummary = programs.find((p) => p.isActive) ?? null;
  const selId = selectedId ?? activeSummary?.id ?? programs[0]?.id ?? null;
  const sel = programs.find((p) => p.id === selId) ?? null;
  const isViewingActive = !!(sel?.isActive && active?.id === sel.id);
  const totalWeeks = sel?.totalWeeks ?? active?.totalWeeks ?? 1;
  // For the active program, trust the calendar-aware effective week from
  // /api/program (active.currentWeek) — the list endpoint returns the raw,
  // sometimes-stale stored currentWeek, which made this page disagree with Home.
  const currentWeek = (isViewingActive ? active?.currentWeek : sel?.currentWeek) ?? active?.currentWeek ?? sel?.currentWeek ?? 1;

  useEffect(() => { if (!loading) setWeek(currentWeek); }, [loading, selId, currentWeek]);

  const days = isViewingActive && active
    ? active.days.filter((d) => d.weekNumber === week)
    : (sel?.days ?? []).filter((d) => d.weekNumber === week);

  const rows = WEEKDAYS.map((label, wd) => ({ wd, label, day: days.find((d) => d.weekday === wd) as ProgramDay | undefined }));
  const todayWd = todayWeekdayMon();

  const hitIt = async (routineId?: string | null) => {
    if (!routineId || starting) return;
    setStarting(true);
    const r = await fetch(`/api/workouts/${routineId}/duplicate`, { method: 'POST' }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setStarting(false);
    if (r?.id) router.push(`/v2/train/session/${r.id}`);
  };

  const closeDetail = () => { setDetail(null); setMoving(false); };

  const makeMain = async (id: string) => {
    if (switching) return;
    setSwitching(true);
    const ok = await fetch('/api/program', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId: id }),
    }).then((r) => r.ok).catch(() => false);
    setSwitching(false);
    if (ok) { setSelectedId(null); bumpDataVersion(); }
  };

  const moveDay = async (toWeekday: number) => {
    if (!detail || moveBusy) return;
    setMoveBusy(true);
    const ok = await fetch('/api/program/move-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekNumber: week, fromWeekday: detail.weekday, toWeekday }),
    }).then((r) => r.ok).catch(() => false);
    setMoveBusy(false);
    if (ok) { closeDetail(); bumpDataVersion(); }
  };

  if (loading) return <div className="rd-card mt-6 h-[400px] animate-pulse-soft" />;

  if (!sel && !active) {
    return (
      <div className="animate-fadeup space-y-5">
        <ScreenHeader title="Program" back onBack={() => router.push('/v2')} />
        <div className="rd-card p-6 text-center">
          <p className="text-[14px] font-semibold text-[var(--rd-ink)]">No program yet</p>
          <p className="mt-1 text-[13px] text-[var(--rd-text-faint)]">Set up a weekly schedule to plan your training.</p>
          <button onClick={() => router.push('/v2/train/add')} className="grad-ember mt-4 rounded-[13px] px-5 py-2.5 text-[14px] font-semibold text-[#0A0C10]">Build a program</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeup space-y-4 pb-2">
      <ScreenHeader
        eyebrow={`PROGRAM · WEEK ${currentWeek} OF ${totalWeeks}`}
        title={titleCase(sel?.name) || 'Training Program'}
        back
        onBack={() => router.push('/v2')}
      />

      {/* Program switcher + add */}
      <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5">
        {programs.map((p, i) => {
          const on = p.id === selId;
          return (
            <button
              key={p.id}
              onClick={() => { setSelectedId(p.id); }}
              className="font-label shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold"
              style={{ borderColor: on ? 'transparent' : 'var(--rd-border)', background: on ? 'var(--rd-ember)' : 'var(--rd-card-glass)', color: on ? '#0A0C10' : 'var(--rd-text-muted)' }}
            >
              {p.isActive ? '★ ' : ''}{tabLabel(p, i)}
            </button>
          );
        })}
        {programs.length < 3 && (
          <button
            onClick={() => setShowNew(true)}
            className="font-label flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--rd-border-strong)] px-3 py-1.5 text-[12px] font-semibold text-[var(--rd-text-muted)]"
          >
            <PlusIcon size={13} /> New
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: 'rgba(200,255,77,.28)', background: 'rgba(200,255,77,.1)' }}>
          <span className="text-[13px] font-medium text-[var(--rd-ink)]">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-[var(--rd-text-muted)]"><CloseIcon size={14} /></button>
        </div>
      )}

      {/* Week pills */}
      {totalWeeks > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((wk) => {
            const on = wk === week;
            return (
              <button
                key={wk}
                onClick={() => setWeek(wk)}
                className="font-label flex-1 rounded-[11px] border py-2 text-[12px] font-semibold"
                style={{ borderColor: on ? 'var(--rd-ember)' : 'var(--rd-border)', background: on ? 'rgba(255,107,69,.1)' : 'var(--rd-card-glass)', color: on ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}
              >
                Wk {wk}{wk === currentWeek ? ' •' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Day list */}
      <div className="space-y-2">
        {rows.map(({ wd, label, day }) => {
          const type: DayType = day?.dayType ?? 'rest';
          const accent = DAY_ACCENT[type];
          const isToday = isViewingActive && week === currentWeek && wd === todayWd;
          const dayLabel = day?.dayLabel || 'Rest';
          const sub = day
            ? (isViewingActive ? daySubtitle(day) : (type === 'rest' ? '' : DAY_TYPE_LABEL[type]))
            : '';
          const tappable = isViewingActive && !!day && type !== 'rest';
          return (
            <div
              key={wd}
              role={tappable ? 'button' : undefined}
              onClick={tappable ? () => setDetail(day!) : undefined}
              className="flex items-center gap-3 rounded-[13px] border p-3.5"
              style={{ borderColor: isToday ? 'var(--rd-ember)' : 'var(--rd-border)', background: isToday ? 'rgba(255,107,69,.06)' : 'var(--rd-card-glass)', cursor: tappable ? 'pointer' : 'default' }}
            >
              <span className="font-label w-9 shrink-0 text-[11px] font-bold text-[var(--rd-text-faint)]">{label.toUpperCase()}</span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: type === 'rest' ? 'var(--rd-border-strong)' : `rgb(${accent})` }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold" style={{ color: type === 'rest' ? 'var(--rd-text-faint)' : 'var(--rd-ink)' }}>{dayLabel}</p>
                {sub && <p className="font-label mt-0.5 truncate text-[11px] capitalize text-[var(--rd-text-faint)]">{sub}</p>}
              </div>
              {isToday && <span className="font-label rounded-[6px] px-1.5 py-0.5 text-[8px] font-bold text-[#0A0C10]" style={{ background: 'var(--rd-ember)' }}>TODAY</span>}
              {tappable && <ChevronLeftIcon size={16} className="shrink-0 rotate-180 text-[var(--rd-text-muted)]" />}
            </div>
          );
        })}
      </div>

      {!isViewingActive && sel && !sel.isActive && (
        <div className="space-y-2 pt-1">
          <p className="text-center text-[11px] text-[var(--rd-text-faint)]">This is a secondary program. Make it your Main to train from it.</p>
          <button
            onClick={() => makeMain(sel.id)}
            disabled={switching}
            className="grad-ember h-12 w-full rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60"
          >
            {switching ? 'Switching…' : `Make “${tabLabel(sel, programs.findIndex((p) => p.id === sel.id))}” my Main`}
          </button>
        </div>
      )}

      {/* Day detail sheet */}
      {detail && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={closeDetail}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
          <div className="relative max-h-[80%] w-full overflow-y-auto rounded-t-[24px] border-t border-[var(--rd-border)] p-5 pb-8" style={{ background: '#0F1117' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-label text-[10px] tracking-[.14em]" style={{ color: `rgb(${DAY_ACCENT[detail.dayType]})` }}>{DAY_TYPE_LABEL[detail.dayType].toUpperCase()} · {WEEKDAYS[detail.weekday]}</p>
                <h3 className="font-display mt-1 text-[20px] font-bold text-[var(--rd-ink)]">{detail.dayLabel}</h3>
              </div>
              <button onClick={closeDetail} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>

            <DayExercises day={detail} />

            <div className="mt-5 space-y-2">
              {detail.dayType === 'coached' && detail.routineId && week === currentWeek && todayWd === detail.weekday ? (
                <button onClick={() => hitIt(detail.routineId)} disabled={starting} className="grad-ember flex h-12 w-full items-center justify-center rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60">{starting ? 'Starting…' : 'Hit it'}</button>
              ) : detail.dayType === 'coached' && detail.routineId ? (
                <button onClick={() => router.push(`/v2/train/routine/${detail.routineId}`)} className="rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[14px] font-semibold text-[var(--rd-text-secondary)] w-full">View routine</button>
              ) : detail.dayType !== 'rest' ? (
                <button onClick={() => router.push('/v2/coach')} className="rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[14px] font-semibold text-[var(--rd-text-secondary)] w-full">Log with Coach</button>
              ) : null}

              {/* Move / reschedule */}
              {isViewingActive && (
                !moving ? (
                  <button onClick={() => setMoving(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-dashed border-[var(--rd-border-strong)] bg-transparent text-[13px] font-semibold text-[var(--rd-text-muted)]">
                    <SwapIcon size={15} /> Move to another day
                  </button>
                ) : (
                  <div className="rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] p-3">
                    <p className="font-label mb-2 text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">MOVE {WEEKDAYS[detail.weekday].toUpperCase()} TO…</p>
                    <div className="grid grid-cols-2 gap-2">
                      {rows.filter((r) => r.wd !== detail.weekday).map(({ wd, label, day }) => {
                        const occupied = day && day.dayType !== 'rest';
                        return (
                          <button
                            key={wd}
                            onClick={() => moveDay(wd)}
                            disabled={moveBusy}
                            className="flex flex-col items-start gap-0.5 rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3 py-2 text-left disabled:opacity-50 active:bg-[var(--rd-card-glass-hover)]"
                          >
                            <span className="font-label text-[11px] font-bold text-[var(--rd-ink)]">{label}</span>
                            <span className="font-label truncate text-[10px] text-[var(--rd-text-faint)]">{occupied ? `Swap · ${day!.dayLabel}` : 'Rest → moves here'}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => setMoving(false)} disabled={moveBusy} className="mt-2 w-full py-1.5 text-[12px] font-semibold text-[var(--rd-text-faint)]">Cancel</button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* New program creation */}
      {showNew && (
        <NewProgramSheet
          currentActive={active?.id ? { id: active.id, name: activeSummary?.name ?? null } : null}
          onClose={() => setShowNew(false)}
          onCreated={(newName) => { setShowNew(false); setSelectedId(null); setNotice(`“${newName}” created and set as your Main. Your old program is saved — switch anytime.`); }}
        />
      )}
    </div>
  );
}

function SwapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 3 8l4 4" /><path d="M3 8h13a4 4 0 0 1 0 8h-1" />
      <path d="m17 20 4-4-4-4" /><path d="M21 16H8" />
    </svg>
  );
}

function DayExercises({ day }: { day: ProgramDay }) {
  const ex = day.exerciseTemplate ?? [];
  if (day.dayType === 'rest') return <p className="mt-4 text-[13px] text-[var(--rd-text-muted)]">Recovery day — no training scheduled.</p>;
  if (day.dayType !== 'coached') return <p className="mt-4 text-[13px] text-[var(--rd-text-muted)]">Log this session yourself when it&apos;s done.</p>;
  if (!ex.length) return <p className="mt-4 text-[13px] text-[var(--rd-text-faint)]">No exercises generated yet.</p>;
  const primary = ex.filter((e) => e.is_primary);
  const accessory = ex.filter((e) => !e.is_primary);
  const Row = (e: (typeof ex)[number], i: number) => (
    <div key={i} className="flex items-center justify-between rounded-[10px] bg-[var(--rd-card)] px-3 py-2">
      <div className="min-w-0"><p className="truncate text-[13px] font-medium text-[var(--rd-text-secondary)]">{e.name}</p><p className="font-label text-[10px] capitalize text-[var(--rd-text-faint)]">{e.muscle_group}</p></div>
      <span className="font-label shrink-0 text-[11px] text-[var(--rd-text-faint)]">{e.sets}×{e.reps}</span>
    </div>
  );
  return (
    <div className="mt-4 space-y-3">
      {primary.length > 0 && <div className="space-y-1.5"><p className="font-label text-[9px] tracking-[.14em] text-[var(--rd-text-faint)]">PRIMARY</p>{primary.map(Row)}</div>}
      {accessory.length > 0 && <div className="space-y-1.5"><p className="font-label text-[9px] tracking-[.14em] text-[var(--rd-text-faint)]">ACCESSORY</p>{accessory.map(Row)}</div>}
    </div>
  );
}
