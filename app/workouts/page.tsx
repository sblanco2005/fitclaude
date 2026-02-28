'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useFitClaude } from '@/context/FitClaudeContext';
import { Modal } from '@/components/ui/Modal';
import type { Workout, WorkoutExercise, Exercise, Activity } from '@/types';
import SetRow from '@/components/workout/SetRow';

// ─── helpers ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  push: 'info',
  pull: 'success',
  legs: 'warning',
  upper: 'info',
  lower: 'warning',
  full_body: 'success',
  cardio: 'danger',
  custom: 'default',
};

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

const MUSCLE_GROUP_MAP: Record<string, string> = {
  glutes: 'legs', hamstrings: 'legs', quadriceps: 'legs', calves: 'legs',
  biceps: 'arms', triceps: 'arms',
};
const MUSCLE_PILL_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
function consolidateMuscle(m: string): string {
  return MUSCLE_GROUP_MAP[m.toLowerCase()] ?? m.toLowerCase();
}

function muscleChip(muscle: string) {
  const cls = MUSCLE_COLORS[muscle.toLowerCase()] ?? 'bg-slate-500/20 text-slate-300';
  return (
    <span key={muscle} className={`px-2 py-0.5 rounded-full text-xs font-medium tracking-wide uppercase ${cls}`}>
      {muscle}
    </span>
  );
}

function parseExerciseNotes(notes: string | null): {
  name: string;
  muscleGroup: string;
  coachingTip: string;
} | null {
  if (!notes || !notes.includes('|')) return null;
  const [name, muscleGroup, ...tipParts] = notes.split('|');
  return {
    name: name?.trim() || '',
    muscleGroup: muscleGroup?.trim() || '',
    coachingTip: tipParts.join('|').trim(),
  };
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function uniqueMuscles(workout: Workout): string[] {
  const muscles = new Set<string>();
  for (const ex of workout.exercises) {
    const muscle = getExerciseMuscle(ex);
    if (muscle) muscles.add(muscle);
  }
  return Array.from(muscles);
}

function routineKey(workout: Workout) {
  return workout.name?.trim() || workout.workoutType;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── RoutineCard (compact list item) ─────────────────────────────────────────

function getRoutineDisplayId(workouts: Workout[]): number | null {
  // Use the lowest displayId in the group (first created = canonical ID)
  let min: number | null = null;
  for (const w of workouts) {
    if (w.displayId != null && (min == null || w.displayId < min)) {
      min = w.displayId;
    }
  }
  return min;
}

function RoutineCard({
  name,
  workouts,
  onClick,
  onSpin,
}: {
  name: string;
  workouts: Workout[];
  onClick: () => void;
  onSpin: () => void;
}) {
  const latest = workouts[0];
  const typeColor = TYPE_COLORS[latest.workoutType] ?? 'default';
  const muscles = uniqueMuscles(latest);
  const routineNum = getRoutineDisplayId(workouts);
  const isLifting = (latest.category || 'lifting') === 'lifting';

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl glass hover:bg-slate-800/60 hover:border-slate-600 transition-all duration-200"
    >
      {/* Row 1: #N + name + badge + spin + hit it */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {routineNum != null && (
            <span className="text-xs text-slate-500 tabular-nums shrink-0">#{routineNum}</span>
          )}
          <p className="font-bold text-white text-sm leading-tight truncate capitalize">
            {name.replace(/_/g, ' ')}
          </p>
          {isLifting ? (
            <Badge variant={typeColor} size="sm">
              {latest.workoutType.replace('_', ' ')}
            </Badge>
          ) : (
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${CATEGORY_COLORS[latest.category!] || 'bg-slate-700/30 text-slate-400 border-slate-600'}`}>
              {latest.category}
            </span>
          )}
          {latest.source === 'manual' && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
              ext
            </span>
          )}
        </div>
      </div>

      {/* Row 2: swap (left) + stats + muscles */}
      <div className="flex items-center gap-2 mt-1 ml-0.5">
        {/* Swap — bottom-left, far from Hit It */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onSpin(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onSpin(); } }}
          className="flex items-center gap-1 text-[10px] font-medium text-amber-400/50 hover:text-amber-400 transition-colors cursor-pointer"
          title="Regenerate routine"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          Swap
        </span>
        <span className="text-slate-700">·</span>
        <span className="text-[11px] text-slate-500">{workouts.length}x done</span>
        {isLifting && muscles.length > 0 && (
          <>
            <span className="text-slate-700">·</span>
            <span className="text-[10px] text-slate-500/80 uppercase tracking-wider truncate">
              {muscles.slice(0, 3).join(' · ')}
              {muscles.length > 3 && ` +${muscles.length - 3}`}
            </span>
          </>
        )}
      </div>
    </button>
  );
}

// ─── helpers for parsing stored setLogs ─────────────────────────────────────

function parseStoredSetLogs(setLogsJson: string | null): SetLog[] {
  if (!setLogsJson) return [];
  try {
    return JSON.parse(setLogsJson) as SetLog[];
  } catch {
    return [];
  }
}

function sessionHasLogs(workout: Workout): boolean {
  return workout.exercises.some((ex) => {
    const logs = parseStoredSetLogs(ex.setLogs);
    return logs.length > 0;
  });
}

// ─── SessionLogCard (expandable past session) ───────────────────────────────

function SessionLogCard({
  workout,
  onDeleteLogs,
  onEditLog,
  onDeleteSession,
  canDeleteSession = true,
}: {
  workout: Workout;
  onDeleteLogs: (workoutId: string) => void;
  onEditLog: (workoutId: string, exerciseId: string, logs: SetLog[]) => void;
  onDeleteSession: (workoutId: string) => void;
  canDeleteSession?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingExId, setEditingExId] = useState<string | null>(null);
  const [editLogs, setEditLogs] = useState<SetLog[]>([]);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  const hasLogs = sessionHasLogs(workout);
  const loggedExercises = workout.exercises.filter(
    (ex) => parseStoredSetLogs(ex.setLogs).length > 0
  );

  const startEdit = (ex: WorkoutExercise) => {
    const logs = parseStoredSetLogs(ex.setLogs);
    setEditingExId(ex.id);
    setEditLogs([...logs]);
  };

  const handleEditSetLog = (setNum: number, weight: number, reps: number) => {
    setEditLogs((prev) =>
      [...prev.filter((l) => l.set !== setNum), { set: setNum, weight, reps }]
        .sort((a, b) => a.set - b.set)
    );
  };

  const submitEdit = (exerciseId: string) => {
    onEditLog(workout.id, exerciseId, editLogs);
    setEditingExId(null);
    setEditLogs([]);
  };

  return (
    <div className="rounded-xl border border-border-dark bg-card overflow-hidden">
      {/* Session header — always visible */}
      <div className="flex items-center">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-card-hover transition-colors min-w-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">
                {formatDate(workout.date)}
              </p>
              {workout.completed && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Done
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {workout.durationMinutes && (
                <span className="text-[10px] text-muted font-medium tabular-nums">
                  {workout.durationMinutes} min
                </span>
              )}
              {hasLogs && (
                <span className="text-[10px] text-slate-500 font-medium">
                  {loggedExercises.length} logged
                </span>
              )}
              {!hasLogs && (
                <span className="text-[10px] text-slate-600 font-medium italic">
                  No logs
                </span>
              )}
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Session ... button — expands card to reveal actions */}
        <div className="pr-2 shrink-0">
          <button
            onClick={() => setExpanded(true)}
            className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors rounded-lg hover:bg-slate-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded: per-exercise breakdown */}
      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-3">
          {workout.exercises.map((ex, i) => {
            const logs = parseStoredSetLogs(ex.setLogs);
            const hasExLogs = logs.length > 0;
            const isEditing = editingExId === ex.id;

            return (
              <div key={ex.id}>
                {/* Exercise name row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold w-5 shrink-0 tabular-nums ${hasExLogs ? 'text-primary' : 'text-slate-600'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`text-xs font-medium truncate ${hasExLogs ? 'text-white' : 'text-slate-400'}`}>
                      {getExerciseName(ex)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted tabular-nums font-medium">
                      {ex.sets}x{ex.reps ?? '?'}
                    </span>
                    {hasExLogs && !isEditing && (
                      <button
                        onClick={() => startEdit(ex)}
                        className="text-slate-600 hover:text-slate-400 transition-colors p-0.5"
                        title="Edit logs"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit mode — per-set stepper rows */}
                {isEditing && (
                  <div className="ml-7 mt-1.5 space-y-0.5">
                    {editLogs.map((l) => (
                      <SetRow
                        key={l.set}
                        setNumber={l.set}
                        weight={l.weight}
                        reps={l.reps}
                        isLogged={false}
                        onLog={(w, r) => handleEditSetLog(l.set, w, r)}
                        onUnlog={() => setEditLogs((prev) => prev.filter((x) => x.set !== l.set))}
                      />
                    ))}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => submitEdit(ex.id)}
                        className="px-3 py-1.5 bg-primary rounded-lg text-white text-[10px] font-bold shrink-0"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingExId(null); setEditLogs([]); }}
                        className="px-3 py-1.5 bg-slate-700 rounded-lg text-slate-300 text-[10px] font-bold shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Set log chips — tap to edit */}
                {hasExLogs && !isEditing && (
                  <div
                    className="flex flex-wrap gap-1 ml-7 mt-1 cursor-pointer"
                    onClick={() => startEdit(ex)}
                  >
                    {logs.map((l) => (
                      <span
                        key={l.set}
                        className="text-[10px] tabular-nums bg-primary/10 text-primary/80 px-1.5 py-0.5 rounded font-medium"
                      >
                        S{l.set} {l.weight}lb × {l.reps}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Volume summary + actions */}
          {hasLogs && (
            <div className="pt-2 border-t border-slate-800/50">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-widest">Volume</p>
                  <p className="text-sm font-black text-white tabular-nums">
                    {loggedExercises.reduce((acc, ex) => {
                      const logs = parseStoredSetLogs(ex.setLogs);
                      return acc + logs.reduce((s, l) => s + l.weight * l.reps, 0);
                    }, 0).toLocaleString()} lb
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-widest">Sets</p>
                  <p className="text-sm font-black text-white tabular-nums">
                    {loggedExercises.reduce((acc, ex) => acc + parseStoredSetLogs(ex.setLogs).length, 0)}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  {!confirmClearLogs ? (
                    <button
                      onClick={() => setConfirmClearLogs(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-[10px] font-bold transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear Logs
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-red-400 font-medium">Clear all?</span>
                      <button
                        onClick={() => {
                          onDeleteLogs(workout.id);
                          setConfirmClearLogs(false);
                        }}
                        className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmClearLogs(false)}
                        className="px-2 py-1 rounded-md bg-slate-700 text-slate-300 text-[10px] font-bold hover:bg-slate-600 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  )}
                  {canDeleteSession && !confirmDeleteSession && (
                    <button
                      onClick={() => setConfirmDeleteSession(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-[10px] font-bold transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {confirmDeleteSession && (
                <div className="flex items-center justify-end gap-1.5 mt-2">
                  <span className="text-[10px] text-red-400 font-medium">Delete session?</span>
                  <button
                    onClick={() => {
                      onDeleteSession(workout.id);
                      setConfirmDeleteSession(false);
                    }}
                    className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteSession(false)}
                    className="px-2 py-1 rounded-md bg-slate-700 text-slate-300 text-[10px] font-bold hover:bg-slate-600 transition-colors"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── find last logged session for an exercise name ──────────────────────────

function getLastLogForExercise(
  workouts: Workout[],
  exerciseName: string,
  excludeWorkoutId?: string,
): SetLog[] | null {
  // workouts are sorted desc — find the most recent session with logs for this exercise
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

// ─── RoutineExerciseRow (expandable exercise in routine detail) ──────────────

function RoutineExerciseRow({
  ex,
  globalIndex,
  tip,
  lastLog,
  onSwap,
  onUpdate,
}: {
  ex: WorkoutExercise;
  globalIndex: number;
  tip: string | null;
  lastLog: SetLog[] | null;
  onSwap: () => void;
  onUpdate: (updates: { sets?: number; reps?: string; restSeconds?: number }) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSets, setEditSets] = useState(ex.sets);
  const [editReps, setEditReps] = useState(ex.reps ?? '');
  const [editRest, setEditRest] = useState(ex.restSeconds ?? 0);
  const videoId = ex.exercise?.videos?.[0]?.youtubeVideoId ?? null;
  const setsInputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditSets(ex.sets);
    setEditReps(ex.reps ?? '');
    setEditRest(ex.restSeconds ?? 0);
    setEditing(true);
    setTimeout(() => setsInputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    const updates: { sets?: number; reps?: string; restSeconds?: number } = {};
    if (editSets !== ex.sets) updates.sets = editSets;
    if (editReps !== (ex.reps ?? '')) updates.reps = editReps;
    if (editRest !== (ex.restSeconds ?? 0)) updates.restSeconds = editRest;
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  return (
    <div className="py-2 border-b border-slate-800/40 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="text-[10px] text-slate-500 font-bold tabular-nums mt-0.5 shrink-0">
            {String(globalIndex).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-white font-semibold">
                {getExerciseName(ex)}
                {ex.wasSpicy && <span className="ml-1">🌶️</span>}
              </p>
              {videoId && (
                <button
                  onClick={() => setShowVideo((v) => !v)}
                  className={`shrink-0 p-0.5 rounded transition-colors ${showVideo ? 'text-red-400' : 'text-red-400/40 hover:text-red-400'}`}
                  title="Watch tutorial"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </button>
              )}
              <button
                onClick={onSwap}
                className="shrink-0 p-0.5 rounded transition-colors text-slate-600 hover:text-amber-400"
                title="Swap exercise"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>
            {tip && (
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed italic">
                {tip}
              </p>
            )}
            {lastLog && (
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 tabular-nums">
                Last: {lastLog.map((l) => `${l.weight}×${l.reps}`).join('  ')}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {editing ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <input
                  ref={setsInputRef}
                  type="number"
                  min={1}
                  max={20}
                  value={editSets}
                  onChange={(e) => setEditSets(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-8 bg-slate-800 text-white text-xs text-center rounded px-1 py-0.5 border border-slate-700 focus:border-emerald-500 outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                />
                <span className="text-xs text-muted">x</span>
                <input
                  type="text"
                  value={editReps}
                  onChange={(e) => setEditReps(e.target.value)}
                  placeholder="8-12"
                  className="w-12 bg-slate-800 text-white text-xs text-center rounded px-1 py-0.5 border border-slate-700 focus:border-emerald-500 outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={editRest}
                  onChange={(e) => setEditRest(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 bg-slate-800 text-white text-sm text-center rounded px-1.5 py-1 border border-slate-700 focus:border-emerald-500 outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                />
                <span className="text-xs text-muted">s rest</span>
              </div>
              <div className="flex gap-1.5 mt-0.5">
                <button onClick={saveEdit} className="text-[10px] text-emerald-400 font-medium hover:text-emerald-300">Save</button>
                <button onClick={cancelEdit} className="text-[10px] text-slate-500 hover:text-slate-400">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={startEdit} className="text-right group" title="Tap to edit sets & reps">
              <p className="text-sm text-primary font-bold tabular-nums group-hover:text-emerald-300 transition-colors">
                {ex.sets} x {ex.reps ?? '?'}
              </p>
              {ex.weightKg != null && (
                <p className="text-[10px] text-muted">{ex.weightKg} kg</p>
              )}
              {ex.restSeconds != null && (
                <p className="text-[10px] text-slate-600">{ex.restSeconds}s rest</p>
              )}
            </button>
          )}
        </div>
      </div>
      {showVideo && videoId && (
        <div className="ml-7 mt-2">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SwapExerciseModal ───────────────────────────────────────────────────────

function SwapExerciseModal({
  isOpen,
  onClose,
  onSelect,
  currentExerciseName,
  title = 'Swap Exercise',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  currentExerciseName: string;
  title?: string;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSearch('');
    setMuscleFilter(null);
    fetch('/api/exercises')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Exercise[]) => {
        setExercises(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    exercises.forEach((e) => groups.add(e.muscleGroup));
    return Array.from(groups).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      if (e.name === currentExerciseName) return false;
      if (muscleFilter && e.muscleGroup !== muscleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
      }
      return true;
    });
  }, [exercises, search, muscleFilter, currentExerciseName]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        {/* Search */}
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Muscle group chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setMuscleFilter(null)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
              !muscleFilter ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            All
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                muscleFilter === mg
                  ? (MUSCLE_COLORS[mg.toLowerCase()] ?? 'bg-slate-500/20 text-slate-300')
                  : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {mg}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="max-h-[50vh] overflow-y-auto space-y-0.5 scrollbar-hide">
          {loading ? (
            <p className="text-sm text-muted text-center py-8">Loading exercises...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No matching exercises</p>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium group-hover:text-primary transition-colors truncate">
                    {ex.name}
                  </p>
                  <p className="text-[10px] text-slate-500">{ex.muscleGroup} · {ex.difficulty} · {ex.exerciseType}</p>
                </div>
                <svg className="w-4 h-4 text-slate-600 group-hover:text-primary shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── RoutineDetail (full-screen view) ────────────────────────────────────────

function RoutineDetail({
  workouts,
  onBack,
  onHitIt,
  isInHitIt,
  onRename,
  onDelete,
  onDeleteLogs,
  onEditLog,
  onDeleteSession,
  onSwapExercise,
  onAddExercise,
  onUpdateExercise,
}: {
  workouts: Workout[];
  onBack: () => void;
  onHitIt: () => void;
  isInHitIt: boolean;
  onRename: (workoutIds: string[], newName: string) => void;
  onDelete: (workoutIds: string[]) => void;
  onDeleteLogs: (workoutId: string) => void;
  onEditLog: (workoutId: string, exerciseId: string, logs: SetLog[]) => void;
  onDeleteSession: (workoutId: string) => void;
  onSwapExercise: (workoutId: string, workoutExerciseId: string, newExerciseId: string) => Promise<void>;
  onAddExercise: (workoutId: string, exerciseId: string) => Promise<void>;
  onUpdateExercise: (workoutId: string, workoutExerciseId: string, updates: { sets?: number; reps?: string; restSeconds?: number }) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swappingExercise, setSwappingExercise] = useState<WorkoutExercise | null>(null);
  const [addingExercise, setAddingExercise] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const latest = workouts[0];
  const muscles = uniqueMuscles(latest);
  const totalSets = latest.exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const totalExercises = latest.exercises.length;
  const routineNum = getRoutineDisplayId(workouts);

  const groupedByMuscle = useMemo(() => {
    const map = new Map<string, { ex: WorkoutExercise; globalIndex: number }[]>();
    latest.exercises.forEach((ex, i) => {
      const muscle = getExerciseMuscle(ex) || 'other';
      if (!map.has(muscle)) map.set(muscle, []);
      map.get(muscle)!.push({ ex, globalIndex: i + 1 });
    });
    return Array.from(map.entries());
  }, [latest.exercises]);

  const startRename = () => {
    setMenuOpen(false);
    setRenaming(true);
    setRenameValue(routineKey(latest).replace(/_/g, ' '));
    setTimeout(() => renameRef.current?.focus(), 50);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== routineKey(latest)) {
      onRename(workouts.map((w) => w.id), trimmed);
    }
    setRenaming(false);
  };

  const startDelete = () => {
    setMenuOpen(false);
    setConfirmDelete(true);
  };

  const confirmDeleteAction = () => {
    onDelete(workouts.map((w) => w.id));
    setConfirmDelete(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Confirm delete overlay */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setConfirmDelete(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
            <p className="text-sm font-bold text-white">Delete this routine?</p>
            <p className="text-xs text-muted mt-1">
              This will delete all {workouts.length} session{workouts.length > 1 ? 's' : ''} and their logs. This cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAction}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Title + actions + stats */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        {renaming ? (
          <div className="flex gap-2">
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-lg font-black focus:outline-none focus:ring-2 focus:ring-primary capitalize"
            />
            <button onClick={submitRename} className="px-3 py-2 bg-primary rounded-lg text-white text-xs font-bold">
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {routineNum != null && (
                <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg tabular-nums tracking-tight shrink-0">
                  #{routineNum}
                </span>
              )}
              <h2 className="text-xl font-black text-white capitalize tracking-wide truncate">
                {routineKey(latest).replace(/_/g, ' ')}
              </h2>
            </div>
            <div className="flex items-center shrink-0 ml-2">
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 min-w-[140px]">
                      <button
                        onClick={() => { setMenuOpen(false); setAddingExercise(true); }}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Add Exercise
                      </button>
                      <button
                        onClick={startRename}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={startDelete}
                        className="w-full text-left px-4 py-2 text-xs font-medium text-red-400 hover:bg-slate-700 transition-colors"
                      >
                        Delete Routine
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-5 mt-3">
          <div className="text-center">
            <p className="text-lg font-black text-white">{totalExercises}</p>
            <p className="text-[9px] text-muted uppercase tracking-widest">Exercises</p>
          </div>
          <div className="w-px h-8 bg-slate-700" />
          <div className="text-center">
            <p className="text-lg font-black text-white">{totalSets}</p>
            <p className="text-[9px] text-muted uppercase tracking-widest">Sets</p>
          </div>
          {latest.durationMinutes && (
            <>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-lg font-black text-white">{latest.durationMinutes}</p>
                <p className="text-[9px] text-muted uppercase tracking-widest">Min</p>
              </div>
            </>
          )}
          <div className="w-px h-8 bg-slate-700" />
          <div className="text-center">
            <p className="text-lg font-black text-white">{workouts.length}</p>
            <p className="text-[9px] text-muted uppercase tracking-widest">Sessions</p>
          </div>
        </div>

        {muscles.length > 0 && (latest.category || 'lifting') === 'lifting' && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {muscles.map((m) => muscleChip(m))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex gap-1 px-4 py-2 shrink-0">
        <button
          className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wide uppercase bg-primary text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)]"
        >
          Routine
        </button>
        <button
          onClick={onHitIt}
          className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 ${
            isInHitIt
              ? 'bg-amber-400 text-black shadow-[0_2px_12px_rgba(251,191,36,0.3)]'
              : 'bg-amber-400/15 text-amber-400 hover:bg-amber-400 hover:text-black'
          }`}
        >
          {isInHitIt ? 'Queued' : 'Hit It'}
        </button>
      </div>

      {/* Routine exercises */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 scrollbar-hide">
          {/* Exercise breakdown — grouped by muscle for lifting, flat list for cardio/HIIT */}
          {(latest.category || 'lifting') !== 'lifting' ? (
            <div className="space-y-1">
              {latest.exercises.map((ex, i) => (
                <RoutineExerciseRow
                  key={ex.id}
                  ex={ex}
                  globalIndex={i + 1}
                  tip={getCoachingTip(ex)}
                  lastLog={getLastLogForExercise(workouts, getExerciseName(ex))}
                  onSwap={() => setSwappingExercise(ex)}
                  onUpdate={(updates) => onUpdateExercise(latest.id, ex.id, updates)}
                />
              ))}
            </div>
          ) : (
            groupedByMuscle.map(([muscle, exs]) => (
              <div key={muscle}>
                <div className="flex items-center gap-2 mb-3">
                  {muscleChip(muscle)}
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                <div className="space-y-1">
                  {exs.map(({ ex, globalIndex }) => (
                    <RoutineExerciseRow
                      key={ex.id}
                      ex={ex}
                      globalIndex={globalIndex}
                      tip={getCoachingTip(ex)}
                      lastLog={getLastLogForExercise(workouts, getExerciseName(ex))}
                      onSwap={() => setSwappingExercise(ex)}
                      onUpdate={(updates) => onUpdateExercise(latest.id, ex.id, updates)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Tips */}
          {latest.notes && (
            <div>
              <p className="text-[10px] text-muted uppercase tracking-[0.15em] font-bold mb-2">
                Tips
              </p>
              <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {latest.notes}
                </p>
              </div>
            </div>
          )}
        </div>

      {/* Swap Exercise Modal */}
      <SwapExerciseModal
        isOpen={!!swappingExercise}
        onClose={() => setSwappingExercise(null)}
        currentExerciseName={swappingExercise ? getExerciseName(swappingExercise) : ''}
        onSelect={async (exercise) => {
          if (!swappingExercise) return;
          await onSwapExercise(latest.id, swappingExercise.id, exercise.id);
          setSwappingExercise(null);
        }}
      />

      {/* Add Exercise Modal */}
      <SwapExerciseModal
        isOpen={addingExercise}
        onClose={() => setAddingExercise(false)}
        currentExerciseName=""
        title="Add Exercise"
        onSelect={async (exercise) => {
          await onAddExercise(latest.id, exercise.id);
          setAddingExercise(false);
        }}
      />
    </div>
  );
}

// ─── Set log types & parser ──────────────────────────────────────────────────

interface SetLog {
  set: number;
  weight: number;
  reps: number;
}


function formatSetLog(log: SetLog): string {
  return `${log.weight}lb × ${log.reps}`;
}

// ─── ExerciseLogRow ─────────────────────────────────────────────────────────

function ExerciseLogRow({
  ex,
  index,
  isRunning,
  logs,
  onUpdateLogs,
  lastLogs,
  onSwap,
}: {
  ex: WorkoutExercise;
  index: number;
  isRunning: boolean;
  logs: SetLog[];
  onUpdateLogs: (logs: SetLog[], restSeconds?: number) => void;
  lastLogs?: SetLog[] | null;
  onSwap?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [plateMode, setPlateMode] = useState(false);
  const [barWeight, setBarWeight] = useState(45);
  const hasLogs = logs.length > 0;

  const videoId = ex.exercise?.videos?.[0]?.youtubeVideoId ?? null;
  const numSets = ex.sets || 3;
  const isBarbell = (ex.exercise?.equipmentRequired?.toLowerCase().includes('barbell') ?? false)
    || getExerciseName(ex).toLowerCase().includes('barbell');

  // Parse prescribed reps (e.g. "8-10" → 8, "12" → 12)
  const prescribedReps = parseInt(ex.reps ?? '0') || 0;

  // Get default weight/reps for a given set number
  const getDefaults = (setNum: number) => {
    // 1. If this set already has a log, use it
    const existing = logs.find((l) => l.set === setNum);
    if (existing) return { weight: existing.weight, reps: existing.reps };

    // 2. Carry forward from the last logged set in this session
    const lastLogged = logs.length > 0 ? logs[logs.length - 1] : null;
    if (lastLogged) return { weight: lastLogged.weight, reps: lastLogged.reps };

    // 3. Use last session's data for this set
    if (lastLogs) {
      const lastForSet = lastLogs.find((l) => l.set === setNum) ?? lastLogs[lastLogs.length - 1];
      if (lastForSet) return { weight: lastForSet.weight, reps: lastForSet.reps };
    }

    // 4. Fallback
    return { weight: 0, reps: prescribedReps || 8 };
  };

  const handleSetLog = (setNum: number, weight: number, reps: number) => {
    const updated = [...logs.filter((l) => l.set !== setNum), { set: setNum, weight, reps }]
      .sort((a, b) => a.set - b.set);
    onUpdateLogs(updated, ex.restSeconds ?? undefined);
  };

  const handleUnlogSet = (setNum: number) => {
    onUpdateLogs(logs.filter((l) => l.set !== setNum));
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
    onUpdateLogs(filled.sort((a, b) => a.set - b.set));
  };

  const toggleExpand = () => {
    setExpanded((v) => !v);
  };

  return (
    <div className={`rounded-lg transition-all ${expanded ? 'bg-slate-800/50 p-2' : ''}`}>
      <div
        onClick={toggleExpand}
        className={`flex items-center justify-between py-1.5 text-sm ${isRunning ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-bold w-5 shrink-0 tabular-nums ${hasLogs ? 'text-primary' : 'text-slate-600'}`}>
            {hasLogs ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              String(index + 1).padStart(2, '0')
            )}
          </span>
          <span className={`truncate text-xs font-medium ${hasLogs ? 'text-white' : 'text-slate-300'}`}>
            {getExerciseName(ex)}
          </span>
          {videoId && !expanded && (
            <svg className="w-3 h-3 text-red-400/60 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted tabular-nums font-medium">
            {ex.sets}x{ex.reps ?? '?'}
          </span>
          {isRunning && (
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''} text-slate-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Logged sets chips — collapsed view */}
      {hasLogs && !expanded && (
        <div className="flex flex-wrap gap-1 ml-7 mt-0.5 mb-1">
          {logs.map((l) => (
            <span key={l.set} className="text-[10px] tabular-nums bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
              S{l.set} {formatSetLog(l)}
            </span>
          ))}
        </div>
      )}

      {/* Per-set logging UI */}
      {expanded && isRunning && (
        <div className="mt-1.5 ml-3 space-y-0.5">
          {/* Per-Side toggle — exercise level, for barbell exercises */}
          {isBarbell && (
            <div className="flex items-center gap-2 mb-1 pb-1 border-b border-slate-800/40">
              <button
                type="button"
                onClick={() => setPlateMode(!plateMode)}
                className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  plateMode
                    ? 'text-amber-400'
                    : 'text-amber-500/70 hover:text-amber-400'
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
                  <span className="text-[10px] text-slate-600">lb</span>
                </div>
              )}
            </div>
          )}

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
              />
            );
          })}

          {/* Fill remaining button */}
          {logs.length > 0 && logs.length < numSets && (
            <button
              onClick={handleFillRemaining}
              className="w-full py-1.5 mt-1 rounded-lg text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-colors"
            >
              Fill Remaining ({logs[logs.length - 1].weight}lb × {logs[logs.length - 1].reps})
            </button>
          )}

          {/* Action row: swap + shorthand */}
          <div className="flex items-center gap-2 pt-1">
            {onSwap && (
              <button
                onClick={(e) => { e.stopPropagation(); onSwap(); }}
                className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-amber-400 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Swap
              </button>
            )}
          </div>
        </div>
      )}

      {/* YouTube tutorial video — toggle */}
      {expanded && videoId && (
        <div className="ml-7 mt-2">
          <button
            onClick={() => setShowVideo((v) => !v)}
            className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors ${showVideo ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            {showVideo ? 'Hide video' : 'Watch form'}
          </button>
          {showVideo && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mt-1.5">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ActiveWorkout (in Hit It tab) ───────────────────────────────────────────

function ActiveWorkout({
  routineName,
  workouts,
  allWorkouts,
  onFinish,
  onRemove,
  onSwapExercise,
}: {
  routineName: string;
  workouts: Workout[];
  allWorkouts: Workout[];
  onFinish: (routineName: string, elapsed: number, exerciseLogs: Map<string, SetLog[]>) => void;
  onRemove: (routineName: string) => void;
  onSwapExercise?: (workoutId: string, workoutExerciseId: string) => void;
}) {
  const latest = workouts[0];
  const muscles = uniqueMuscles(latest);
  const INACTIVITY_LIMIT = 20 * 60; // 20 minutes with no set logged
  const HARD_CAP = 1 * 60 * 60; // 1 hour max

  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Rest timer state
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRemainingRef = useRef<number | null>(null);
  const restExerciseRef = useRef<string | null>(null); // which exercise started the rest timer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hasRestPeriods = latest.exercises.some((ex) => ex.restSeconds && ex.restSeconds > 0);

  const playBeep = useCallback((frequency: number, duration: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch { /* ignore audio errors */ }
  }, []);

  const cancelRest = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    restRemainingRef.current = null;
    restExerciseRef.current = null;
    setRestRemaining(null);
  }, []);

  const startRest = useCallback((seconds: number) => {
    cancelRest();
    if (seconds <= 0) return;
    setRestTotal(seconds);
    setRestRemaining(seconds);
    restRemainingRef.current = seconds;
    restIntervalRef.current = setInterval(() => {
      const curr = restRemainingRef.current;
      if (curr === null || curr <= 0) {
        if (restIntervalRef.current) {
          clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
        }
        restRemainingRef.current = null;
        setRestRemaining(null);
        return;
      }
      const next = curr - 1;
      restRemainingRef.current = next;
      setRestRemaining(next);
      // Audio beeps in last 5 seconds
      if (next > 0 && next <= 5) {
        playBeep(800, 100);
      } else if (next === 0) {
        // Done — double beep
        playBeep(600, 200);
        setTimeout(() => playBeep(600, 200), 300);
      }
    }, 1000);
  }, [cancelRest, playBeep]);

  // Map of exerciseId -> SetLog[]
  const [exerciseLogs, setExerciseLogs] = useState<Map<string, SetLog[]>>(new Map());

  const updateLogs = useCallback((exerciseId: string, logs: SetLog[], restSeconds?: number) => {
    lastActivityRef.current = Date.now();
    setExerciseLogs((prev) => {
      const next = new Map(prev);
      const prevLogs = prev.get(exerciseId) ?? [];
      next.set(exerciseId, logs);
      // Start rest timer only when a new set was added (not removed)
      if (logs.length > prevLogs.length && restSeconds && restSeconds > 0) {
        // Don't reset an active timer from a different exercise
        const timerRunning = restRemainingRef.current !== null && restRemainingRef.current > 0;
        const sameExercise = restExerciseRef.current === exerciseId;
        if (!timerRunning || sameExercise) {
          restExerciseRef.current = exerciseId;
          startRest(restSeconds);
        }
      }
      return next;
    });
  }, [startRest]);

  const stopRef = useRef<() => void>(() => {});

  const tick = useCallback(() => {
    if (startTimeRef.current == null) return;
    const now = Date.now();
    const secs = Math.floor((now - startTimeRef.current) / 1000);
    setElapsed(secs);

    // Auto-stop: 15 min inactivity or 2 hour hard cap
    const idleSecs = Math.floor((now - lastActivityRef.current) / 1000);
    if (secs >= HARD_CAP || idleSecs >= INACTIVITY_LIMIT) {
      setAutoStopped(true);
      stopRef.current();
    }
  }, [HARD_CAP, INACTIVITY_LIMIT]);

  const start = useCallback(() => {
    if (isRunning) return;
    const now = Date.now();
    startTimeRef.current = now;
    lastActivityRef.current = now;
    setAutoStopped(false);
    setIsRunning(true);
    intervalRef.current = setInterval(tick, 1000);
    // Initialize AudioContext on user gesture
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { /* no audio support */ }
    }
  }, [isRunning, tick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    cancelRest();
    // Compute final elapsed from real clock
    if (startTimeRef.current != null) {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
    setIsRunning(false);
  }, [cancelRest]);

  // Keep stopRef in sync so tick can call it without stale closure
  stopRef.current = stop;

  // Recalculate elapsed when screen wakes up (visibilitychange)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && startTimeRef.current != null) {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [tick]);

  const handleFinish = async () => {
    stop();
    setSaving(true);

    // Save logs to API
    const exercisePayload = Array.from(exerciseLogs.entries())
      .filter(([, logs]) => logs.length > 0)
      .map(([exerciseId, setLogs]) => ({ exerciseId, setLogs }));

    if (exercisePayload.length > 0) {
      try {
        await fetch(`/api/workouts/${latest.id}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exercises: exercisePayload,
            durationMinutes: Math.ceil(elapsed / 60),
          }),
        });
      } catch {
        // Still mark as finished even if save fails
      }
    }

    setSaving(false);
    onFinish(routineName, elapsed, exerciseLogs);
  };

  const loggedCount = Array.from(exerciseLogs.values()).filter((l) => l.length > 0).length;
  const totalExercises = latest.exercises.length;

  return (
    <Card className="border border-border-dark">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-black text-white capitalize tracking-wide">
            {routineName.replace(/_/g, ' ')}
          </h4>
          {muscles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {muscles.map((m) => muscleChip(m))}
            </div>
          )}
        </div>
        {!isRunning && elapsed === 0 && (
          <button
            onClick={() => onRemove(routineName)}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors p-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Timer + progress */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <span className={`text-3xl font-black tabular-nums tracking-tight ${isRunning ? 'text-primary' : 'text-slate-400'}`}>
          {formatTimer(elapsed)}
        </span>
        {/* Rest countdown timer */}
        {isRunning && hasRestPeriods && restRemaining !== null && (
          <div className="flex items-center gap-1">
            <span className="text-slate-600">|</span>
            <span className={`text-xl font-bold tabular-nums tracking-tight transition-all ${
              restRemaining <= 5
                ? 'text-red-400 animate-pulse'
                : 'text-amber-400'
            }`}>
              {formatTimer(restRemaining)}
            </span>
          </div>
        )}
        {/* Show 0:00 placeholder when routine has rest but timer isn't active */}
        {isRunning && hasRestPeriods && restRemaining === null && (
          <div className="flex items-center gap-1">
            <span className="text-slate-600">|</span>
            <span className="text-xl font-bold tabular-nums tracking-tight text-slate-600">
              00:00
            </span>
          </div>
        )}
        {isRunning && totalExercises > 0 && (
          <span className="text-[10px] text-muted font-bold tabular-nums">
            {loggedCount}/{totalExercises}
          </span>
        )}
      </div>

      {/* Exercise list */}
      <div className="mt-3 space-y-0.5">
        {/* Sticky rest timer — stays visible when scrolling through exercises */}
        {isRunning && hasRestPeriods && restRemaining !== null && (
          <div className="sticky top-0 z-20 flex items-center justify-center py-2 -mx-4 px-4 bg-background/90 backdrop-blur-md border-b border-slate-800/50">
            <span className="text-xs text-muted uppercase tracking-wider font-bold mr-2">Rest</span>
            <span className={`text-lg font-black tabular-nums ${
              restRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-400'
            }`}>
              {formatTimer(restRemaining)}
            </span>
            <button onClick={cancelRest} className="ml-3 p-2 text-slate-600 active:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {latest.exercises.map((ex, i) => (
          <ExerciseLogRow
            key={ex.id}
            ex={ex}
            index={i}
            isRunning={isRunning}
            logs={exerciseLogs.get(ex.id) ?? []}
            onUpdateLogs={(logs, restSecs) => updateLogs(ex.id, logs, restSecs)}
            lastLogs={getLastLogForExercise(allWorkouts, getExerciseName(ex), latest.id)}
            onSwap={onSwapExercise ? () => onSwapExercise(latest.id, ex.id) : undefined}
          />
        ))}
      </div>

      {/* Hint when running */}
      {isRunning && loggedCount === 0 && (
        <p className="text-[10px] text-slate-600 text-center mt-3 font-medium">
          Tap an exercise to log your sets
        </p>
      )}

      <div className="mt-5 flex gap-2">
        {!isRunning && elapsed === 0 && (
          <button
            onClick={start}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white font-bold text-sm tracking-wide uppercase transition-all hover:bg-primary-dark active:scale-[0.98]"
          >
            Start Workout
          </button>
        )}
        {isRunning && (
          <button
            onClick={handleFinish}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-red-500/90 text-white font-bold text-sm tracking-wide uppercase transition-all hover:bg-red-600 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                Stop
              </>
            )}
          </button>
        )}
        {!isRunning && elapsed > 0 && (
          <div className={`flex-1 py-2.5 rounded-lg font-bold text-sm tracking-wide uppercase text-center ${autoStopped ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'}`}>
            {autoStopped ? `Auto-stopped — ${formatTimer(elapsed)}` : `Completed — ${formatTimer(elapsed)}`}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── FinishedWorkoutCard ──────────────────────────────────────────────────────

function FinishedWorkoutCard({
  fw,
  onDelete,
}: {
  fw: { name: string; elapsed: number; finishedAt: Date; exerciseLogs: Map<string, SetLog[]>; workout: Workout };
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Get exercises that have logs
  const loggedExercises = fw.workout.exercises
    ?.filter((ex) => {
      const logs = fw.exerciseLogs.get(ex.id);
      return logs && logs.length > 0;
    }) ?? [];

  const totalSets = Array.from(fw.exerciseLogs.values()).reduce((sum, logs) => sum + logs.length, 0);

  return (
    <div className="rounded-xl bg-primary/5 border border-primary/20 mb-2 overflow-hidden">
      {/* Header — always visible, tappable */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between py-3 px-4 text-left"
      >
        <div>
          <p className="text-sm font-bold text-white capitalize tracking-wide">
            {fw.name.replace(/_/g, ' ')}
          </p>
          <p className="text-[10px] text-muted mt-0.5">
            Finished at {fw.finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {loggedExercises.length > 0 && (
              <span className="text-slate-500 ml-2">
                {loggedExercises.length} exercises &middot; {totalSets} sets
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-primary tabular-nums">
            {formatTimer(fw.elapsed)}
          </span>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded — logged exercises */}
      {expanded && loggedExercises.length > 0 && (
        <div className="px-4 pb-3 space-y-2 border-t border-primary/10 pt-2">
          {loggedExercises.map((ex) => {
            const logs = fw.exerciseLogs.get(ex.id) ?? [];
            const name = getExerciseName(ex);
            return (
              <div key={ex.id}>
                <p className="text-xs font-semibold text-white">{name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {logs.map((log, j) => (
                    <span key={j} className="text-[11px] text-slate-400 tabular-nums">
                      {log.weight}lb &times; {log.reps}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && loggedExercises.length === 0 && (
        <div className="px-4 pb-3 border-t border-primary/10 pt-2">
          <p className="text-xs text-slate-500 italic">No sets logged</p>
        </div>
      )}

      {/* Delete button — visible when expanded */}
      {expanded && (
        <div className="px-4 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 hover:text-red-400 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove from session
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'routines' | 'history' | 'hit-it';

const CATEGORIES = ['all', 'lifting', 'hiit', 'cardio', 'mobility', 'calisthenics', 'sport', 'external'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<string, string> = {
  lifting: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  hiit: 'bg-red-500/20 text-red-300 border-red-500/30',
  cardio: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  mobility: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  calisthenics: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  sport: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  external: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const SPIN_CONFIRMS = [
  { title: 'Time to shake things up?', body: 'Your muscles are getting too comfortable. Let Coach cook you a fresh routine.' },
  { title: 'Bored of this one, huh?', body: 'No shame — variety is the spice of gains. Let\'s get a new lineup.' },
  { title: 'Remix incoming?', body: 'Same muscles, brand new pain. Coach will whip up something different.' },
  { title: 'Feeling adventurous?', body: 'The old routine had a good run. Time for a plot twist.' },
  { title: 'Out with the old?', body: 'Coach is warming up a fresh set of exercises for you. Ready?' },
];

export default function WorkoutsPage() {
  const { chatOpen, dataVersion, sendMessage, setChatOpen, setChatTopic, setCustomBack } = useFitClaude();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('routines');
  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(null);
  const [hitItQueue, setHitItQueue] = useState<string[]>([]);
  const [spinTarget, setSpinTarget] = useState<{ name: string; muscles: string[]; exerciseCount: number; category: string; confirm: typeof SPIN_CONFIRMS[number] } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [routineSearch, setRoutineSearch] = useState('');
  const [finishedWorkouts, setFinishedWorkouts] = useState<
    { name: string; elapsed: number; finishedAt: Date; exerciseLogs: Map<string, SetLog[]>; workout: Workout }[]
  >([]);
  const [hitItSwapping, setHitItSwapping] = useState<{ workoutId: string; workoutExerciseId: string; exerciseName: string } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Override Header back button when routine detail is open
  useEffect(() => {
    if (selectedRoutine) {
      setCustomBack(() => setSelectedRoutine(null));
    } else {
      setCustomBack(null);
    }
    return () => setCustomBack(null);
  }, [selectedRoutine, setCustomBack]);

  const fetchWorkouts = useCallback(() => {
    fetch('/api/workouts?daysBack=90')
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setWorkouts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setWorkouts([]);
        setLoading(false);
      });
  }, []);

  const fetchActivities = useCallback(() => {
    fetch('/api/activities?daysBack=90')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(() => setActivities([]));
  }, []);

  // Initial load + re-fetch when chat creates/modifies workouts
  useEffect(() => {
    fetchWorkouts();
    fetchActivities();
  }, [fetchWorkouts, fetchActivities, dataVersion]);

  const routineGroups = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of workouts) {
      const key = routineKey(w);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return Array.from(map.entries()).sort(
      ([, a], [, b]) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime()
    );
  }, [workouts]);

  // Filter routine groups by category + search
  const filteredRoutineGroups = useMemo(() => {
    let filtered = routineGroups;
    if (categoryFilter === 'external') {
      filtered = filtered.filter(([, group]) => group[0].source === 'manual');
    } else if (categoryFilter !== 'all') {
      filtered = filtered.filter(([, group]) => {
        return (group[0].category || 'lifting') === categoryFilter;
      });
    }
    if (muscleFilter) {
      filtered = filtered.filter(([, group]) =>
        uniqueMuscles(group[0]).some((m) => consolidateMuscle(m) === muscleFilter)
      );
    }
    if (routineSearch.trim()) {
      const q = routineSearch.toLowerCase().trim();
      filtered = filtered.filter(([key, group]) => {
        const latest = group[0];
        // Match on routine name
        if (key.toLowerCase().includes(q)) return true;
        // Match on workout type
        if (latest.workoutType.toLowerCase().includes(q)) return true;
        // Match on muscle groups
        const muscles = uniqueMuscles(latest);
        if (muscles.some((m) => m.toLowerCase().includes(q))) return true;
        // Match on exercise names
        if (latest.exercises.some((ex) => getExerciseName(ex).toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return filtered;
  }, [routineGroups, categoryFilter, muscleFilter, routineSearch]);

  // Categories that actually have routines (for showing only relevant pills)
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const [, group] of routineGroups) {
      cats.add(group[0].category || 'lifting');
      if (group[0].source === 'manual') cats.add('external');
    }
    return cats;
  }, [routineGroups]);

  const activeMuscles = useMemo(() => {
    const ms = new Set<string>();
    for (const [, group] of routineGroups) {
      for (const m of uniqueMuscles(group[0])) ms.add(consolidateMuscle(m));
    }
    return ms;
  }, [routineGroups]);

  const selectedGroup = selectedRoutine
    ? routineGroups.find(([k]) => k === selectedRoutine)?.[1] ?? null
    : null;

  const addToHitIt = (name: string) => {
    const alreadyQueued = hitItQueue.includes(name);
    if (!alreadyQueued) {
      setHitItQueue((prev) => [...prev, name]);
    }
    setSelectedRoutine(null);
    setTab('hit-it');
  };

  const removeFromHitIt = (name: string) => {
    setHitItQueue((prev) => {
      const next = prev.filter((n) => n !== name);
      if (next.length === 0) setTab('routines');
      return next;
    });
  };

  const handleFinish = (name: string, elapsed: number, exerciseLogs: Map<string, SetLog[]>) => {
    const group = routineGroups.find(([k]) => k === name)?.[1];
    const workout = group?.[0] ?? null;
    if (workout) {
      setFinishedWorkouts((prev) => [...prev, { name, elapsed, finishedAt: new Date(), exerciseLogs, workout }]);
    } else {
      setFinishedWorkouts((prev) => [...prev, { name, elapsed, finishedAt: new Date(), exerciseLogs: new Map(), workout: {} as Workout }]);
    }
    setHitItQueue((prev) => {
      const next = prev.filter((n) => n !== name);
      if (next.length === 0) setTab('history');
      return next;
    });
    fetchWorkouts(); // Refresh to show updated logs
  };

  const handleRename = async (workoutIds: string[], newName: string) => {
    await Promise.all(
      workoutIds.map((id) =>
        fetch(`/api/workouts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        })
      )
    );
    setSelectedRoutine(newName);
    fetchWorkouts();
  };

  const handleDeleteRoutine = async (workoutIds: string[]) => {
    await Promise.all(
      workoutIds.map((id) =>
        fetch(`/api/workouts/${id}`, { method: 'DELETE' })
      )
    );
    setSelectedRoutine(null);
    fetchWorkouts();
  };

  const handleDeleteSession = async (workoutId: string) => {
    // Find which routine group this workout belongs to
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;
    const key = routineKey(workout);
    const group = routineGroups.find(([k]) => k === key)?.[1];

    // If this is the last session in the routine, just clear logs instead of deleting
    // This prevents accidentally deleting the entire routine
    if (!group || group.length <= 1) {
      await fetch(`/api/workouts/${workoutId}/log`, { method: 'DELETE' });
    } else {
      await fetch(`/api/workouts/${workoutId}`, { method: 'DELETE' });
    }
    fetchWorkouts();
  };

  const handleDeleteLogs = async (workoutId: string) => {
    await fetch(`/api/workouts/${workoutId}/log`, { method: 'DELETE' });
    fetchWorkouts();
  };

  const handleEditLog = async (workoutId: string, exerciseId: string, logs: SetLog[]) => {
    await fetch(`/api/workouts/${workoutId}/log`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercises: [{ exerciseId, setLogs: logs }],
      }),
    });
    fetchWorkouts();
  };

  const handleSwapExercise = async (workoutId: string, workoutExerciseId: string, newExerciseId: string) => {
    const res = await fetch(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newExerciseId }),
    });
    if (res.ok) {
      fetchWorkouts();
    }
  };

  const handleUpdateExercise = async (
    workoutId: string,
    workoutExerciseId: string,
    updates: { sets?: number; reps?: string; restSeconds?: number }
  ) => {
    const res = await fetch(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      fetchWorkouts();
    }
  };

  const handleAddExercise = async (workoutId: string, exerciseId: string) => {
    const res = await fetch(`/api/workouts/${workoutId}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId }),
    });
    if (res.ok) {
      fetchWorkouts();
    }
  };

  const requestSpin = (routineName: string) => {
    const group = routineGroups.find(([k]) => k === routineName)?.[1];
    if (!group) return;
    const latest = group[0];
    const muscles = uniqueMuscles(latest);
    const category = latest.category || 'lifting';
    const confirm = SPIN_CONFIRMS[Math.floor(Math.random() * SPIN_CONFIRMS.length)];
    setSpinTarget({ name: routineName, muscles, exerciseCount: latest.exercises.length, category, confirm });
  };

  const confirmSpin = async () => {
    if (!spinTarget) return;
    setSpinning(true);
    const { name, muscles, exerciseCount, category } = spinTarget;
    let msg: string;
    if (category !== 'lifting') {
      msg = `Generate a new HIIT / cardio workout with ${exerciseCount} exercises. This replaces my "${name.replace(/_/g, ' ')}" routine — keep it HIIT style but give me different exercises.`;
    } else {
      const muscleList = muscles.join(' & ');
      msg = `Generate a new ${muscleList} workout with ${exerciseCount} exercises. This replaces my "${name.replace(/_/g, ' ')}" routine — keep the same muscle focus but give me different exercises.`;
    }
    setChatTopic('workout');
    setChatOpen(true);
    setSpinTarget(null);
    setSpinning(false);
    await sendMessage(msg);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted text-sm font-medium tracking-wide">Loading workouts...</div>
      </div>
    );
  }

  // ── Full-screen detail view ──
  if (selectedRoutine && selectedGroup) {
    return (
      <div className="h-full max-w-lg mx-auto flex flex-col">
        <RoutineDetail
          workouts={selectedGroup}
          onBack={() => setSelectedRoutine(null)}
          onHitIt={() => addToHitIt(selectedRoutine)}
          isInHitIt={hitItQueue.includes(selectedRoutine)}
          onRename={handleRename}
          onDelete={handleDeleteRoutine}
          onDeleteLogs={handleDeleteLogs}
          onEditLog={handleEditLog}
          onDeleteSession={handleDeleteSession}
          onSwapExercise={handleSwapExercise}
          onAddExercise={handleAddExercise}
          onUpdateExercise={handleUpdateExercise}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Tab bar */}
      <div className="flex gap-1 p-4 pb-2 shrink-0">
        {([
          { key: 'routines' as Tab, label: 'Routines' },
          ...(hitItQueue.length > 0 ? [{ key: 'hit-it' as Tab, label: `Hit It (${hitItQueue.length})` }] : []),
          { key: 'history' as Tab, label: 'History' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-200 ${
              tab === key
                ? key === 'hit-it'
                  ? 'bg-amber-400 text-black shadow-[0_2px_12px_rgba(251,191,36,0.3)]'
                  : 'bg-primary text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)]'
                : key === 'hit-it'
                  ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                  : 'text-muted hover:text-white hover:bg-card-hover'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Routines Tab — full-width list */}
      {tab === 'routines' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Category filter pills */}
          {activeCategories.size > 1 && (
            <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide">
              {CATEGORIES.filter((c) => c === 'all' || activeCategories.has(c)).map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setMuscleFilter(null); }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                    categoryFilter === cat
                      ? cat === 'all'
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : CATEGORY_COLORS[cat] || 'bg-slate-700 text-white border-slate-600'
                      : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Muscle group filter pills */}
          {activeMuscles.size > 1 && (
            <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
              {MUSCLE_PILL_ORDER.filter((m) => activeMuscles.has(m)).map((muscle) => (
                <button
                  key={muscle}
                  onClick={() => setMuscleFilter(muscleFilter === muscle ? null : muscle)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                    muscleFilter === muscle
                      ? (MUSCLE_COLORS[muscle] || 'bg-slate-500/20 text-slate-300') + ' border-transparent'
                      : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div className="px-4 pb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={routineSearch}
                onChange={(e) => setRoutineSearch(e.target.value)}
                placeholder="Search routines, muscles, exercises…"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-colors"
              />
              {routineSearch && (
                <button
                  onClick={() => setRoutineSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="px-4 pb-4 space-y-2">
          {filteredRoutineGroups.length === 0 ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Card className="text-center">
                <p className="text-muted text-sm font-medium">
                  {routineGroups.length === 0
                    ? 'No routines yet. Chat with your coach to generate one!'
                    : routineSearch
                      ? `No routines match "${routineSearch}"`
                      : muscleFilter
                        ? `No ${muscleFilter} routines${categoryFilter !== 'all' ? ` in ${categoryFilter}` : ''}.`
                        : `No ${categoryFilter} routines yet.`}
                </p>
              </Card>
            </div>
          ) : (
            filteredRoutineGroups.map(([key, group]) => (
              <RoutineCard
                key={key}
                name={key}
                workouts={group}
                onClick={() => setSelectedRoutine(key)}
                onSpin={() => requestSpin(key)}
              />
            ))
          )}
          </div>
        </div>
      )}

      {/* Hit It Tab — active workouts */}
      {tab === 'hit-it' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {hitItQueue.length === 0 ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="text-center px-6">
                <p className="text-2xl font-black text-slate-600 tracking-wide uppercase">
                  No Active Workouts
                </p>
                <p className="text-sm text-muted mt-2 font-medium">
                  Queue a routine to start training
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-1">
              {hitItQueue.map((name) => {
                const group = routineGroups.find(([k]) => k === name)?.[1];
                if (!group) return null;
                return (
                  <ActiveWorkout
                    key={name}
                    routineName={name}
                    workouts={group}
                    allWorkouts={workouts}
                    onFinish={handleFinish}
                    onRemove={removeFromHitIt}
                    onSwapExercise={(workoutId, workoutExerciseId) =>
                      setHitItSwapping({ workoutId, workoutExerciseId, exerciseName: '' })
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Tab — completed workouts + activities merged by date */}
      {tab === 'history' && (() => {
        const completedWorkouts = workouts
          .filter((w) => w.completed || sessionHasLogs(w))
          .map((w) => ({ type: 'workout' as const, date: w.date, data: w }));
        const activityItems = activities.map((a) => ({ type: 'activity' as const, date: a.date, data: a }));
        const merged = [...completedWorkouts, ...activityItems]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return (
          <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
            {merged.length === 0 ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center px-6">
                  <p className="text-2xl font-black text-slate-600 tracking-wide uppercase">
                    No History
                  </p>
                  <p className="text-sm text-muted mt-2 font-medium">
                    Complete a workout or log an activity to see it here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {merged.map((item) =>
                  item.type === 'workout' ? (
                    <SessionLogCard
                      key={item.data.id}
                      workout={item.data}
                      onDeleteLogs={handleDeleteLogs}
                      onEditLog={handleEditLog}
                      onDeleteSession={handleDeleteSession}
                      canDeleteSession={true}
                    />
                  ) : (
                    <div key={item.data.id} className="px-4 py-3 rounded-xl glass">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Activity
                          </span>
                          <p className="font-bold text-white text-sm capitalize">{item.data.name}</p>
                        </div>
                        {item.data.durationMinutes && (
                          <span className="text-xs text-muted tabular-nums">{item.data.durationMinutes} min</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(item.data.date)}</p>
                      {item.data.notes && (
                        <p className="text-xs text-slate-400 mt-1">{item.data.notes}</p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Swap Exercise Modal for Hit It tab */}
      <SwapExerciseModal
        isOpen={!!hitItSwapping}
        onClose={() => setHitItSwapping(null)}
        currentExerciseName={hitItSwapping?.exerciseName ?? ''}
        onSelect={async (exercise) => {
          if (!hitItSwapping) return;
          await handleSwapExercise(hitItSwapping.workoutId, hitItSwapping.workoutExerciseId, exercise.id);
          setHitItSwapping(null);
        }}
      />

      {/* Spin confirmation overlay */}
      {spinTarget && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setSpinTarget(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[320px] w-full shadow-2xl">
            <div className="text-center mb-1">
              <span className="text-2xl">🎰</span>
            </div>
            <p className="text-sm font-bold text-white text-center">{spinTarget.confirm.title}</p>
            <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed">
              {spinTarget.confirm.body}
            </p>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              {spinTarget.muscles.join(' & ').toUpperCase()} · {spinTarget.exerciseCount} exercises
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSpinTarget(null)}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 transition-colors"
              >
                Nah, keep it
              </button>
              <button
                onClick={confirmSpin}
                disabled={spinning}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {spinning ? 'Spinning...' : 'Let\'s go!'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
