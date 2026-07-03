'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, lastSummary, type SessionExercise, type SetEntry } from '@/components/redesign/session/useSession';
import { FinishRate } from '@/components/redesign/session/FinishRate';
import { CheckIcon, CloseIcon, PlusIcon, MinusIcon, PlayIcon, ChevronLeftIcon, ArrowRightIcon, SpinIcon } from '@/components/redesign/icons';

// Screen 03 · Hit It (live workout) — accent: ember

const KG_PER_LB = 0.453592;
const toDisplay = (kg: number, unit: 'kg' | 'lb') => (unit === 'kg' ? kg : Math.round((kg / KG_PER_LB) * 10) / 10);
const fromDisplay = (v: number, unit: 'kg' | 'lb') => (unit === 'kg' ? v : v * KG_PER_LB);

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const s = useSession(id);
  const [exIdx, setExIdx] = useState(0);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [perSide, setPerSide] = useState(false);
  const [barKg, setBarKg] = useState(20);
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - s.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [s.startedAt]);

  if (s.loading) {
    return <div className="rd-card mt-6 h-[400px] animate-pulse-soft" />;
  }
  if (!s.exercises.length) {
    return (
      <div className="rd-card mt-10 p-6 text-center">
        <p className="text-[14px] text-[var(--rd-text-muted)]">Couldn&apos;t load this session.</p>
        <button onClick={() => router.push('/v2/train')} className="mt-3 text-[13px] font-semibold text-[var(--rd-ember)]">
          Back to Train
        </button>
      </div>
    );
  }

  if (finishing) {
    return (
      <FinishRate
        name={s.name}
        elapsedSec={elapsed}
        volumeKg={s.stats.volume}
        setsLogged={s.stats.setsLogged}
        exercises={s.exercises.length}
        saving={s.saving}
        onSave={async (fatigue, note) => {
          const ok = await s.save(fatigue, note);
          router.push(ok ? '/v2/train' : '/v2/train');
        }}
        onDiscard={() => router.push('/v2/train')}
      />
    );
  }

  const safeIdx = Math.min(exIdx, s.exercises.length - 1);
  const ex = s.exercises[safeIdx];
  const activeSetIdx = ex.sets.findIndex((st) => !st.done);
  const next = s.exercises[safeIdx + 1];
  const last = lastSummary(ex, unit);
  const showBarControls = ex.isBarbell;
  const skip = () => setExIdx((i) => Math.min(s.exercises.length - 1, i + 1));

  return (
    <div className="animate-fadeup space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => router.push('/v2/train')} aria-label="Close" className="text-[var(--rd-text-muted)]">
          <CloseIcon size={22} />
        </button>
        <div className="text-center">
          <p className="font-label text-[9px] tracking-[.16em] text-[var(--rd-ember)]">IN PROGRESS</p>
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">{s.name}</p>
        </div>
        <span className="font-label text-[16px] font-bold text-[var(--rd-ink)]">{fmt(elapsed)}</span>
      </div>

      {/* Current exercise card */}
      <section className="rd-card p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExIdx(Math.max(0, safeIdx - 1))}
            disabled={safeIdx === 0}
            className="text-[var(--rd-text-muted)] disabled:opacity-30"
            aria-label="Previous exercise"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">
            EXERCISE {safeIdx + 1} / {s.exercises.length}
          </span>
          <button
            onClick={() => setExIdx(Math.min(s.exercises.length - 1, safeIdx + 1))}
            disabled={safeIdx === s.exercises.length - 1}
            className="rotate-180 text-[var(--rd-text-muted)] disabled:opacity-30"
            aria-label="Next exercise"
          >
            <ChevronLeftIcon size={20} />
          </button>
        </div>

        <h2 className="font-display mt-3 text-[20px] font-bold text-[var(--rd-ink)]">{ex.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-label rounded-[7px] bg-[var(--rd-card)] px-2 py-0.5 text-[10px] capitalize text-[var(--rd-text-muted)]">
            {ex.muscle}
          </span>
          {ex.equipment && (
            <span className="font-label text-[11px] capitalize text-[var(--rd-text-faint)]">{ex.equipment}</span>
          )}
        </div>

        {/* Last summary */}
        {last && (
          <p className="mt-2 text-[12px] text-[var(--rd-text-muted)]">
            <span className="text-[var(--rd-text-faint)]">Last:</span> {last} {unit}
          </p>
        )}

        {/* Exercise controls: unit / per-side / bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-[9px] border border-[var(--rd-border)]">
            {(['kg', 'lb'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className="font-label px-3 py-1.5 text-[11px] font-semibold"
                style={{ background: unit === u ? 'var(--rd-ember)' : 'transparent', color: unit === u ? '#0A0C10' : 'var(--rd-text-muted)' }}
              >
                {u}
              </button>
            ))}
          </div>
          {showBarControls && (
            <>
              <button
                onClick={() => setPerSide((v) => !v)}
                className="font-label flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11px] font-semibold"
                style={{
                  borderColor: perSide ? 'rgba(255,107,69,.3)' : 'var(--rd-border)',
                  background: perSide ? 'rgba(255,138,91,.12)' : 'var(--rd-card-glass)',
                  color: perSide ? 'var(--rd-ember)' : 'var(--rd-text-muted)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7 4 12l4 5M16 7l4 5-4 5M4 12h16" /></svg>
                Per side
              </button>
              <button
                onClick={() => setBarKg((b) => (b === 20 ? 15 : b === 15 ? 10 : 20))}
                className="font-label flex items-center gap-1 rounded-[9px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--rd-text-secondary)]"
              >
                Bar {barKg} kg
              </button>
            </>
          )}
        </div>

        {/* Action toolbar */}
        <div className="mt-3 flex gap-1.5">
          <ToolBtn label="Demo" color="var(--rd-lime)" active onClick={() => ex.youtubeUrl && window.open(ex.youtubeUrl, '_blank')}>
            <PlayIcon size={16} />
          </ToolBtn>
          <ToolBtn label="Swap" onClick={() => s.swapExercise(safeIdx)}>
            <SpinIcon size={16} />
          </ToolBtn>
          <ToolBtn label="Up" onClick={() => s.moveExercise(safeIdx, -1)}>
            <ChevronLeftIcon size={16} className="rotate-90" />
          </ToolBtn>
          <ToolBtn label="Skip" onClick={skip}>
            <ArrowRightIcon size={16} />
          </ToolBtn>
          <ToolBtn label="Delete" color="#FF6B6B" onClick={() => s.removeExercise(safeIdx)}>
            <CloseIcon size={16} />
          </ToolBtn>
        </div>

        {/* Sets */}
        <div className="mt-4 space-y-2">
          <div className="font-label grid grid-cols-[28px_1fr_1fr_24px] gap-2 px-1 text-[9px] tracking-[.1em] text-[var(--rd-text-faint)]">
            <span>SET</span>
            <span>LAST TIME</span>
            <span>THIS SET</span>
            <span />
          </div>
          {ex.sets.map((set, i) =>
            i === activeSetIdx ? (
              <ActiveSet
                key={i}
                setNum={i + 1}
                set={set}
                unit={unit}
                isBarbell={ex.isBarbell}
                perSide={perSide}
                barKg={barKg}
                onChange={(patch) => s.updateSet(safeIdx, i, patch)}
                onLog={() => s.updateSet(safeIdx, i, { done: true })}
              />
            ) : (
              <SetRow key={i} setNum={i + 1} set={set} unit={unit} />
            ),
          )}

          {/* Add / remove set */}
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => s.removeSet(safeIdx)}
              disabled={ex.sets.length <= 1}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-2.5 text-[13px] font-semibold text-[var(--rd-text-secondary)] disabled:opacity-40"
            >
              <MinusIcon size={14} /> Remove set
            </button>
            <button
              onClick={() => s.addSet(safeIdx)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border py-2.5 text-[13px] font-semibold"
              style={{ borderColor: 'rgba(200,255,77,.3)', background: 'rgba(200,255,77,.08)', color: 'var(--rd-lime)' }}
            >
              <PlusIcon size={14} /> Add set
            </button>
          </div>
        </div>
      </section>

      {/* Next up */}
      {next && (
        <section className="rd-card flex items-center justify-between p-4">
          <div>
            <p className="font-label text-[9px] tracking-[.14em] text-[var(--rd-text-faint)]">NEXT UP</p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--rd-ink)]">{next.name}</p>
          </div>
          <button onClick={() => setExIdx((i) => i + 1)} className="text-[var(--rd-ember)]" aria-label="Go to next">
            <ArrowRightIcon size={20} />
          </button>
        </section>
      )}

      {/* Finish bar (replaces tab bar) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
        <div className="pointer-events-auto w-full max-w-[430px] px-5 pb-6 pt-2" style={{ background: 'linear-gradient(180deg, transparent, var(--rd-bg) 40%)' }}>
          <button
            onClick={() => setFinishing(true)}
            className="grad-ember flex h-12 w-full items-center justify-center rounded-[14px] text-[15px] font-semibold text-[#0A0C10]"
            style={{ boxShadow: 'var(--rd-glow-ember)' }}
          >
            Finish &amp; rate workout
          </button>
        </div>
      </div>
    </div>
  );
}

function SetRow({ setNum, set, unit }: { setNum: number; set: SetEntry; unit: 'kg' | 'lb' }) {
  return (
    <div className="grid grid-cols-[28px_1fr_1fr_24px] items-center gap-2 rounded-[11px] px-1 py-2">
      <span className="font-num text-[13px] font-bold text-[var(--rd-text-muted)]">{setNum}</span>
      <span className="font-label text-[12px] text-[var(--rd-text-faint)]">
        {set.lastWeightKg != null ? `${Math.round(toDisplay(set.lastWeightKg, unit))}${unit} × ${set.lastReps ?? '–'}` : '—'}
      </span>
      <span className="font-label text-[12px]" style={{ color: set.done ? 'var(--rd-lime)' : 'var(--rd-text-faint)' }}>
        {set.done ? `${Math.round(toDisplay(set.weightKg, unit))}${unit} × ${set.reps}` : '—'}
      </span>
      <span className="flex justify-center">
        {set.done ? (
          <span className="text-[var(--rd-lime)]"><CheckIcon size={15} /></span>
        ) : (
          <span className="h-4 w-4 rounded-full border border-[var(--rd-border-strong)]" />
        )}
      </span>
    </div>
  );
}

function ToolBtn({
  label, color, active, onClick, children,
}: {
  label: string;
  color?: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const c = color ?? 'var(--rd-text-muted)';
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-[12px] border py-2.5"
      style={
        active
          ? { borderColor: 'rgba(200,255,77,.2)', background: 'rgba(200,255,77,.07)', color }
          : { borderColor: 'var(--rd-border)', background: 'var(--rd-card-glass)', color: c }
      }
    >
      {children}
      <span className="font-label text-[9px] font-semibold" style={{ color: active ? color : 'var(--rd-text-faint)' }}>{label}</span>
    </button>
  );
}

function ActiveSet({
  setNum, set, unit, isBarbell, perSide, barKg, onChange, onLog,
}: {
  setNum: number;
  set: SetEntry;
  unit: 'kg' | 'lb';
  isBarbell: boolean;
  perSide: boolean;
  barKg: number;
  onChange: (patch: Partial<SetEntry>) => void;
  onLog: () => void;
}) {
  const step = unit === 'kg' ? 2.5 : 5;
  const usePerSide = perSide && isBarbell;
  const perSideKg = Math.max(0, (set.weightKg - barKg) / 2);
  const shownKg = usePerSide ? perSideKg : set.weightKg;
  const dispW = Math.round(toDisplay(shownKg, unit) * 10) / 10;

  const setWeight = (nextDisplay: number) => {
    const enteredKg = fromDisplay(Math.max(0, Math.round(nextDisplay * 10) / 10), unit);
    onChange({ weightKg: usePerSide ? barKg + 2 * enteredKg : enteredKg });
  };

  return (
    <div className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--rd-ember)', background: 'rgba(255,107,69,.08)' }}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">SET {setNum}</span>
        {set.lastWeightKg != null && (
          <span className="font-label text-[10px] text-[var(--rd-text-faint)]">
            Last {Math.round(toDisplay(set.lastWeightKg, unit))}{unit} × {set.lastReps ?? '–'}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stepper
          label={usePerSide ? 'WEIGHT / SIDE' : 'WEIGHT'}
          value={`${dispW}`}
          unit={unit}
          onMinus={() => setWeight(dispW - step)}
          onPlus={() => setWeight(dispW + step)}
        />
        <Stepper
          label="REPS"
          value={`${set.reps}`}
          onMinus={() => onChange({ reps: Math.max(0, set.reps - 1) })}
          onPlus={() => onChange({ reps: set.reps + 1 })}
        />
      </div>

      {usePerSide && set.weightKg >= barKg && (
        <p className="font-label mt-2 text-center text-[10px] text-[var(--rd-lime)]">
          = {Math.round(set.weightKg)} kg total · {barKg}kg bar + 2×{Math.round(perSideKg)}kg
        </p>
      )}

      <button
        onClick={onLog}
        className="grad-lime mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold text-[#0A0C10]"
      >
        Log set {setNum} <CheckIcon size={16} />
      </button>
    </div>
  );
}

function Stepper({
  label, value, unit, onMinus, onPlus,
}: {
  label: string;
  value: string;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div>
      <p className="font-label mb-1.5 text-center text-[9px] tracking-[.12em] text-[var(--rd-text-faint)]">{label}</p>
      <div className="flex items-center justify-between rounded-[11px] bg-[var(--rd-card)] p-1">
        <button onClick={onMinus} className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--rd-card-glass)] text-[var(--rd-ink)]" aria-label="Decrease">
          <MinusIcon size={16} />
        </button>
        <span className="font-num text-[17px] font-bold text-[var(--rd-ink)]">
          {value}
          {unit && <span className="font-label ml-0.5 text-[10px] text-[var(--rd-text-faint)]">{unit}</span>}
        </span>
        <button onClick={onPlus} className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--rd-card-glass)] text-[var(--rd-ink)]" aria-label="Increase">
          <PlusIcon size={16} />
        </button>
      </div>
    </div>
  );
}
