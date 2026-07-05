'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useSession, formatWeight, lbToKg, kgToLb,
  type SessionExercise, type SetEntry,
} from '@/components/redesign/session/useSession';
import { FinishRate } from '@/components/redesign/session/FinishRate';
import { CheckIcon, CloseIcon, PlusIcon, MinusIcon, PlayIcon, ChevronLeftIcon, ArrowRightIcon, SpinIcon } from '@/components/redesign/icons';

// Screen 03 · Hit It (live workout) — accent: ember
type Unit = 'kg' | 'lb';
const fmtTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const s = useSession(id);
  const [exIdx, setExIdx] = useState(0);
  const [unit, setUnit] = useState<Unit>('lb');
  const [perSide, setPerSide] = useState(true);
  const [barLb, setBarLb] = useState(45);
  const [barDraft, setBarDraft] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [inited, setInited] = useState(false);
  const [media, setMedia] = useState<{ kind: 'gif' | 'video'; src: string } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - s.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [s.startedAt]);

  // adopt profile default unit once loaded
  useEffect(() => {
    if (!s.loading && !inited) {
      setUnit(s.defaultUnit);
      setBarLb(s.defaultUnit === 'kg' ? kgToLb(20) : 45);
      setInited(true);
    }
  }, [s.loading, s.defaultUnit, inited]);

  if (s.loading) return <div className="rd-card mt-6 h-[400px] animate-pulse-soft" />;
  if (!s.exercises.length) {
    return (
      <div className="rd-card mt-10 p-6 text-center">
        <p className="text-[14px] text-[var(--rd-text-muted)]">Couldn&apos;t load this session.</p>
        <button onClick={() => router.push('/v2/train')} className="mt-3 text-[13px] font-semibold text-[var(--rd-ember)]">Back to Train</button>
      </div>
    );
  }
  if (finishing) {
    return (
      <FinishRate
        name={s.name}
        elapsedSec={elapsed}
        volumeKg={s.stats.volumeKg}
        setsLogged={s.stats.setsLogged}
        exercises={s.exercises.length}
        saving={s.saving}
        onSave={async (fatigue, note) => { await s.save(fatigue, note); router.push('/v2/train'); }}
        onDiscard={() => router.push('/v2/train')}
      />
    );
  }

  const safeIdx = Math.min(exIdx, s.exercises.length - 1);
  const ex = s.exercises[safeIdx];
  const next = s.exercises[safeIdx + 1];
  const skip = () => setExIdx(Math.min(s.exercises.length - 1, safeIdx + 1));
  const barDisplay = unit === 'lb' ? barLb : lbToKg(barLb);

  return (
    <div className="animate-fadeup space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => router.push('/v2/train')} aria-label="Close" className="text-[var(--rd-text-muted)]"><CloseIcon size={22} /></button>
        <div className="text-center">
          <p className="font-label text-[9px] tracking-[.16em] text-[var(--rd-ember)]">IN PROGRESS</p>
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">{s.name}</p>
        </div>
        <span className="font-label text-[16px] font-bold text-[var(--rd-ink)]">{fmtTime(elapsed)}</span>
      </div>

      {/* Current exercise card */}
      <section className="rd-card p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setExIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx === 0} className="text-[var(--rd-text-muted)] disabled:opacity-30" aria-label="Previous exercise"><ChevronLeftIcon size={20} /></button>
          <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">EXERCISE {safeIdx + 1} / {s.exercises.length}</span>
          <button onClick={() => setExIdx(Math.min(s.exercises.length - 1, safeIdx + 1))} disabled={safeIdx === s.exercises.length - 1} className="rotate-180 text-[var(--rd-text-muted)] disabled:opacity-30" aria-label="Next exercise"><ChevronLeftIcon size={20} /></button>
        </div>

        <h2 className="font-display mt-3 text-[22px] font-bold text-[var(--rd-ink)]">{ex.name}</h2>
        <p className="font-label mt-0.5 text-[12px] text-[var(--rd-text-faint)]">{ex.sets.length} × {ex.lastSets[0]?.reps ?? ex.sets[0]?.reps ?? 8}</p>

        {/* Last + PR */}
        {ex.lastSets.length > 0 && (
          <p className="mt-2 text-[12px] text-[var(--rd-text-muted)]">
            <span className="text-[var(--rd-text-faint)]">Last:</span> {ex.lastSets.slice(0, 4).map((l) => `${formatWeight(l.weight, unit)}×${l.reps}`).join('  ')}
          </p>
        )}
        {ex.pr && (
          <p className="font-label mt-0.5 text-[12px] font-bold text-[var(--rd-amber)]">PR: {formatWeight(ex.pr.weight, unit)}×{ex.pr.reps}</p>
        )}

        {/* Controls row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setUnit(unit === 'lb' ? 'kg' : 'lb')} className="font-label flex items-center gap-1.5 rounded-[9px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3 py-1.5 text-[11px] font-semibold uppercase text-[var(--rd-ember)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v18M7 3 4 6M7 3l3 3M17 21V3M17 21l-3-3M17 21l3-3" /></svg>
            {unit}
          </button>
          {ex.isBarbell && (
            <>
              <span className="mx-0.5 h-4 w-px bg-[var(--rd-border)]" />
              <button onClick={() => setPerSide((v) => !v)} className="font-label flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[11px] font-semibold uppercase" style={{ borderColor: perSide ? 'rgba(255,107,69,.3)' : 'var(--rd-border)', background: perSide ? 'rgba(255,138,91,.12)' : 'var(--rd-card-glass)', color: perSide ? 'var(--rd-ember)' : 'var(--rd-text-muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7 4 12l4 5M16 7l4 5-4 5M4 12h16" /></svg>
                Per side
              </button>
              {perSide && (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="font-label text-[11px] text-[var(--rd-text-faint)]">bar:</span>
                  <input
                    inputMode="numeric"
                    value={barDraft !== '' ? barDraft : String(Math.round(barDisplay))}
                    onFocus={(e) => { setBarDraft(String(Math.round(barDisplay))); e.currentTarget.select(); }}
                    onChange={(e) => setBarDraft(e.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => { const v = Math.max(0, Math.min(100, parseInt(barDraft || '0', 10) || 0)); setBarLb(unit === 'lb' ? v : kgToLb(v)); setBarDraft(''); }}
                    className="font-num w-12 rounded-[8px] border border-[var(--rd-border)] bg-[var(--rd-card)] py-1 text-center text-[14px] text-[var(--rd-ink)] focus:outline-none"
                  />
                  <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{unit}</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Sets */}
        <div className="mt-4 space-y-3">
          {ex.sets.map((set, i) => (
            <SetRow
              key={i}
              n={i + 1}
              set={set}
              unit={unit}
              perSide={perSide && ex.isBarbell}
              barDisplay={barDisplay}
              onChange={(patch) => s.updateSet(safeIdx, i, patch)}
            />
          ))}

          <div className="flex gap-2 pt-1">
            <button onClick={() => s.removeSet(safeIdx)} disabled={ex.sets.length <= 1} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-2.5 text-[13px] font-semibold text-[var(--rd-text-secondary)] disabled:opacity-40"><MinusIcon size={14} /> Remove set</button>
            <button onClick={() => s.addSet(safeIdx)} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border py-2.5 text-[13px] font-semibold" style={{ borderColor: 'rgba(200,255,77,.3)', background: 'rgba(200,255,77,.08)', color: 'var(--rd-lime)' }}><PlusIcon size={14} /> Add set</button>
          </div>
          <button onClick={() => s.fillRemaining(safeIdx)} className="w-full py-1 text-[12px] font-semibold text-[var(--rd-text-faint)]">Fill remaining with last set</button>
        </div>
      </section>

      {/* Next up */}
      {next && (
        <section className="rd-card flex items-center justify-between p-4">
          <div>
            <p className="font-label text-[9px] tracking-[.14em] text-[var(--rd-text-faint)]">NEXT UP</p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--rd-ink)]">{next.name}</p>
          </div>
          <button onClick={skip} className="text-[var(--rd-ember)]" aria-label="Go to next"><ArrowRightIcon size={20} /></button>
        </section>
      )}

      {/* Action toolbar */}
      <div className="flex gap-1.5">
        <ToolBtn label="Video" onClick={() => ex.youtubeId && setMedia({ kind: 'video', src: ex.youtubeId })} disabled={!ex.youtubeId}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5A2.7 2.7 0 0 0 2.4 7.2 28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8ZM10 15V9l5 3Z" /></svg>
        </ToolBtn>
        <ToolBtn label="Demo" color="var(--rd-lime)" active disabled={!ex.gifUrl && !ex.youtubeId} onClick={() => ex.gifUrl ? setMedia({ kind: 'gif', src: ex.gifUrl }) : ex.youtubeId && setMedia({ kind: 'video', src: ex.youtubeId })}><PlayIcon size={16} /></ToolBtn>
        <ToolBtn label="Swap" onClick={() => s.swapExercise(safeIdx)}><SpinIcon size={16} /></ToolBtn>
        <ToolBtn label="Reorder" onClick={() => s.moveExercise(safeIdx, -1)}><ChevronLeftIcon size={16} className="rotate-90" /></ToolBtn>
        <ToolBtn label="Skip" onClick={skip}><ArrowRightIcon size={16} /></ToolBtn>
        <ToolBtn label="Delete" color="#FF6B6B" onClick={() => s.removeExercise(safeIdx)}><CloseIcon size={16} /></ToolBtn>
      </div>

      {/* Finish bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
        <div className="pointer-events-auto w-full max-w-[430px] px-5 pb-6 pt-2" style={{ background: 'linear-gradient(180deg, transparent, var(--rd-bg) 40%)' }}>
          <button onClick={() => setFinishing(true)} className="grad-ember flex h-12 w-full items-center justify-center rounded-[14px] text-[15px] font-semibold text-[#0A0C10]" style={{ boxShadow: 'var(--rd-glow-ember)' }}>Finish &amp; rate workout</button>
        </div>
      </div>

      {/* Floating demo / video player */}
      {media && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-5" onClick={() => setMedia(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.8)', backdropFilter: 'blur(4px)' }} />
          <div className="relative w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-[15px] font-bold text-[var(--rd-ink)]">{ex.name}</p>
              <button onClick={() => setMedia(null)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>
            <div className="overflow-hidden rounded-[16px] bg-black" style={{ aspectRatio: media.kind === 'video' ? '16/9' : '1/1' }}>
              {media.kind === 'gif' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.src} alt={ex.name} className="h-full w-full object-contain" />
              ) : (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${media.src}?autoplay=1&playsinline=1&rel=0`}
                  title={ex.name}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ label, color, active, disabled, onClick, children }: {
  label: string; color?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const c = color ?? 'var(--rd-text-muted)';
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-1 flex-col items-center gap-1 rounded-[12px] border py-2.5 disabled:opacity-30"
      style={active ? { borderColor: 'rgba(200,255,77,.2)', background: 'rgba(200,255,77,.07)', color } : { borderColor: 'var(--rd-border)', background: 'var(--rd-card-glass)', color: c }}>
      {children}
      <span className="font-label text-[8px] font-semibold" style={{ color: active ? color : 'var(--rd-text-faint)' }}>{label}</span>
    </button>
  );
}

function SetRow({ n, set, unit, perSide, barDisplay, onChange }: {
  n: number; set: SetEntry; unit: Unit; perSide: boolean; barDisplay: number; onChange: (p: Partial<SetEntry>) => void;
}) {
  const toDisp = (lb: number) => (unit === 'lb' ? lb : lbToKg(lb));
  const fromDisp = (v: number) => (unit === 'lb' ? v : kgToLb(v));
  const totalDisplay = toDisp(set.weightLb);
  const perSideDisplay = perSide ? Math.max(0, Math.round(((totalDisplay - barDisplay) / 2) * 10) / 10) : totalDisplay;
  const shown = perSide ? perSideDisplay : totalDisplay;
  const step = perSide ? 5 : unit === 'kg' ? 2.5 : 5;

  const setShown = (v: number) => {
    const clamped = Math.max(0, Math.round(v * 10) / 10);
    const newTotal = perSide ? clamped * 2 + barDisplay : clamped;
    onChange({ weightLb: fromDisp(newTotal) });
  };
  const otherLabel = unit === 'lb' ? `${lbToKg(set.weightLb)}kg` : `${Math.round(set.weightLb)}lb`;

  return (
    <div className="rounded-[13px] border p-2.5" style={{ borderColor: set.done ? 'rgba(200,255,77,.28)' : 'var(--rd-border)', background: set.done ? 'rgba(200,255,77,.05)' : 'var(--rd-card-glass)' }}>
      <div className="flex items-center gap-2">
        <span className="font-label w-6 shrink-0 text-[11px] font-bold text-[var(--rd-text-muted)]">S{n}</span>
        <NumStepper value={shown} step={step} decimals={unit === 'kg' && !perSide ? 1 : 0} onChange={setShown} />
        <div className="flex min-w-0 flex-col items-center px-0.5">
          <span className="font-label text-[9px] tracking-[.06em] text-[var(--rd-text-faint)]">{perSide ? '/side =' : unit}</span>
          {perSide && <span className="font-num text-[13px] font-bold text-[var(--rd-ink)]">{Math.round(totalDisplay)}{unit}</span>}
        </div>
        <NumStepper value={set.reps} step={1} decimals={0} onChange={(v) => onChange({ reps: Math.max(0, Math.round(v)) })} />
        <button onClick={() => onChange({ done: !set.done })} aria-label="Log set" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: set.done ? 'var(--rd-lime)' : 'transparent', border: set.done ? 'none' : '1px solid var(--rd-border-strong)', color: set.done ? '#0A0C10' : 'var(--rd-text-muted)' }}>
          <CheckIcon size={16} />
        </button>
      </div>
      {set.weightLb > 0 && <p className="font-label mt-1 pl-8 text-[10px] text-[var(--rd-text-faint)]">= {otherLabel}</p>}
    </div>
  );
}

function NumStepper({ value, step, decimals, onChange }: { value: number; step: number; decimals: number; onChange: (v: number) => void }) {
  // draft holds the raw string while focused so partial input ("", ".") is allowed;
  // committed live on every keystroke so the total updates as you type.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft != null ? draft : decimals ? String(value) : String(Math.round(value));
  return (
    <div className="flex flex-1 items-center gap-1">
      <button onClick={() => { setDraft(null); onChange(Math.max(0, value - step)); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--rd-card)] text-[var(--rd-ink)]" aria-label="Decrease"><MinusIcon size={14} /></button>
      <input
        inputMode="decimal"
        value={shown}
        onFocus={(e) => { setDraft(shown); e.currentTarget.select(); }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, '');
          setDraft(raw);
          const v = parseFloat(raw);
          if (!Number.isNaN(v)) onChange(v);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="font-num min-w-0 flex-1 rounded-[8px] bg-[var(--rd-card)] py-1.5 text-center text-[16px] font-bold text-[var(--rd-ink)] focus:outline-none"
      />
      <button onClick={() => { setDraft(null); onChange(value + step); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--rd-card)] text-[var(--rd-ember)]" aria-label="Increase"><PlusIcon size={14} /></button>
    </div>
  );
}
