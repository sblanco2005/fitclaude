'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, PlusIcon, MinusIcon } from '@/components/redesign/icons';
import type { SessionSegment, SegmentLog, DistUnit, MetricKey } from './useSession';
import { ALL_METRICS } from './useSession';

const CYAN = '#22D3EE';
const UNITS: DistUnit[] = ['m', 'km', 'mi'];
const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const METRIC_LABEL: Record<MetricKey, string> = { time: 'Time', distance: 'Distance', calories: 'Calories', reps: 'Reps' };

function Stepper({ value, step, decimals = 0, onChange }: { value: number; step: number; decimals?: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft != null ? draft : decimals ? String(value) : String(Math.round(value));
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <button onClick={() => { setDraft(null); onChange(Math.max(0, value - step)); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--rd-card)] text-[var(--rd-ink)]"><MinusIcon size={15} /></button>
      <input
        inputMode="decimal"
        value={shown}
        onFocus={(e) => { setDraft(shown); e.currentTarget.select(); }}
        onChange={(e) => { const raw = e.target.value.replace(/[^\d.]/g, ''); setDraft(raw); const v = parseFloat(raw); if (!Number.isNaN(v)) onChange(v); }}
        onBlur={() => setDraft(null)}
        className="font-num min-w-0 flex-1 rounded-[9px] bg-[var(--rd-card)] py-2 text-center text-[17px] font-bold text-[var(--rd-ink)] focus:outline-none"
      />
      <button onClick={() => { setDraft(null); onChange(value + step); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--rd-card)]" style={{ color: CYAN }}><PlusIcon size={15} /></button>
    </div>
  );
}

function MetricRow({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5">
      <p className="font-label mb-1 text-[9px] tracking-[.12em] text-[var(--rd-text-faint)]">{label}{suffix ? ` · ${suffix}` : ''}</p>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

// Cardio session — one card per segment. The user chooses HOW to log each one
// (time / distance / calories / reps) via toggle chips, since different cardio
// suits different metrics (run=distance, air bike=calories, rower=cals or meters).
export function CardioSession({ segments, onChange, onSetMetrics }: {
  segments: SessionSegment[];
  onChange: (segIdx: number, roundIdx: number, patch: Partial<SegmentLog>) => void;
  onSetMetrics: (segIdx: number, metrics: MetricKey[]) => void;
}) {
  const [runningIdx, setRunningIdx] = useState<number | null>(null);
  const startRef = useRef<{ at: number; base: number } | null>(null);

  useEffect(() => {
    if (runningIdx == null) return;
    const iv = setInterval(() => {
      if (!startRef.current) return;
      const elapsed = Math.round((Date.now() - startRef.current.at) / 1000);
      onChange(runningIdx, 0, { durationSec: startRef.current.base + elapsed });
    }, 1000);
    return () => clearInterval(iv);
  }, [runningIdx, onChange]);

  const toggleTimer = (i: number, cur: number) => {
    if (runningIdx === i) { setRunningIdx(null); startRef.current = null; }
    else { startRef.current = { at: Date.now(), base: cur }; setRunningIdx(i); }
  };

  const toggleMetric = (i: number, current: MetricKey[], m: MetricKey) => {
    const has = current.includes(m);
    // keep chip order stable (ALL_METRICS order), require at least one metric
    const next = has ? current.filter((x) => x !== m) : ALL_METRICS.filter((x) => current.includes(x) || x === m);
    onSetMetrics(i, next.length ? next : [m]);
  };

  return (
    <div className="space-y-2.5">
      {segments.map((seg, i) => {
        const r = seg.rounds[0];
        const running = runningIdx === i;
        const metrics = seg.metrics;
        return (
          <div key={seg.woExerciseId} className="rounded-[14px] border p-3.5" style={{ borderColor: r.done ? 'rgba(34,211,238,.5)' : 'var(--rd-border)', background: r.done ? 'rgba(34,211,238,.07)' : 'var(--rd-card-glass)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-[var(--rd-ink)]">{i + 1}. {seg.name}</p>
              {r.done && <span className="text-[var(--rd-lime)]"><CheckIcon size={16} /></span>}
            </div>

            {/* Metric chooser — how to log this segment */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ALL_METRICS.map((m) => {
                const active = metrics.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMetric(i, metrics, m)}
                    className="rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors"
                    style={active
                      ? { background: CYAN, borderColor: CYAN, color: '#0A0C10' }
                      : { borderColor: 'var(--rd-border)', color: 'var(--rd-text-muted)' }}
                  >
                    {METRIC_LABEL[m]}
                  </button>
                );
              })}
            </div>

            {/* Time */}
            {metrics.includes('time') && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="font-num flex-1 text-[30px] font-bold leading-none text-[var(--rd-ink)]">{fmtClock(r.durationSec)}</span>
                <button onClick={() => toggleTimer(i, r.durationSec)} className="rounded-[10px] px-4 py-2 text-[13px] font-bold" style={{ background: running ? 'var(--rd-ember)' : CYAN, color: '#0A0C10' }}>{running ? 'Pause' : 'Start'}</button>
                <button onClick={() => { if (running) { setRunningIdx(null); startRef.current = null; } onChange(i, 0, { durationSec: 0 }); }} className="rounded-[10px] border border-[var(--rd-border)] px-3 py-2 text-[12px] font-semibold text-[var(--rd-text-muted)]">Reset</button>
              </div>
            )}

            {/* Distance */}
            {metrics.includes('distance') && (
              <MetricRow label="DISTANCE">
                <Stepper value={r.distance} step={r.distanceUnit === 'm' ? 50 : 0.1} decimals={r.distanceUnit === 'm' ? 0 : 1} onChange={(v) => onChange(i, 0, { distance: Math.max(0, v) })} />
                <button onClick={() => onChange(i, 0, { distanceUnit: UNITS[(UNITS.indexOf(r.distanceUnit) + 1) % UNITS.length] })} className="shrink-0 rounded-[9px] border border-[var(--rd-border)] px-3 py-2 text-[13px] font-bold" style={{ color: CYAN }}>{r.distanceUnit}</button>
              </MetricRow>
            )}

            {/* Calories */}
            {metrics.includes('calories') && (
              <MetricRow label="CALORIES" suffix="kcal">
                <Stepper value={r.calories} step={5} onChange={(v) => onChange(i, 0, { calories: Math.max(0, Math.round(v)) })} />
              </MetricRow>
            )}

            {/* Reps */}
            {metrics.includes('reps') && (
              <MetricRow label="REPS">
                <Stepper value={r.reps ?? 0} step={1} onChange={(v) => onChange(i, 0, { reps: Math.max(0, Math.round(v)) })} />
              </MetricRow>
            )}

            <button onClick={() => { if (running) { setRunningIdx(null); startRef.current = null; } onChange(i, 0, { done: !r.done }); }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold" style={{ background: r.done ? 'rgba(200,255,77,.15)' : CYAN, color: r.done ? 'var(--rd-lime)' : '#0A0C10' }}>
              {r.done ? 'Logged — tap to undo' : <>Log segment <CheckIcon size={16} /></>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
