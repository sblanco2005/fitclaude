'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Workout, WorkoutExercise } from '@/types';
import { CheckIcon, ChevronLeftIcon, SpinIcon, LibraryIcon, SearchIcon, CloseIcon, PlusIcon, PlayIcon } from '@/components/redesign/icons';
import { readImageCompressed } from '@/lib/image';
import { YouTubeAutoplay } from '@/components/redesign/session/YouTubeAutoplay';

type LibEx = { id: string; name: string; muscleGroup: string; exerciseType: string };
// A pick option: an existing library exercise (has id) or a vision-identified
// one to find-or-create by name.
type PickOption = { id?: string; name: string; muscleGroup?: string; confidence?: string };

function CameraIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

// Screen 09 · Workout Detail — accent: ember
const titleCase = (s?: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// A cardio exercise carries a time/distance/calorie target instead of weight.
const isCardioExercise = (e: WorkoutExercise) =>
  e.durationSeconds != null || e.distance != null || e.caloriesTarget != null;

// The planned target for a cardio segment ("6:30", "2000 m", "60 cal", "×20").
function cardioTargetLabel(e: WorkoutExercise): string {
  if (e.durationSeconds != null) return fmtDur(e.durationSeconds);
  if (e.distance != null) return `${e.distance} ${e.distanceUnit ?? 'm'}`;
  if (e.caloriesTarget != null) return `${e.caloriesTarget} cal`;
  if (e.reps) return `×${e.reps}`;
  return '—';
}

// Tolerate legacy double-encoded setLogs.
function parseLogArray(raw: string | null | undefined): Array<{ durationSec?: number; distance?: number; distanceUnit?: string; calories?: number; reps?: number | null }> {
  try {
    let v = raw ? JSON.parse(raw) : [];
    if (typeof v === 'string') v = JSON.parse(v);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// What the user actually logged for a cardio segment across its rounds.
function cardioLoggedLabel(setLogs: string | null | undefined): string | null {
  const rounds = parseLogArray(setLogs);
  const parts = rounds
    .map((r) => {
      const p: string[] = [];
      if (r.durationSec) p.push(fmtDur(r.durationSec));
      if (r.distance) p.push(`${r.distance} ${r.distanceUnit ?? 'm'}`);
      if (r.calories) p.push(`${r.calories} cal`);
      if (r.reps) p.push(`×${r.reps}`);
      return p.join(' · ');
    })
    .filter(Boolean);
  return parts.length ? parts.join('  ·  ') : null;
}

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [w, setW] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  // Exercise picker — replace an existing exercise or add a new one; via library
  // search OR a photo of the machine (Meta vision).
  const [sheetMode, setSheetMode] = useState<'replace' | 'add' | null>(null);
  const [libFor, setLibFor] = useState<WorkoutExercise | null>(null); // replace target
  const [lib, setLib] = useState<LibEx[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [applying, setApplying] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState<{ equipment: string; options: PickOption[] } | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const idFileRef = useRef<HTMLInputElement>(null);
  // Inline exercise demo (GIF / video) — which row is open + which media.
  const [demoFor, setDemoFor] = useState<string | null>(null);
  const [demoKind, setDemoKind] = useState<'gif' | 'video' | 'unavailable'>('gif');
  const [gifFailed, setGifFailed] = useState(false);

  const load = async () => {
    const r = await fetch(`/api/workouts/${id}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setW(r);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const exercises = (w?.exercises ?? []).slice().sort((a, b) => a.order - b.order);
  const estMin = Math.max(0, exercises.length * 8);
  const name = titleCase(w?.name?.trim() || w?.workoutType) || 'Workout';
  const cardioWorkout = w?.category === 'cardio' || w?.workoutType === 'cardio';

  const hitIt = async () => {
    if (starting) return;
    setStarting(true);
    const r = await fetch(`/api/workouts/${id}/duplicate`, { method: 'POST' }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setStarting(false);
    if (r?.id) router.push(`/v2/train/session/${r.id}`);
  };

  // Reorder — optimistic, then persist. If the persist fails, reload so the UI
  // reflects the real DB order instead of a stale optimistic swap.
  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= exercises.length) return;
    const next = [...exercises];
    [next[idx], next[j]] = [next[j], next[idx]];
    const orderedIds = next.map((e) => e.id);
    setW((prev) => (prev ? { ...prev, exercises: next.map((e, i) => ({ ...e, order: i + 1 })) } : prev));
    const r = await fetch(`/api/workouts/${id}/exercises/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    }).catch(() => null);
    if (!r || !r.ok) await load();
  };

  // Toggle the inline demo for a row (prefer video, else GIF).
  const toggleDemo = (weId: string, hasVideo: boolean, hasGif: boolean) => {
    if (demoFor === weId) { setDemoFor(null); return; }
    setGifFailed(false);
    setDemoKind(hasVideo ? 'video' : hasGif ? 'gif' : 'unavailable');
    setDemoFor(weId);
  };

  const loadLib = async () => {
    setLibLoading(true);
    const list = await fetch('/api/exercises').then((x) => (x.ok ? x.json() : [])).catch(() => []);
    setLib(Array.isArray(list) ? list : []);
    setLibLoading(false);
  };

  const openReplace = async (e: WorkoutExercise) => {
    setSheetMode('replace'); setLibFor(e); setLibSearch(''); setIdentified(null); setIdError(null);
    await loadLib();
  };
  const openAdd = async () => {
    setSheetMode('add'); setLibFor(null); setLibSearch(''); setIdentified(null); setIdError(null);
    await loadLib();
  };
  const closeSheet = () => { setSheetMode(null); setLibFor(null); setIdentified(null); setIdError(null); setLibSearch(''); };

  // Apply a pick — replace the target exercise or append a new one. Accepts a
  // library id or a name (find-or-create on the server for unknown machines).
  const applyPick = async (opt: PickOption) => {
    if (applying) return;
    setApplying(true);
    const target = libFor?.id;
    if (sheetMode === 'replace') setSwapping(target ?? null);
    try {
      if (sheetMode === 'replace' && target) {
        const body = opt.id ? { newExerciseId: opt.id } : { newExerciseName: opt.name, newExerciseMuscle: opt.muscleGroup };
        await fetch(`/api/workouts/${id}/exercises/${target}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else if (sheetMode === 'add') {
        const body = opt.id ? { exerciseId: opt.id } : { exerciseName: opt.name, exerciseMuscle: opt.muscleGroup };
        await fetch(`/api/workouts/${id}/exercises`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      closeSheet();
      await load();
    } finally {
      setApplying(false);
      setSwapping(null);
    }
  };

  // Photo the machine → identify → surface options (library matches + the
  // identified exercise as a "new" pick) at the top of the sheet.
  const onIdentifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setIdentifying(true); setIdError(null); setIdentified(null);
    try {
      const img = await readImageCompressed(f);
      // When replacing, bias suggestions toward that exercise's muscle group.
      const targetMuscle = sheetMode === 'replace' ? (libFor?.exercise?.muscleGroup ?? null) : null;
      const res = await fetch('/api/exercises/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: img.base64, image_media_type: img.mediaType, target_muscle: targetMuscle }) });
      const data = res.ok ? await res.json() : { error: 'Identify failed' };
      const opts: PickOption[] = (data.matches ?? []).map((m: { id: string; name: string; muscleGroup: string; confidence: string }) => ({ id: m.id, name: m.name, muscleGroup: m.muscleGroup, confidence: m.confidence }));
      const primary = (data.primary_exercise || '').trim();
      if (primary && !opts.some((o) => o.name.toLowerCase() === primary.toLowerCase())) {
        opts.unshift({ name: primary, muscleGroup: data.muscle_group || undefined });
      }
      if (!opts.length) { setIdError(data.error || 'Couldn’t identify the machine. Try a clearer photo.'); return; }
      setIdentified({ equipment: data.raw_identification || 'this machine', options: opts });
    } catch {
      setIdError('Couldn’t read the photo. Try again.');
    } finally {
      setIdentifying(false);
    }
  };

  if (loading) return <div className="rd-card mt-6 h-[400px] animate-pulse-soft" />;
  if (!w) {
    return (
      <div className="rd-card mt-10 p-6 text-center">
        <p className="text-[14px] text-[var(--rd-text-muted)]">Routine not found.</p>
        <button onClick={() => router.push('/v2/train')} className="mt-3 text-[13px] font-semibold text-[var(--rd-ember)]">Back to Train</button>
      </div>
    );
  }

  const libFiltered = libSearch.trim()
    ? lib.filter((x) => x.name.toLowerCase().includes(libSearch.trim().toLowerCase()) || x.muscleGroup.includes(libSearch.trim().toLowerCase()))
    : lib;

  return (
    <div className="animate-fadeup space-y-4">
      {/* Top */}
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => router.push('/v2/train')} aria-label="Back" className="text-[var(--rd-text-muted)]">
          <ChevronLeftIcon size={22} />
        </button>
        <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-ember)]">
          {w.displayId != null ? `#${w.displayId} · ` : ''}{titleCase(w.workoutType)}
        </p>
        <span className="w-[22px]" />
      </div>

      <h1 className="font-display text-[25px] font-bold text-[var(--rd-ink)]">{name}</h1>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        <Chip>{exercises.length} exercises</Chip>
        <Chip>~{estMin} min</Chip>
        <Chip lime><CheckIcon size={12} /> Ready</Chip>
      </div>

      {/* Hit it */}
      <button
        onClick={hitIt}
        disabled={starting}
        className="grad-ember relative flex h-12 w-full items-center justify-center overflow-hidden rounded-[14px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60"
        style={{ boxShadow: 'var(--rd-glow-ember)' }}
      >
        <span className="relative z-10">{starting ? 'Starting…' : 'Hit it'}</span>
        {!starting && <span aria-hidden className="animate-sheen absolute inset-y-0 -left-1/3 z-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }} />}
      </button>

      {/* Exercise rows */}
      <div className="space-y-2.5">
        {exercises.map((e, i) => {
          const gif = e.exercise?.gifUrl;
          const vid = e.exercise?.videos?.[0]?.youtubeVideoId;
          const hasGif = !!gif;
          const hasVideo = !!vid;
          const hasDemo = hasGif || hasVideo;
          const open = demoFor === e.id;
          return (
          <div key={e.id} className="rd-card p-3">
            <div className="flex items-center gap-2.5">
              <span className="font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--rd-card)] text-[13px] font-bold text-[var(--rd-text-muted)]">{i + 1}</span>
              {/* Tap the name to watch a demo */}
              <button onClick={() => hasDemo && toggleDemo(e.id, hasVideo, hasGif)} className="min-w-0 flex-1 text-left" aria-label={hasDemo ? 'Watch demo' : undefined}>
                <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-[var(--rd-ink)]">
                  {e.exercise?.name || e.variation?.name || 'Exercise'}
                  {hasDemo && <PlayIcon size={11} className={open ? 'text-[var(--rd-lime)]' : 'text-[var(--rd-text-faint)]'} />}
                </p>
                <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">
                  {cardioWorkout || isCardioExercise(e) ? (
                    <>
                      {/* Logged actuals for a finished session, else the planned target */}
                      {(w.completed && cardioLoggedLabel(e.setLogs)) || cardioTargetLabel(e)}
                      {e.restSeconds ? ` · rest ${e.restSeconds}s` : ''}
                    </>
                  ) : (
                    <>
                      {e.sets} × {e.reps ?? '–'}
                      {e.weightKg ? ` · ${Math.round(e.weightKg)} kg` : ''}
                      {e.restSeconds ? ` · rest ${e.restSeconds}s` : ''}
                    </>
                  )}
                </p>
              </button>

              {/* Reorder — padded for a comfortable tap target */}
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex h-6 w-8 items-center justify-center text-[var(--rd-text-muted)] disabled:opacity-20">
                  <ChevronLeftIcon size={16} className="rotate-90" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label="Move down" className="flex h-6 w-8 items-center justify-center text-[var(--rd-text-muted)] disabled:opacity-20">
                  <ChevronLeftIcon size={16} className="-rotate-90" />
                </button>
              </div>

              {/* Replace exercise (library or photo) */}
              <button onClick={() => openReplace(e)} disabled={swapping === e.id} aria-label="Replace exercise" className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--rd-text-muted)]">
                {swapping === e.id ? <SpinIcon size={17} className="animate-spinslow" /> : <LibraryIcon size={17} />}
              </button>
            </div>

            {/* Inline demo player */}
            {open && (
              <div className="mt-2.5 overflow-hidden rounded-[12px] border border-[var(--rd-border)] bg-black">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="font-label text-[10px] tracking-[.12em] text-[var(--rd-text-faint)]">HOW-TO</span>
                  <div className="flex items-center gap-2">
                    {hasVideo && demoKind === 'gif' && <button onClick={() => setDemoKind('video')} className="font-label text-[10px] font-semibold text-[var(--rd-lime)]">VIDEO</button>}
                    {hasGif && !gifFailed && demoKind === 'video' && <button onClick={() => setDemoKind('gif')} className="font-label text-[10px] font-semibold text-[var(--rd-lime)]">GIF</button>}
                    <button onClick={() => setDemoFor(null)} aria-label="Close demo" className="text-[var(--rd-text-muted)]"><CloseIcon size={15} /></button>
                  </div>
                </div>
                {demoKind === 'gif' && hasGif ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gif} alt={e.exercise?.name || 'demo'} className="max-h-[220px] w-full object-contain" onError={() => { setGifFailed(true); setDemoKind(hasVideo ? 'video' : 'unavailable'); }} />
                ) : demoKind === 'video' && hasVideo ? (
                  <div className="aspect-video w-full"><YouTubeAutoplay key={vid} videoId={vid!} title={e.exercise?.name || 'demo'} /></div>
                ) : (
                  <div className="px-4 py-6 text-center"><p className="text-[13px] text-[var(--rd-text-muted)]">No demo available for this exercise yet.</p></div>
                )}
              </div>
            )}
          </div>
          );
        })}

        {/* Add an exercise — library or photo a machine */}
        <button onClick={openAdd} className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed py-3.5 text-[13px] font-semibold" style={{ borderColor: 'rgba(255,255,255,.14)', color: 'var(--rd-text-secondary)' }}>
          <PlusIcon size={16} /> Add exercise
        </button>
      </div>

      {/* Exercise picker — replace or add, via library search or a machine photo */}
      {sheetMode && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={closeSheet}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
          <div className="relative flex max-h-[84%] w-full flex-col overflow-hidden rounded-t-[24px] border-t border-[var(--rd-border)] pb-6" style={{ background: '#0F1117' }} onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pb-1 pt-5">
              <div className="min-w-0">
                <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">{sheetMode === 'replace' ? 'REPLACING' : 'ADD EXERCISE'}</p>
                <h3 className="font-display mt-0.5 truncate text-[18px] font-bold text-[var(--rd-ink)]">{sheetMode === 'replace' ? (libFor?.exercise?.name || 'Exercise') : 'Pick or snap a machine'}</h3>
              </div>
              <button onClick={closeSheet} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
            </div>

            {/* Search + camera */}
            <div className="flex items-center gap-2 px-5 pb-3 pt-3">
              <div className="flex flex-1 items-center gap-2 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3.5 py-2.5">
                <SearchIcon size={17} className="text-[var(--rd-text-faint)]" />
                <input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search exercises…" className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none" />
              </div>
              <button onClick={() => idFileRef.current?.click()} disabled={identifying} aria-label="Photo a machine" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border disabled:opacity-60" style={{ borderColor: 'rgba(34,211,238,.35)', background: 'rgba(34,211,238,.12)', color: '#22D3EE' }}>
                {identifying ? <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg> : <CameraIcon size={18} />}
              </button>
              <input ref={idFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onIdentifyFile} />
            </div>

            <div className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-5">
              {/* Identified-from-photo options */}
              {idError && <p className="rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: 'rgba(255,107,69,.4)', background: 'rgba(255,107,69,.1)', color: 'var(--rd-ember)' }}>{idError}</p>}
              {identified && (
                <div className="mb-1.5 rounded-[12px] border p-2.5" style={{ borderColor: 'rgba(34,211,238,.3)', background: 'rgba(34,211,238,.06)' }}>
                  <p className="font-label px-1 pb-1.5 text-[9px] tracking-[.14em]" style={{ color: '#22D3EE' }}>SPOTTED · {identified.equipment.toUpperCase()}</p>
                  <div className="space-y-1.5">
                    {identified.options.map((o, i) => (
                      <button key={i} onClick={() => applyPick(o)} disabled={applying} className="flex w-full items-center justify-between rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-2.5 text-left disabled:opacity-50">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-[var(--rd-ink)]">{o.name}</span>
                          {o.muscleGroup && <span className="font-label text-[11px] capitalize text-[var(--rd-text-faint)]">{o.muscleGroup}</span>}
                        </span>
                        {o.id ? <span className="font-label ml-2 shrink-0 text-[9px] tracking-[.1em] text-[var(--rd-text-faint)]">{(o.confidence || '').toUpperCase()}</span> : <span className="font-label ml-2 shrink-0 rounded-[6px] px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(34,211,238,.15)', color: '#22D3EE' }}>NEW</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Library list */}
              {libLoading ? (
                <p className="py-8 text-center text-[13px] text-[var(--rd-text-faint)]">Loading…</p>
              ) : libFiltered.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[var(--rd-text-faint)]">No matches.</p>
              ) : (
                libFiltered.map((x) => (
                  <button key={x.id} onClick={() => applyPick({ id: x.id, name: x.name, muscleGroup: x.muscleGroup })} disabled={applying} className="flex w-full items-center justify-between rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-left active:bg-[var(--rd-card-glass-hover)] disabled:opacity-50">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--rd-ink)]">{x.name}</span>
                      <span className="font-label block text-[11px] capitalize text-[var(--rd-text-faint)]">{x.muscleGroup} · {x.exerciseType}</span>
                    </span>
                    {sheetMode === 'replace' && x.name === libFor?.exercise?.name && <CheckIcon size={16} className="shrink-0 text-[var(--rd-lime)]" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children, lime }: { children: React.ReactNode; lime?: boolean }) {
  return (
    <span
      className="font-label flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium"
      style={{
        borderColor: lime ? 'rgba(200,255,77,.3)' : 'var(--rd-border)',
        color: lime ? 'var(--rd-lime)' : 'var(--rd-text-muted)',
        background: 'var(--rd-card-glass)',
      }}
    >
      {children}
    </span>
  );
}
