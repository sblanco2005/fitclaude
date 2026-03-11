'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import type { Workout, WorkoutExercise, ExerciseGroup } from '@/types';
import SetRow, { type WeightUnit, lbToKg } from '@/components/workout/SetRow';
import ExerciseListSheet from '@/components/workout/ExerciseListSheet';
import { groupExercises } from '@/lib/workout-utils';

interface SetLog {
  set: number;
  weight: number;
  reps: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, string> = {
  chest: 'bg-blue-500/20 text-blue-300',
  back: 'bg-green-500/20 text-green-300',
  legs: 'bg-yellow-500/20 text-yellow-300',
  shoulders: 'bg-purple-500/20 text-purple-300',
  arms: 'bg-pink-500/20 text-pink-300',
  biceps: 'bg-pink-500/20 text-pink-300',
  triceps: 'bg-pink-500/20 text-pink-300',
  core: 'bg-orange-500/20 text-orange-300',
  glutes: 'bg-yellow-500/20 text-yellow-300',
  hamstrings: 'bg-yellow-500/20 text-yellow-300',
  quadriceps: 'bg-yellow-500/20 text-yellow-300',
  calves: 'bg-yellow-500/20 text-yellow-300',
  cardio: 'bg-red-500/20 text-red-300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseExerciseNotes(notes: string | null): { name?: string; muscleGroup?: string; coachingTip?: string } | null {
  if (!notes) return null;
  const parts = notes.split('|');
  if (parts.length >= 3) return { name: parts[0], muscleGroup: parts[1], coachingTip: parts[2] };
  if (parts.length === 2) return { name: parts[0], muscleGroup: parts[1] };
  return null;
}

function getExerciseName(ex: WorkoutExercise): string {
  if (ex.exercise?.name) return ex.exercise.name;
  if (ex.variation?.name) return ex.variation.name;
  const parsed = parseExerciseNotes(ex.notes);
  if (parsed?.name) return parsed.name;
  return ex.notes || 'Exercise';
}

function getExerciseMuscle(ex: WorkoutExercise): string | null {
  if (ex.exercise?.muscleGroup) return ex.exercise.muscleGroup;
  const parsed = parseExerciseNotes(ex.notes);
  return parsed?.muscleGroup || null;
}

function getCoachingTip(ex: WorkoutExercise): string | null {
  const parsed = parseExerciseNotes(ex.notes);
  return parsed?.coachingTip || null;
}

function formatWeight(lbs: number, unit: 'lb' | 'kg'): string {
  if (unit === 'kg') return `${Math.round(lbToKg(lbs) * 10) / 10}kg`;
  return `${lbs}lb`;
}

function parseStoredSetLogs(setLogsJson: string | null): SetLog[] {
  if (!setLogsJson) return [];
  try {
    const arr = JSON.parse(setLogsJson);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function getLastLogForExercise(
  workouts: Workout[],
  exerciseName: string,
  excludeWorkoutId?: string,
): SetLog[] | null {
  for (const w of workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const ex of w.exercises) {
      if (getExerciseName(ex) === exerciseName) {
        const logs = parseStoredSetLogs(ex.setLogs);
        if (logs.length > 0) return logs;
      }
    }
  }
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FocusedExerciseViewProps {
  exercises: WorkoutExercise[];
  exerciseLogs: Map<string, SetLog[]>;
  onUpdateLogs: (exerciseId: string, logs: SetLog[], restSeconds?: number, totalSets?: number) => void;
  allWorkouts: Workout[];
  latestWorkoutId: string;
  onSwapExercise?: (exerciseId: string) => void;
  weightUnit: 'lb' | 'kg';
  isRunning: boolean;
  isPaused: boolean;
  elapsed: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FocusedExerciseView({
  exercises,
  exerciseLogs,
  onUpdateLogs,
  allWorkouts,
  latestWorkoutId,
  onSwapExercise,
  weightUnit,
  isRunning,
  isPaused,
  elapsed,
}: FocusedExerciseViewProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showVideo, setShowVideo] = useState<string | null>(null); // exercise id showing video
  const [showGif, setShowGif] = useState<string | null>(null); // exercise id showing gif
  const [skippedExercises, setSkippedExercises] = useState<Set<string>>(new Set());

  // Group exercises by supersetGroup
  const groups = useMemo(() => groupExercises(exercises), [exercises]);
  const totalGroups = groups.length;

  // Per-exercise settings (reset when navigating)
  const [unit, setUnit] = useState<WeightUnit>(weightUnit);
  const [plateMode, setPlateMode] = useState(() => {
    const first = exercises[0];
    if (!first) return false;
    const n = getExerciseName(first).toLowerCase();
    return n.includes('barbell') || (first.exercise?.equipmentRequired?.toLowerCase().includes('barbell') ?? false);
  });
  const [barWeight, setBarWeight] = useState(45);

  // Draft values: track unlogged set edits so we can auto-save on navigate
  const draftsRef = useRef<Map<string, { weight: number; reps: number }>>(new Map());

  const handleDraftChange = useCallback((exerciseId: string, setNum: number, weightLbs: number, reps: number) => {
    draftsRef.current.set(`${exerciseId}:${setNum}`, { weight: weightLbs, reps });
  }, []);

  // Auto-log any unlogged drafts for ALL exercises in the current group
  const autoSaveCurrent = useCallback(() => {
    const curGroup = groups[currentGroupIndex];
    if (!curGroup) return;
    for (const curEx of curGroup.exercises) {
      const curLogs = exerciseLogs.get(curEx.id) ?? [];
      const numSetsForEx = curEx.sets || 3;
      let updated = [...curLogs];
      let changed = false;
      for (let s = 1; s <= numSetsForEx; s++) {
        const key = `${curEx.id}:${s}`;
        const draft = draftsRef.current.get(key);
        if (draft && !curLogs.find((l) => l.set === s) && draft.weight > 0) {
          updated = [...updated.filter((l) => l.set !== s), { set: s, weight: draft.weight, reps: draft.reps }];
          changed = true;
        }
      }
      if (changed) {
        onUpdateLogs(curEx.id, updated.sort((a, b) => a.set - b.set));
      }
    }
  }, [currentGroupIndex, groups, exerciseLogs, onUpdateLogs]);

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentGroup = groups[currentGroupIndex];
  const nextGroup = groups[currentGroupIndex + 1] ?? null;
  if (!currentGroup) return null;
  const isSuperset = currentGroup.exercises.length > 1;

  // For backwards compatibility, pick primary exercise for single-exercise logic
  const ex = currentGroup.exercises[0];

  // Progress: count groups where ALL exercises have all sets logged
  const completedGroupCount = groups.filter((g) => {
    return g.exercises.every((e) => {
      const l = exerciseLogs.get(e.id) ?? [];
      return l.length >= (e.sets || 3);
    });
  }).length;

  // Check if ALL exercises in current group are fully logged
  const groupAllDone = currentGroup.exercises.every((e) => {
    const l = exerciseLogs.get(e.id) ?? [];
    return l.length >= (e.sets || 3);
  });

  // Map exercise index back to group index for ExerciseListSheet
  const exerciseToGroupIndex = useMemo(() => {
    const map = new Map<number, number>();
    let exIdx = 0;
    groups.forEach((g, gi) => {
      g.exercises.forEach(() => {
        map.set(exIdx, gi);
        exIdx++;
      });
    });
    return map;
  }, [groups]);

  // Timer format
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Check if any exercise in a group is barbell
  const isBarbellInGroup = (gi: number) => {
    const g = groups[gi];
    if (!g) return false;
    return g.exercises.some((e) => {
      const n = getExerciseName(e).toLowerCase();
      return n.includes('barbell') || (e.exercise?.equipmentRequired?.toLowerCase().includes('barbell') ?? false);
    });
  };

  // Navigation by group (auto-save drafts before moving)
  const goNext = () => {
    if (currentGroupIndex < totalGroups - 1) {
      autoSaveCurrent();
      setCurrentGroupIndex(currentGroupIndex + 1);
      setShowVideo(null);
      setShowGif(null);
      setPlateMode(isBarbellInGroup(currentGroupIndex + 1));
    }
  };
  const goPrev = () => {
    if (currentGroupIndex > 0) {
      autoSaveCurrent();
      setCurrentGroupIndex(currentGroupIndex - 1);
      setShowVideo(null);
      setShowGif(null);
      setPlateMode(isBarbellInGroup(currentGroupIndex - 1));
    }
  };
  const goToGroup = (gi: number) => {
    if (gi !== currentGroupIndex && gi >= 0 && gi < totalGroups) {
      autoSaveCurrent();
      setCurrentGroupIndex(gi);
      setShowVideo(null);
      setShowGif(null);
      setPlateMode(isBarbellInGroup(gi));
    }
  };
  // Map flat exercise index to group index for ExerciseListSheet
  const goToExercise = (flatIdx: number) => {
    const gi = exerciseToGroupIndex.get(flatIdx);
    if (gi !== undefined) goToGroup(gi);
  };

  // Skip all exercises in current group
  const skipCurrent = () => {
    setSkippedExercises((prev) => {
      const next = new Set(prev);
      currentGroup.exercises.forEach((e) => next.add(e.id));
      return next;
    });
    if (currentGroupIndex < totalGroups - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1);
      setShowVideo(null);
      setPlateMode(isBarbellInGroup(currentGroupIndex + 1));
    }
  };
  const unskipCurrent = () => {
    setSkippedExercises((prev) => {
      const next = new Set(prev);
      currentGroup.exercises.forEach((e) => next.delete(e.id));
      return next;
    });
  };
  const isSkipped = currentGroup.exercises.every((e) => skippedExercises.has(e.id));

  // Swipe handlers (on hero section only)
  const onPointerDown = (e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = Math.abs(e.clientY - swipeStartRef.current.y);
    if (dy > Math.abs(dx)) { swipeStartRef.current = null; return; }
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    swipeStartRef.current = null;
  };

  // Set logging helpers (per exercise)
  const getDefaults = (exercise: WorkoutExercise, setNum: number) => {
    const exLogs = exerciseLogs.get(exercise.id) ?? [];
    const existing = exLogs.find((l) => l.set === setNum);
    if (existing) return { weight: existing.weight, reps: existing.reps };
    const exName = getExerciseName(exercise);
    const lastSessionLogs = getLastLogForExercise(allWorkouts, exName, latestWorkoutId);
    if (lastSessionLogs) {
      const lastForSet = lastSessionLogs.find((l) => l.set === setNum) ?? lastSessionLogs[lastSessionLogs.length - 1];
      if (lastForSet) return { weight: lastForSet.weight, reps: lastForSet.reps };
    }
    const prescribedReps = parseInt(exercise.reps ?? '0') || 0;
    return { weight: 0, reps: prescribedReps || 8 };
  };

  const handleSetLog = (exercise: WorkoutExercise, setNum: number, weight: number, reps: number) => {
    const exLogs = exerciseLogs.get(exercise.id) ?? [];
    const updated = [...exLogs.filter((l) => l.set !== setNum), { set: setNum, weight, reps }]
      .sort((a, b) => a.set - b.set);
    onUpdateLogs(exercise.id, updated, exercise.restSeconds ?? undefined, exercise.sets || 3);
  };

  const handleUnlogSet = (exercise: WorkoutExercise, setNum: number) => {
    const exLogs = exerciseLogs.get(exercise.id) ?? [];
    onUpdateLogs(exercise.id, exLogs.filter((l) => l.set !== setNum));
  };

  const handleFillRemaining = (exercise: WorkoutExercise) => {
    const exLogs = exerciseLogs.get(exercise.id) ?? [];
    const last = exLogs[exLogs.length - 1];
    if (!last) return;
    const numSets = exercise.sets || 3;
    const filled = [...exLogs];
    for (let i = 1; i <= numSets; i++) {
      if (!filled.find((l) => l.set === i)) {
        filled.push({ set: i, weight: last.weight, reps: last.reps });
      }
    }
    onUpdateLogs(exercise.id, filled.sort((a, b) => a.set - b.set));
  };

  // Render a single exercise card (used for both standalone and superset items)
  const renderExerciseCard = (exercise: WorkoutExercise, supersetLabel?: string) => {
    const exLogs = exerciseLogs.get(exercise.id) ?? [];
    const numSets = exercise.sets || 3;
    const allDone = exLogs.length >= numSets;
    const muscle = getExerciseMuscle(exercise);
    const muscleCls = MUSCLE_COLORS[muscle?.toLowerCase() ?? ''] ?? 'bg-slate-500/20 text-slate-300';
    const tip = getCoachingTip(exercise);
    const eName = getExerciseName(exercise);
    const lastLogs = getLastLogForExercise(allWorkouts, eName, latestWorkoutId);
    const exIsBarbell = (exercise.exercise?.equipmentRequired?.toLowerCase().includes('barbell') ?? false)
      || eName.toLowerCase().includes('barbell');
    const exIsSkipped = skippedExercises.has(exercise.id);

    const firstVid = exercise.exercise?.videos?.[0] ?? null;
    const vidId = firstVid?.youtubeVideoId ?? null;
    const vidIsPending = firstVid?.status === 'pending';
    const exGifUrl = exercise.exercise?.gifUrl ?? null;

    const isShowingVideo = showVideo === exercise.id && vidId;
    const isShowingGif = showGif === exercise.id && exGifUrl;

    return (
      <div key={exercise.id} className={isSuperset ? 'relative' : ''}>
        {/* Superset label + muscle pill */}
        <div className="flex items-center gap-2 pt-2 pb-1">
          {supersetLabel && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-black shrink-0">
              {supersetLabel}
            </span>
          )}
          {muscle && (
            <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${muscleCls}`}>
              {muscle}
            </span>
          )}
        </div>

        {/* Exercise name + badges */}
        <div className="flex items-center gap-2">
          <h3 className={`${isSuperset ? 'text-lg' : 'text-xl'} font-black tracking-wide leading-tight ${exIsSkipped ? 'text-slate-500 line-through' : 'text-white'}`}>
            {eName}
          </h3>
          {exIsSkipped ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full shrink-0">
              Skipped
            </span>
          ) : allDone ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Done
            </span>
          ) : null}
        </div>

        {/* Prescription */}
        <p className="text-sm text-slate-400 font-medium mt-0.5 tabular-nums">
          {exercise.sets} &times; {exercise.reps ?? '?'}
        </p>

        {/* Last session */}
        {lastLogs && (
          <p className="text-[11px] text-slate-600 font-bold mt-0.5 tabular-nums">
            Last: {lastLogs.slice(0, 4).map((l) => `${formatWeight(l.weight, unit)}×${l.reps}`).join('  ')}
          </p>
        )}

        {/* Coaching tip */}
        {tip && <p className="text-xs text-slate-500 italic mt-1 leading-relaxed">{tip}</p>}

        {/* Video/GIF/Toolbar row */}
        {!exIsSkipped && (vidId || exGifUrl) && (
          <div className="flex gap-1.5 mt-1.5">
            {vidId && (
              <button
                onClick={() => { setShowVideo(isShowingVideo ? null : exercise.id); setShowGif(null); }}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  isShowingVideo ? 'bg-red-500/20 text-red-400' : vidIsPending ? 'bg-amber-400/10 text-amber-400/60' : 'bg-slate-800 text-slate-500 hover:text-red-400'
                }`}
              >
                {isShowingVideo ? 'Hide Video' : 'Video'}
              </button>
            )}
            {exGifUrl && (
              <button
                onClick={() => { setShowGif(isShowingGif ? null : exercise.id); setShowVideo(null); }}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  isShowingGif ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500 hover:text-cyan-400'
                }`}
              >
                {isShowingGif ? 'Hide Demo' : 'Demo'}
              </button>
            )}
          </div>
        )}

        {/* Video embed */}
        {isShowingVideo && vidId && (
          <div className="py-2">
            <div className="relative aspect-video max-h-[50vh] landscape:max-h-[70vh] rounded-lg overflow-hidden bg-slate-900">
              <iframe
                src={`https://www.youtube.com/embed/${vidId}`}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                loading="lazy"
              />
              {vidIsPending && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-400/90 text-black text-[10px] font-bold uppercase tracking-wider">
                  Pending
                </div>
              )}
            </div>
          </div>
        )}

        {/* GIF embed */}
        {isShowingGif && exGifUrl && (
          <div className="py-2">
            <div className="relative rounded-lg overflow-hidden bg-slate-900">
              <img src={exGifUrl} alt={`${eName} form`} className="w-full" loading="lazy" />
            </div>
          </div>
        )}

        {/* Set logging */}
        {!exIsSkipped && !isShowingVideo && !isShowingGif && (
          <div className="py-1">
            {/* Toolbar (only show on first exercise in group to avoid repetition) */}
            {(!isSuperset || exercise === currentGroup.exercises[0]) && (
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800/40 flex-wrap">
                <button
                  type="button"
                  onClick={() => setUnit(unit === 'lb' ? 'kg' : 'lb')}
                  className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors p-1 rounded ${
                    unit === 'kg' ? 'text-blue-400' : 'text-slate-500 hover:text-blue-400'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  {unit === 'lb' ? 'lb' : 'kg'}
                </button>
                {exIsBarbell && (
                  <>
                    <span className="text-slate-800">|</span>
                    <button
                      type="button"
                      onClick={() => setPlateMode(!plateMode)}
                      className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors p-1 rounded ${
                        plateMode ? 'text-amber-400' : 'text-amber-500/70 hover:text-amber-400'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0">
                        <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" />
                        <rect x="4" y="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
                        <rect x="17" y="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
                      </svg>
                      Per Side
                    </button>
                    {plateMode && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-600">bar:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={barWeight}
                          onChange={(e) => {
                            const v = parseInt(e.target.value) || 0;
                            setBarWeight(Math.max(0, Math.min(100, v)));
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-8 h-5 text-center bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-400 tabular-nums font-medium focus:outline-none focus:ring-1 focus:ring-amber-400/50 focus:text-white"
                        />
                        <span className="text-[10px] text-slate-600">{unit}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Set rows */}
            {Array.from({ length: numSets }, (_, i) => i + 1).map((setNum) => {
              const existingLog = exLogs.find((l) => l.set === setNum);
              const defaults = getDefaults(exercise, setNum);
              return (
                <SetRow
                  key={setNum}
                  setNumber={setNum}
                  weight={existingLog?.weight ?? defaults.weight}
                  reps={existingLog?.reps ?? defaults.reps}
                  isLogged={!!existingLog}
                  onLog={(w, r) => handleSetLog(exercise, setNum, w, r)}
                  onUnlog={() => handleUnlogSet(exercise, setNum)}
                  onValueChange={(s, w, r) => handleDraftChange(exercise.id, s, w, r)}
                  plateMode={plateMode}
                  barWeight={barWeight}
                  unit={unit}
                />
              );
            })}

            {/* Fill remaining */}
            {exLogs.length > 0 && exLogs.length < numSets && (
              <button
                onClick={() => handleFillRemaining(exercise)}
                className="w-full py-1.5 mt-1 rounded-lg text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 active:scale-[0.98] transition-colors truncate"
              >
                Fill ({formatWeight(exLogs[exLogs.length - 1].weight, unit)} &times; {exLogs[exLogs.length - 1].reps})
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── Status bar ─── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118]/80 backdrop-blur-md border-b border-slate-800/50">
        {/* Progress counter — tappable */}
        <button
          onClick={() => setShowExerciseList(true)}
          className="flex items-center gap-1.5 min-w-[44px] min-h-[44px] justify-center"
        >
          <span className="text-sm font-black text-white tabular-nums">{currentGroupIndex + 1}/{totalGroups}</span>
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Timer */}
        <span className={`text-lg font-black tabular-nums tracking-tight ${
          isPaused ? 'text-amber-400' : isRunning ? 'text-primary' : 'text-slate-400'
        }`}>
          {fmtTime(elapsed)}
        </span>

        {/* Completed count */}
        <span className="text-xs font-bold text-slate-500 tabular-nums">
          {completedGroupCount}/{totalGroups}
        </span>
      </div>

      {/* ─── Segmented progress bar (one segment per group) ─── */}
      <div className="flex gap-0.5 px-4 py-1.5">
        {groups.map((g, gi) => {
          const gDone = g.exercises.every((e) => {
            const l = exerciseLogs.get(e.id) ?? [];
            return l.length >= (e.sets || 3);
          });
          const gSkipped = g.exercises.every((e) => skippedExercises.has(e.id));
          const isCurrent = gi === currentGroupIndex;
          const hasProgress = g.exercises.some((e) => (exerciseLogs.get(e.id) ?? []).length > 0);
          return (
            <div
              key={gi}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                gSkipped
                  ? 'bg-slate-600'
                  : gDone
                  ? 'bg-primary'
                  : isCurrent
                  ? 'bg-primary/40'
                  : hasProgress
                  ? 'bg-amber-400/50'
                  : 'bg-slate-800'
              }`}
            />
          );
        })}
      </div>

      {/* ─── Main content (scrollable) ─── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div
          className="touch-pan-y"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {/* Superset header badge */}
          {isSuperset && (
            <div className="flex items-center gap-2 pt-3 pb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Superset
              </span>
            </div>
          )}

          {isSkipped ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                {isSuperset ? 'Superset Skipped' : 'Exercise Skipped'}
              </p>
              <button
                onClick={unskipCurrent}
                className="px-5 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider hover:text-white active:bg-slate-700 transition-colors"
              >
                Undo Skip
              </button>
            </div>
          ) : (
            <>
              {/* Render each exercise in the group */}
              {currentGroup.exercises.map((exercise, ei) => {
                const ssLabel = isSuperset
                  ? `${currentGroup.supersetGroup}${ei + 1}`
                  : undefined;
                return (
                  <div key={exercise.id}>
                    {/* Divider between superset exercises */}
                    {isSuperset && ei > 0 && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-amber-400/20" />
                        <span className="text-[9px] font-bold text-amber-400/40 uppercase tracking-widest">No Rest</span>
                        <div className="flex-1 h-px bg-amber-400/20" />
                      </div>
                    )}
                    {renderExerciseCard(exercise, ssLabel)}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ─── "Next" button when current group is complete ─── */}
        {groupAllDone && nextGroup && (
          <button
            onClick={goNext}
            className="w-full py-3 mt-2 rounded-xl bg-primary/15 text-primary font-bold text-sm tracking-wide uppercase transition-all hover:bg-primary/25 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Next {nextGroup.exercises.length > 1 ? 'Superset' : 'Exercise'}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Next preview bar ─── */}
      {nextGroup ? (
        <button
          onClick={goNext}
          className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/40 border-t border-slate-800/60 active:bg-slate-800/70 transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Next</span>
          <span className="text-xs font-semibold text-slate-400 truncate flex-1 text-left">
            {nextGroup.exercises.map((e) => getExerciseName(e)).join(' + ')}
          </span>
          {nextGroup.exercises.length > 1 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-amber-400/15 text-amber-300 shrink-0">
              SS
            </span>
          )}
          <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center justify-center px-4 py-2.5 bg-primary/5 border-t border-primary/20">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Final Exercise</span>
        </div>
      )}

      {/* ─── Bottom toolbar ─── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118]/80 backdrop-blur-md border-t border-slate-800/50">
        <button
          onClick={goPrev}
          disabled={currentGroupIndex === 0}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white active:bg-slate-700 transition-colors disabled:opacity-30"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {!isSkipped && !groupAllDone && (
            <button
              onClick={skipCurrent}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-500 hover:text-slate-300 active:bg-slate-700 transition-colors"
              title="Skip"
            >
              <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {onSwapExercise && !isSuperset && (
            <button
              onClick={() => onSwapExercise(ex.id)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-500 hover:text-amber-400 active:bg-slate-700 transition-colors"
              title="Swap exercise"
            >
              <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={currentGroupIndex >= totalGroups - 1}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white active:bg-slate-700 transition-colors disabled:opacity-30"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ─── Exercise list sheet ─── */}
      {showExerciseList && (
        <ExerciseListSheet
          exercises={exercises}
          exerciseLogs={exerciseLogs}
          currentIndex={exercises.indexOf(currentGroup.exercises[0])}
          onSelect={goToExercise}
          onClose={() => setShowExerciseList(false)}
          getExerciseName={getExerciseName}
          getExerciseMuscle={getExerciseMuscle}
          skippedExercises={skippedExercises}
        />
      )}
    </div>
  );
}
