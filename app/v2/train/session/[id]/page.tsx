'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, type SessionExercise, type SetEntry } from '@/components/redesign/session/useSession';
import { FinishRate } from '@/components/redesign/session/FinishRate';
import { CheckIcon, CloseIcon, PlusIcon, MinusIcon, PlayIcon, ChevronLeftIcon, ArrowRightIcon } from '@/components/redesign/icons';

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

  const ex = s.exercises[exIdx];
  const activeSetIdx = ex.sets.findIndex((st) => !st.done);
  const next = s.exercises[exIdx + 1];

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
            onClick={() => setExIdx((i) => Math.max(0, i - 1))}
            disabled={exIdx === 0}
            className="text-[var(--rd-text-muted)] disabled:opacity-30"
            aria-label="Previous exercise"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">
            EXERCISE {exIdx + 1} / {s.exercises.length}
          </span>
          <button
            onClick={() => setExIdx((i) => Math.min(s.exercises.length - 1, i + 1))}
            disabled={exIdx === s.exercises.length - 1}
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

        {/* How-to video */}
        {ex.youtubeUrl && (
          <button
            onClick={() => window.open(ex.youtubeUrl, '_blank')}
            className="mt-3 flex w-full items-center gap-3 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] p-2.5"
          >
            <span
              className="flex h-9 w-12 items-center justify-center rounded-[8px]"
              style={{ background: 'linear-gradient(135deg,#26282f,#15171c)' }}
            >
              <PlayIcon size={14} className="text-white/90" />
            </span>
            <span className="flex-1 text-left text-[13px] font-medium text-[var(--rd-text-secondary)]">Watch how-to</span>
            <span className="font-label rounded-[6px] px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: 'var(--rd-youtube)' }}>
              YT
            </span>
          </button>
        )}

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
                onUnit={setUnit}
                onChange={(patch) => s.updateSet(exIdx, i, patch)}
                onLog={() => s.updateSet(exIdx, i, { done: true })}
              />
            ) : (
              <SetRow key={i} setNum={i + 1} set={set} unit={unit} />
            ),
          )}
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

function ActiveSet({
  setNum, set, unit, isBarbell, onUnit, onChange, onLog,
}: {
  setNum: number;
  set: SetEntry;
  unit: 'kg' | 'lb';
  isBarbell: boolean;
  onUnit: (u: 'kg' | 'lb') => void;
  onChange: (patch: Partial<SetEntry>) => void;
  onLog: () => void;
}) {
  const step = unit === 'kg' ? 2.5 : 5;
  const dispW = toDisplay(set.weightKg, unit);
  const setWeight = (nextDisplay: number) => onChange({ weightKg: Math.max(0, fromDisplay(Math.round(nextDisplay * 10) / 10, unit)) });
  const bar = 20;
  const perSide = set.weightKg > bar ? (set.weightKg - bar) / 2 : 0;

  return (
    <div className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--rd-ember)', background: 'rgba(255,107,69,.08)' }}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">SET {setNum}</span>
        <div className="flex overflow-hidden rounded-full border border-[var(--rd-border)]">
          {(['kg', 'lb'] as const).map((u) => (
            <button
              key={u}
              onClick={() => onUnit(u)}
              className="font-label px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: unit === u ? 'var(--rd-ember)' : 'transparent', color: unit === u ? '#0A0C10' : 'var(--rd-text-muted)' }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stepper
          label="WEIGHT"
          value={`${Math.round(dispW * 10) / 10}`}
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

      {isBarbell && perSide > 0 && (
        <p className="font-label mt-2 text-center text-[10px] text-[var(--rd-text-faint)]">
          = {Math.round(set.weightKg)} kg total · {bar}kg bar + 2×{Math.round(perSide)}kg
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
