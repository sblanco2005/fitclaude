'use client';

import { useState, useRef, useCallback } from 'react';
import type { Workout, WorkoutExercise } from '@/types';
import SetRow, { type WeightUnit, lbToKg } from '@/components/workout/SetRow';
import ExerciseListSheet from '@/components/workout/ExerciseListSheet';

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
  restRemaining: number | null;
  restTotal: number;
  onCancelRest: () => void;
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
  restRemaining,
  restTotal,
  onCancelRest,
  isRunning,
  isPaused,
  elapsed,
}: FocusedExerciseViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // Per-exercise settings (reset when navigating)
  const [unit, setUnit] = useState<WeightUnit>(weightUnit);
  const [plateMode, setPlateMode] = useState(false);
  const [barWeight, setBarWeight] = useState(45);

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const total = exercises.length;
  const ex = exercises[currentIndex];
  const nextEx = exercises[currentIndex + 1] ?? null;
  if (!ex) return null;

  const logs = exerciseLogs.get(ex.id) ?? [];
  const numSets = ex.sets || 3;
  const allSetsLogged = logs.length >= numSets;
  const muscle = getExerciseMuscle(ex);
  const muscleCls = MUSCLE_COLORS[muscle?.toLowerCase() ?? ''] ?? 'bg-slate-500/20 text-slate-300';
  const tip = getCoachingTip(ex);
  const name = getExerciseName(ex);
  const lastLogs = getLastLogForExercise(allWorkouts, name, latestWorkoutId);
  const isBarbell = (ex.exercise?.equipmentRequired?.toLowerCase().includes('barbell') ?? false)
    || name.toLowerCase().includes('barbell');
  const prescribedReps = parseInt(ex.reps ?? '0') || 0;

  const firstVid = ex.exercise?.videos?.[0] ?? null;
  const videoId = firstVid?.youtubeVideoId ?? null;
  const vidPending = firstVid?.status === 'pending';

  // Progress: count exercises with all sets logged
  const completedCount = exercises.filter((e) => {
    const l = exerciseLogs.get(e.id) ?? [];
    return l.length >= (e.sets || 3);
  }).length;

  // Timer format
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Navigation
  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowVideo(false);
    }
  };
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowVideo(false);
    }
  };

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

  // Set logging handlers (identical to ExerciseLogRow)
  const getDefaults = (setNum: number) => {
    const existing = logs.find((l) => l.set === setNum);
    if (existing) return { weight: existing.weight, reps: existing.reps };
    const lastLogged = logs.length > 0 ? logs[logs.length - 1] : null;
    if (lastLogged) return { weight: lastLogged.weight, reps: lastLogged.reps };
    if (lastLogs) {
      const lastForSet = lastLogs.find((l) => l.set === setNum) ?? lastLogs[lastLogs.length - 1];
      if (lastForSet) return { weight: lastForSet.weight, reps: lastForSet.reps };
    }
    return { weight: 0, reps: prescribedReps || 8 };
  };

  const handleSetLog = (setNum: number, weight: number, reps: number) => {
    const updated = [...logs.filter((l) => l.set !== setNum), { set: setNum, weight, reps }]
      .sort((a, b) => a.set - b.set);
    onUpdateLogs(ex.id, updated, ex.restSeconds ?? undefined, numSets);
  };

  const handleUnlogSet = (setNum: number) => {
    onUpdateLogs(ex.id, logs.filter((l) => l.set !== setNum));
  };

  const handleFillRemaining = () => {
    const last = logs[logs.length - 1];
    if (!last) return;
    const filled = [...logs];
    for (let i = 1; i <= numSets; i++) {
      if (!filled.find((l) => l.set === i)) {
        filled.push({ set: i, weight: last.weight, reps: last.reps });
      }
    }
    onUpdateLogs(ex.id, filled.sort((a, b) => a.set - b.set));
  };

  const showRestOverlay = restRemaining !== null && restRemaining > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Status bar ─── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118]/80 backdrop-blur-md border-b border-slate-800/50">
        {/* Progress counter — tappable */}
        <button
          onClick={() => setShowExerciseList(true)}
          className="flex items-center gap-1.5 min-w-[44px] min-h-[44px] justify-center"
        >
          <span className="text-sm font-black text-white tabular-nums">{currentIndex + 1}/{total}</span>
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

        {/* Rest timer (compact) */}
        {restRemaining !== null && restRemaining > 0 ? (
          <span className={`text-sm font-bold tabular-nums ${restRemaining <= 5 ? 'text-red-400' : 'text-amber-400'}`}>
            Rest {fmtTime(restRemaining)}
          </span>
        ) : (
          <span className="text-sm text-transparent">Rest 00:00</span>
        )}
      </div>

      {/* ─── Segmented progress bar ─── */}
      <div className="flex gap-0.5 px-4 py-1.5">
        {exercises.map((e, i) => {
          const l = exerciseLogs.get(e.id) ?? [];
          const done = l.length >= (e.sets || 3);
          const isCurrent = i === currentIndex;
          return (
            <div
              key={e.id}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                done
                  ? 'bg-primary'
                  : isCurrent
                  ? 'bg-primary/40'
                  : l.length > 0
                  ? 'bg-amber-400/50'
                  : 'bg-slate-800'
              }`}
            />
          );
        })}
      </div>

      {/* ─── Main content (scrollable) ─── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {/* Hero section — swipable */}
        <div
          className="pt-3 pb-2 touch-pan-y"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {/* Muscle group pill */}
          {muscle && (
            <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${muscleCls}`}>
              {muscle}
            </span>
          )}

          {/* Exercise name + complete badge */}
          <div className="flex items-center gap-2 mt-2">
            <h3 className="text-xl font-black text-white tracking-wide leading-tight">
              {name}
            </h3>
            {allSetsLogged && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Done
              </span>
            )}
          </div>

          {/* Prescription */}
          <p className="text-sm text-slate-400 font-medium mt-1 tabular-nums">
            {ex.sets} &times; {ex.reps ?? '?'}
            {ex.restSeconds ? <span className="text-slate-600"> &middot; {ex.restSeconds}s rest</span> : null}
          </p>

          {/* Last session data */}
          {lastLogs && (
            <p className="text-[11px] text-slate-600 font-bold mt-1 tabular-nums">
              Last: {lastLogs.slice(0, 4).map((l) => `${formatWeight(l.weight, unit)}×${l.reps}`).join('  ')}
            </p>
          )}

          {/* Coaching tip */}
          {tip && (
            <p className="text-xs text-slate-500 italic mt-1.5 leading-relaxed">{tip}</p>
          )}
        </div>

        {/* ─── Rest timer overlay ─── */}
        {showRestOverlay ? (
          <div className="flex flex-col items-center justify-center py-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Rest</span>
            <span className={`text-5xl font-black tabular-nums tracking-tight mt-2 ${
              restRemaining! <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-400'
            }`}>
              {fmtTime(restRemaining!)}
            </span>
            {/* Progress ring */}
            <div className="w-full max-w-[200px] h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${restTotal > 0 ? ((restTotal - restRemaining!) / restTotal) * 100 : 0}%` }}
              />
            </div>
            <button
              onClick={onCancelRest}
              className="mt-4 px-6 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider hover:text-white active:bg-slate-700 transition-colors"
            >
              Skip Rest
            </button>
          </div>
        ) : showVideo && videoId ? (
          /* ─── Video view ─── */
          <div className="py-2">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allowFullScreen
                loading="lazy"
              />
              {vidPending && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-400/90 text-black text-[10px] font-bold uppercase tracking-wider">
                  Pending
                </div>
              )}
            </div>
            <button
              onClick={() => setShowVideo(false)}
              className="w-full mt-2 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
            >
              Back to Sets
            </button>
          </div>
        ) : (
          /* ─── Set logging (same as ExerciseLogRow, always visible) ─── */
          <div className="py-1">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800/40 flex-wrap">
              {/* Unit toggle */}
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

              {/* Per-Side toggle */}
              {isBarbell && (
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

            {/* Set rows */}
            {Array.from({ length: numSets }, (_, i) => i + 1).map((setNum) => {
              const existingLog = logs.find((l) => l.set === setNum);
              const defaults = getDefaults(setNum);
              return (
                <SetRow
                  key={setNum}
                  setNumber={setNum}
                  weight={existingLog?.weight ?? defaults.weight}
                  reps={existingLog?.reps ?? defaults.reps}
                  isLogged={!!existingLog}
                  onLog={(w, r) => handleSetLog(setNum, w, r)}
                  onUnlog={() => handleUnlogSet(setNum)}
                  plateMode={plateMode}
                  barWeight={barWeight}
                  unit={unit}
                />
              );
            })}

            {/* Fill remaining */}
            {logs.length > 0 && logs.length < numSets && (
              <button
                onClick={handleFillRemaining}
                className="w-full py-1.5 mt-1 rounded-lg text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 active:scale-[0.98] transition-colors truncate"
              >
                Fill ({formatWeight(logs[logs.length - 1].weight, unit)} &times; {logs[logs.length - 1].reps})
              </button>
            )}
          </div>
        )}

        {/* ─── "Next Exercise" button when current is complete ─── */}
        {allSetsLogged && !showRestOverlay && nextEx && (
          <button
            onClick={goNext}
            className="w-full py-3 mt-2 rounded-xl bg-primary/15 text-primary font-bold text-sm tracking-wide uppercase transition-all hover:bg-primary/25 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Next Exercise
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Next exercise preview bar ─── */}
      {nextEx ? (
        <button
          onClick={goNext}
          className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/40 border-t border-slate-800/60 active:bg-slate-800/70 transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Next</span>
          <span className="text-xs font-semibold text-slate-400 truncate flex-1 text-left">
            {getExerciseName(nextEx)}
          </span>
          {getExerciseMuscle(nextEx) && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
              MUSCLE_COLORS[getExerciseMuscle(nextEx)!.toLowerCase()] ?? 'bg-slate-500/20 text-slate-400'
            }`}>
              {getExerciseMuscle(nextEx)}
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
        {/* Previous */}
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white active:bg-slate-700 transition-colors disabled:opacity-30"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Center buttons */}
        <div className="flex items-center gap-2">
          {/* Swap */}
          {onSwapExercise && (
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

          {/* Video */}
          {videoId && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className={`w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 transition-colors ${
                showVideo
                  ? 'text-red-400'
                  : vidPending
                  ? 'text-amber-400/60 hover:text-amber-400'
                  : 'text-slate-500 hover:text-red-400'
              }`}
              title="Watch form video"
            >
              <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Next */}
        <button
          onClick={goNext}
          disabled={currentIndex >= total - 1}
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
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
          onClose={() => setShowExerciseList(false)}
          getExerciseName={getExerciseName}
          getExerciseMuscle={getExerciseMuscle}
        />
      )}
    </div>
  );
}
