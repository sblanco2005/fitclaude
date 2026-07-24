'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useSession, formatWeight, lbToKg, kgToLb,
  type SessionExercise, type SetEntry,
} from '@/components/redesign/session/useSession';
import { toDisplay, fromDisplay, perSideDisplay, totalLbFromPerSide, totalLbFromDisplay } from '@/components/redesign/session/weightMath';
import { FinishRate } from '@/components/redesign/session/FinishRate';
import { YouTubeAutoplay } from '@/components/redesign/session/YouTubeAutoplay';
import { CardioSession } from '@/components/redesign/session/CardioSession';
import { ExercisePicker, type PickOption } from '@/components/redesign/session/ExercisePicker';
import { CheckIcon, CloseIcon, PlusIcon, MinusIcon, PlayIcon, ChevronLeftIcon, ArrowRightIcon } from '@/components/redesign/icons';

function CameraIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

// Display a weight cleanly: kg is already snapped to 0.5 by the math, so keep it;
// lb rounds to whole. Avoids "153kg" while the plates below sum to 152.5.
const cleanW = (v: number, unit: Unit) => (unit === 'kg' ? v : Math.round(v));

// Screen 03 · Hit It (live workout) — accent: ember
type Unit = 'kg' | 'lb';
const fmtTime = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
// Reliable "select everything on focus" — deferred a frame so mobile browsers
// don't drop the caret mid-value after positioning it.
const selectAll = (el: HTMLInputElement) => {
  requestAnimationFrame(() => { try { el.setSelectionRange(0, el.value.length); } catch { /* noop */ } });
};

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
  // Inline demo player (compact, in-card — never covers the sets).
  const [demo, setDemo] = useState<'gif' | 'video' | 'unavailable' | null>(null);
  const [gifFailed, setGifFailed] = useState(false);
  // Which set is expanded for editing. null → auto-pick the first unlogged set.
  const [activeSet, setActiveSet] = useState<number | null>(null);
  // Exercise picker — swap the current exercise, or add a new one to the workout.
  const [pickerMode, setPickerMode] = useState<'swap' | 'add' | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapToast, setSwapToast] = useState<string | null>(null);

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
  if (!s.exercises.length && !s.segments.length) {
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
        exercises={s.isCardio ? s.segments.length : s.exercises.length}
        saving={s.saving}
        onSave={async (fatigue, note) => { await s.save(fatigue, note); router.push('/v2/train'); }}
        onDiscard={() => router.push('/v2/train')}
      />
    );
  }

  // ── Cardio session — time / distance / reps per segment (no weights) ──
  if (s.isCardio) {
    return (
      <div className="animate-fadeup space-y-4 pb-28">
        <div className="flex items-center justify-between pt-1">
          <span className="font-label text-[16px] font-bold text-[var(--rd-ink)]">{fmtTime(elapsed)}</span>
          <div className="text-center">
            <p className="font-label text-[9px] tracking-[.16em]" style={{ color: '#22D3EE' }}>CARDIO · IN PROGRESS</p>
            <p className="text-[13px] font-semibold text-[var(--rd-ink)]">{s.name}</p>
          </div>
          <button onClick={() => setFinishing(true)} className="font-label flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold" style={{ borderColor: 'rgba(34,211,238,.5)', background: 'rgba(34,211,238,.12)', color: '#22D3EE' }}>
            <CheckIcon size={13} /> Finish
          </button>
        </div>
        <CardioSession segments={s.segments} onChange={s.updateSegment} onSetMetrics={s.setSegmentMetrics} />
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
          <div className="pointer-events-auto w-full max-w-[430px] px-5 pb-6 pt-2" style={{ background: 'linear-gradient(180deg, transparent, var(--rd-bg) 40%)' }}>
            <button onClick={() => setFinishing(true)} className="flex h-12 w-full items-center justify-center rounded-[14px] text-[15px] font-semibold text-[#0A0C10]" style={{ background: '#22D3EE' }}>Finish &amp; rate session</button>
          </div>
        </div>
      </div>
    );
  }

  const safeIdx = Math.min(exIdx, s.exercises.length - 1);
  const ex = s.exercises[safeIdx];
  const next = s.exercises[safeIdx + 1];
  const goTo = (i: number) => { setActiveSet(null); setDemo(null); setGifFailed(false); setExIdx(Math.max(0, Math.min(s.exercises.length - 1, i))); };
  const hasGif = !!ex.gifUrl;
  const hasVideo = !!ex.youtubeId;
  // Prefer the (reliable) video; fall back to the GIF; never silently vanish.
  const openDemo = () => setDemo(hasVideo ? 'video' : hasGif && !gifFailed ? 'gif' : 'unavailable');
  const skip = () => goTo(safeIdx + 1);
  const barDisplay = unit === 'lb' ? barLb : lbToKg(barLb);
  // Selected set to edit: explicit choice, else first unlogged, else none.
  const firstUnlogged = ex.sets.findIndex((st) => !st.done);
  const activeIdx = activeSet != null && activeSet < ex.sets.length ? activeSet : firstUnlogged;
  // Selecting another set auto-logs the current one (if it has a weight and
  // isn't already logged), then moves the editor to the tapped set.
  const selectSet = (i: number) => {
    const a = activeIdx;
    if (a >= 0 && a !== i && !ex.sets[a].done && ex.sets[a].weightLb > 0) {
      s.updateSet(safeIdx, a, { done: true });
    }
    setActiveSet(i);
  };

  // Apply a pick from the library or a machine photo to the current exercise.
  const pickSwap = async (opt: PickOption) => {
    const name = await s.photoSwapExercise(safeIdx, { exerciseId: opt.id, name: opt.name, muscleGroup: opt.muscleGroup });
    setPickerMode(null);
    if (name) {
      setActiveSet(null); setDemo(null); setGifFailed(false);
      setSwapToast(name);
    } else {
      setSwapError('Swap failed. Try again.');
    }
  };

  // Add a new exercise to the workout, then jump to it.
  const pickAdd = async (opt: PickOption) => {
    const idx = await s.addExercise({ exerciseId: opt.id, name: opt.name, muscleGroup: opt.muscleGroup });
    setPickerMode(null);
    if (idx != null) {
      setActiveSet(null); setDemo(null); setGifFailed(false);
      setExIdx(idx);
      setSwapToast(`Added ${opt.name}`);
    } else {
      setSwapError('Couldn’t add that exercise. Try again.');
    }
  };

  return (
    <div className="animate-fadeup space-y-4 pb-28">
      {/* Top bar — Finish lives here (deliberate), not as a big bottom button. */}
      <div className="flex items-center justify-between pt-1">
        <span className="font-label text-[16px] font-bold text-[var(--rd-ink)]">{fmtTime(elapsed)}</span>
        <div className="text-center">
          <p className="font-label text-[9px] tracking-[.16em] text-[var(--rd-ember)]">IN PROGRESS</p>
          <p className="text-[13px] font-semibold text-[var(--rd-ink)]">{s.name}</p>
        </div>
        <button onClick={() => setFinishing(true)} className="font-label flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold" style={{ borderColor: 'rgba(255,107,69,.45)', background: 'rgba(255,107,69,.1)', color: 'var(--rd-ember)' }}>
          <CheckIcon size={13} /> Finish
        </button>
      </div>

      {/* Current exercise card */}
      <section className="rd-card p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => goTo(safeIdx - 1)} disabled={safeIdx === 0} className="text-[var(--rd-text-muted)] disabled:opacity-30" aria-label="Previous exercise"><ChevronLeftIcon size={20} /></button>
          <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">EXERCISE {safeIdx + 1} / {s.exercises.length}</span>
          <button onClick={() => goTo(safeIdx + 1)} disabled={safeIdx === s.exercises.length - 1} className="rotate-180 text-[var(--rd-text-muted)] disabled:opacity-30" aria-label="Next exercise"><ChevronLeftIcon size={20} /></button>
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

        {/* Watch how-to — inline compact player; keeps the sets visible below */}
        {(hasGif || hasVideo) && (
          demo ? (
            <div className="mt-3 overflow-hidden rounded-[12px] border border-[var(--rd-border)] bg-black">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="font-label text-[10px] tracking-[.12em] text-[var(--rd-text-faint)]">HOW-TO</span>
                <div className="flex items-center gap-2">
                  {hasVideo && demo === 'gif' && <button onClick={() => setDemo('video')} className="font-label text-[10px] font-semibold text-[var(--rd-lime)]">VIDEO</button>}
                  {hasGif && !gifFailed && demo === 'video' && <button onClick={() => setDemo('gif')} className="font-label text-[10px] font-semibold text-[var(--rd-lime)]">GIF</button>}
                  <button onClick={() => setDemo(null)} aria-label="Close demo" className="text-[var(--rd-text-muted)]"><CloseIcon size={15} /></button>
                </div>
              </div>
              {demo === 'gif' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ex.gifUrl} alt={ex.name} className="max-h-[200px] w-full object-contain" onError={() => { setGifFailed(true); setDemo(hasVideo ? 'video' : 'unavailable'); }} />
              ) : demo === 'video' ? (
                <div className="aspect-video w-full">
                  {/* Driven by the YT IFrame API so it autoplays muted inline on iOS.
                      No "Open in YouTube" link — keeps the user in-app. */}
                  <YouTubeAutoplay key={ex.youtubeId} videoId={ex.youtubeId!} title={ex.name} />
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-[13px] text-[var(--rd-text-muted)]">No demo available for this exercise yet.</p>
                </div>
              )}
            </div>
          ) : (
            <button onClick={openDemo} className="mt-3 flex w-full items-center gap-3 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card)] p-2.5">
              <span className="flex h-9 w-12 items-center justify-center rounded-[8px]" style={{ background: 'linear-gradient(135deg,#26282f,#15171c)' }}>
                <PlayIcon size={14} className="text-white/90" />
              </span>
              <span className="flex-1 text-left text-[13px] font-medium text-[var(--rd-text-secondary)]">Watch how-to</span>
              <span className="font-label rounded-[6px] px-1.5 py-0.5 text-[9px] font-bold" style={{ background: hasVideo ? 'var(--rd-youtube)' : 'rgba(200,255,77,.14)', color: hasVideo ? '#fff' : 'var(--rd-lime)' }}>
                {hasVideo ? 'VIDEO' : 'DEMO'}
              </span>
            </button>
          )
        )}

        {/* Controls row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setUnit(unit === 'lb' ? 'kg' : 'lb')} className="font-label flex items-center gap-1.5 rounded-[9px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3 py-1.5 text-[11px] font-semibold uppercase text-[var(--rd-ember)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v18M7 3 4 6M7 3l3 3M17 21V3M17 21l-3-3M17 21l3-3" /></svg>
            {unit}
          </button>
          {/* Swap this exercise — from the library or by photographing a machine. */}
          <button
            onClick={() => { setSwapError(null); setPickerMode('swap'); }}
            className="font-label flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[11px] font-semibold uppercase"
            style={{ borderColor: 'rgba(34,211,238,.3)', background: 'rgba(34,211,238,.1)', color: '#22D3EE' }}
          >
            <CameraIcon size={13} /> Swap
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
                    onFocus={(e) => { setBarDraft(String(Math.round(barDisplay))); selectAll(e.currentTarget); }}
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
        <div className="mt-4 space-y-2">
          <div className="font-label grid grid-cols-[28px_1fr_1fr_24px] gap-2 px-1 text-[9px] tracking-[.1em] text-[var(--rd-text-faint)]">
            <span>SET</span><span>{perSide && ex.isBarbell ? 'PER SIDE' : 'LAST TIME'}</span><span>THIS SET</span><span />
          </div>
          {ex.sets.map((set, i) =>
            i === activeIdx ? (
              <ActiveSet
                key={i}
                n={i + 1}
                set={set}
                unit={unit}
                perSide={perSide && ex.isBarbell}
                barDisplay={barDisplay}
                onChange={(patch) => s.updateSet(safeIdx, i, patch)}
                onLog={() => {
                  const cur = ex.sets[i];
                  s.updateSet(safeIdx, i, { done: true });
                  // Always advance to the immediate next set (even if it's already
                  // logged, so you can review/edit it); pre-fill it only if empty.
                  const nextIdx = i + 1;
                  if (nextIdx < ex.sets.length) {
                    if (!ex.sets[nextIdx].done) s.updateSet(safeIdx, nextIdx, { weightLb: cur.weightLb, reps: cur.reps });
                    setActiveSet(nextIdx);
                  } else {
                    setActiveSet(null);
                  }
                }}
              />
            ) : (
              <CompactRow
                key={i}
                n={i + 1}
                set={set}
                unit={unit}
                perSide={perSide && ex.isBarbell}
                barDisplay={barDisplay}
                onSelect={() => selectSet(i)}
                onToggle={() => s.updateSet(safeIdx, i, { done: !set.done })}
              />
            ),
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => s.removeSet(safeIdx)} disabled={ex.sets.length <= 1} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-2.5 text-[13px] font-semibold text-[var(--rd-text-secondary)] disabled:opacity-40"><MinusIcon size={14} /> Remove set</button>
            <button onClick={() => s.addSet(safeIdx)} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border py-2.5 text-[13px] font-semibold" style={{ borderColor: 'rgba(200,255,77,.3)', background: 'rgba(200,255,77,.08)', color: 'var(--rd-lime)' }}><PlusIcon size={14} /> Add set</button>
          </div>
          <button onClick={() => s.fillRemaining(safeIdx)} className="w-full py-1 text-[12px] font-semibold text-[var(--rd-text-faint)]">Fill remaining with last set</button>
        </div>
      </section>

      {/* Add an exercise to this workout on the fly (library or machine photo) */}
      <button onClick={() => { setSwapError(null); setPickerMode('add'); }} className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed py-3.5 text-[13px] font-semibold" style={{ borderColor: 'rgba(255,255,255,.14)', color: 'var(--rd-text-secondary)' }}>
        <PlusIcon size={16} /> Add exercise
      </button>

      {/* Bottom bar — go to the NEXT exercise (prominent, clickable). On the last
          exercise there's no next, so it becomes Finish. Finish is also at the top. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
        <div className="pointer-events-auto flex w-full max-w-[430px] gap-2 px-5 pb-6 pt-2" style={{ background: 'linear-gradient(180deg, transparent, var(--rd-bg) 40%)' }}>
          {safeIdx > 0 && (
            <button onClick={() => goTo(safeIdx - 1)} aria-label="Previous exercise" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border" style={{ borderColor: 'var(--rd-border)', background: 'var(--rd-card)' }}>
              <ChevronLeftIcon size={22} className="text-[var(--rd-text-secondary)]" />
            </button>
          )}
          {next ? (
            <button onClick={skip} className="flex h-14 flex-1 items-center justify-between rounded-[14px] border px-5 text-left" style={{ borderColor: 'rgba(255,107,69,.45)', background: 'rgba(255,107,69,.12)', boxShadow: '0 10px 30px -12px rgba(255,107,69,.4)' }}>
              <span className="min-w-0">
                <span className="font-label block text-[9px] tracking-[.16em] text-[var(--rd-ember)]">NEXT UP</span>
                <span className="block truncate text-[15px] font-bold text-[var(--rd-ink)]">{next.name}</span>
              </span>
              <ArrowRightIcon size={22} className="shrink-0 text-[var(--rd-ember)]" />
            </button>
          ) : (
            <button onClick={() => setFinishing(true)} className="grad-ember flex h-14 flex-1 items-center justify-center rounded-[14px] text-[15px] font-semibold text-[#0A0C10]" style={{ boxShadow: 'var(--rd-glow-ember)' }}>Finish &amp; rate workout</button>
          )}
        </div>
      </div>

      {/* Picker — swap the current exercise (muscle-biased) or add a new one */}
      {pickerMode === 'swap' && (
        <ExercisePicker label={ex.name} targetMuscle={ex.muscle} onPick={pickSwap} onClose={() => setPickerMode(null)} />
      )}
      {pickerMode === 'add' && (
        <ExercisePicker label="Add exercise" onPick={pickAdd} onClose={() => setPickerMode(null)} />
      )}
      {swapError && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto flex max-w-[430px] items-center gap-2 px-5">
          <div className="flex-1 rounded-[12px] border px-3.5 py-2.5 text-[12px]" style={{ borderColor: 'rgba(255,107,69,.4)', background: 'rgba(255,107,69,.12)', color: 'var(--rd-ember)' }}>{swapError}</div>
          <button onClick={() => setSwapError(null)} aria-label="Dismiss" className="text-[var(--rd-text-muted)]"><CloseIcon size={16} /></button>
        </div>
      )}
      {swapToast && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto flex max-w-[430px] items-center gap-2 px-5">
          <div className="flex flex-1 items-center gap-2 rounded-[12px] border px-3.5 py-2.5 text-[12px] font-semibold" style={{ borderColor: 'rgba(34,211,238,.4)', background: 'rgba(34,211,238,.12)', color: '#22D3EE' }}>
            <CheckIcon size={15} /> Swapped to {swapToast}
          </div>
          <button onClick={() => setSwapToast(null)} aria-label="Dismiss" className="text-[var(--rd-text-muted)]"><CloseIcon size={16} /></button>
        </div>
      )}
    </div>
  );
}

// Compact row for done / upcoming sets — tap anywhere to open it for editing.
function CompactRow({ n, set, unit, perSide, barDisplay, onSelect, onToggle }: { n: number; set: SetEntry; unit: Unit; perSide: boolean; barDisplay: number; onSelect: () => void; onToggle: () => void }) {
  const perSideVal = cleanW(perSideDisplay(set.weightLb, unit, barDisplay), unit);
  const midText = perSide
    ? (set.weightLb > 0 ? `2×${perSideVal}${unit} /side` : '—')
    : (set.lastWeightLb != null ? `${formatWeight(set.lastWeightLb, unit)} × ${set.lastReps ?? '–'}` : '—');
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className="grid cursor-pointer select-none grid-cols-[28px_1fr_1fr_24px] items-center gap-2 rounded-[11px] px-1 py-2.5 transition-colors active:bg-[var(--rd-card-glass)]"
      style={{ WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="font-num text-[13px] font-bold text-[var(--rd-text-muted)]">{n}</span>
      <span className="font-label text-[12px]" style={{ color: perSide ? 'var(--rd-ember)' : 'var(--rd-text-faint)' }}>{midText}</span>
      <span className="font-label text-[12px]" style={{ color: set.done ? 'var(--rd-lime)' : 'var(--rd-text-faint)' }}>
        {set.done ? `${formatWeight(set.weightLb, unit)} × ${set.reps}` : 'tap to edit'}
      </span>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="Toggle logged" className="flex justify-center">
        {set.done ? <span className="text-[var(--rd-lime)]"><CheckIcon size={15} /></span> : <span className="h-4 w-4 rounded-full border border-[var(--rd-border-strong)]" />}
      </button>
    </div>
  );
}

// Single active-set editor — the ember card (V2 design), with per-side + editable weight
function ActiveSet({ n, set, unit, perSide, barDisplay, onChange, onLog }: {
  n: number; set: SetEntry; unit: Unit; perSide: boolean; barDisplay: number; onChange: (p: Partial<SetEntry>) => void; onLog: () => void;
}) {
  const totalDisplay = toDisplay(set.weightLb, unit);
  const perSideVal = perSide ? perSideDisplay(set.weightLb, unit, barDisplay) : totalDisplay;
  const shown = perSide ? perSideVal : totalDisplay;
  const step = perSide ? 5 : unit === 'kg' ? 2.5 : 5;
  const setShown = (v: number) => {
    onChange({ weightLb: perSide ? totalLbFromPerSide(v, unit, barDisplay) : totalLbFromDisplay(v, unit) });
  };
  const otherLabel = unit === 'lb' ? `${lbToKg(set.weightLb)}kg` : `${Math.round(set.weightLb)}lb`;

  return (
    <div className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--rd-ember)', background: 'rgba(255,107,69,.08)' }}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">SET {n}</span>
        {set.lastWeightLb != null && (
          <span className="font-label text-[10px] text-[var(--rd-text-faint)]">Last {formatWeight(set.lastWeightLb, unit)} × {set.lastReps ?? '–'}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="font-label mb-1.5 text-center text-[9px] tracking-[.12em] text-[var(--rd-text-faint)]">{perSide ? 'WEIGHT / SIDE' : `WEIGHT (${unit})`}</p>
          <NumStepper value={shown} step={step} decimals={unit === 'kg' && !perSide ? 1 : 0} onChange={setShown} />
        </div>
        <div>
          <p className="font-label mb-1.5 text-center text-[9px] tracking-[.12em] text-[var(--rd-text-faint)]">REPS</p>
          <NumStepper value={set.reps} step={1} decimals={0} onChange={(v) => onChange({ reps: Math.max(0, Math.round(v)) })} />
        </div>
      </div>
      {perSide && set.weightLb > 0 && (
        <p className="font-label mt-2 text-center text-[10px] text-[var(--rd-lime)]">
          = {cleanW(totalDisplay, unit)}{unit} total · {cleanW(barDisplay, unit)}{unit} bar + 2×{perSideVal}{unit}  <span className="text-[var(--rd-text-faint)]">= {otherLabel}</span>
        </p>
      )}
      {!perSide && set.weightLb > 0 && (
        <p className="font-label mt-2 text-center text-[10px] text-[var(--rd-text-faint)]">= {otherLabel}</p>
      )}
      <button onClick={onLog} className="grad-lime mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold text-[#0A0C10]">
        {set.done ? 'Update' : 'Log'} set {n} <CheckIcon size={16} />
      </button>
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
        onFocus={(e) => { setDraft(shown); selectAll(e.currentTarget); }}
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
