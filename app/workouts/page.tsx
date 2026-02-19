'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Workout, WorkoutExercise } from '@/types';

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
  onSendToHitIt,
  isInHitIt,
}: {
  name: string;
  workouts: Workout[];
  onClick: () => void;
  onSendToHitIt: () => void;
  isInHitIt: boolean;
}) {
  const latest = workouts[0];
  const typeColor = TYPE_COLORS[latest.workoutType] ?? 'default';
  const muscles = uniqueMuscles(latest);
  const exerciseCount = latest.exercises.length;
  const routineNum = getRoutineDisplayId(workouts);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border bg-card border-border-dark hover:bg-card-hover hover:border-slate-600 transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {routineNum != null && (
              <span className="text-[10px] font-black text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-md tabular-nums tracking-tight shrink-0">
                #{routineNum}
              </span>
            )}
            <p className="font-bold text-white text-sm leading-tight truncate capitalize tracking-wide">
              {name.replace(/_/g, ' ')}
            </p>
            <Badge variant={typeColor} size="sm">
              {latest.workoutType.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted font-medium">{workouts.length}x done</span>
            {exerciseCount > 0 && (
              <span className="text-xs text-slate-500">{exerciseCount} exercises</span>
            )}
          </div>
        </div>

        {/* Hit It button */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            if (!isInHitIt) onSendToHitIt();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              if (!isInHitIt) onSendToHitIt();
            }
          }}
          className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md transition-all shrink-0 ${
            isInHitIt
              ? 'bg-primary/20 text-primary cursor-default'
              : 'bg-slate-700/60 text-slate-400 hover:bg-primary/20 hover:text-primary cursor-pointer'
          }`}
        >
          {isInHitIt ? 'Queued' : 'Hit It'}
        </span>
      </div>

      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {muscles.slice(0, 4).map((m) => muscleChip(m))}
          {muscles.length > 4 && (
            <span className="text-[10px] text-muted self-center">+{muscles.length - 4}</span>
          )}
        </div>
      )}
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
  const [editInput, setEditInput] = useState('');
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  const editRef = useRef<HTMLInputElement>(null);
  const hasLogs = sessionHasLogs(workout);
  const loggedExercises = workout.exercises.filter(
    (ex) => parseStoredSetLogs(ex.setLogs).length > 0
  );

  const startEdit = (ex: WorkoutExercise) => {
    const logs = parseStoredSetLogs(ex.setLogs);
    setEditingExId(ex.id);
    setEditInput(logs.map((l) => `${l.set}@${l.weight}x${l.reps}`).join(' '));
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const submitEdit = (exerciseId: string) => {
    const parsed = parseSetLogs(editInput);
    onEditLog(workout.id, exerciseId, parsed);
    setEditingExId(null);
    setEditInput('');
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

                {/* Edit mode */}
                {isEditing && (
                  <div className="ml-7 mt-1.5 flex gap-1.5">
                    <input
                      ref={editRef}
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); submitEdit(ex.id); }
                        if (e.key === 'Escape') { setEditingExId(null); setEditInput(''); }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums font-medium"
                    />
                    <button
                      onClick={() => submitEdit(ex.id)}
                      className="px-2 py-1.5 bg-primary rounded-lg text-white text-[10px] font-bold shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingExId(null); setEditInput(''); }}
                      className="px-2 py-1.5 bg-slate-700 rounded-lg text-slate-300 text-[10px] font-bold shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Set log chips */}
                {hasExLogs && !isEditing && (
                  <div className="flex flex-wrap gap-1 ml-7 mt-1">
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

// ─── RoutineDetail (full-screen view) ────────────────────────────────────────

type DetailTab = 'routine' | 'log';

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
}) {
  const [detailTab, setDetailTab] = useState<DetailTab>('routine');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const latest = workouts[0];
  const muscles = uniqueMuscles(latest);
  const totalSets = latest.exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const totalExercises = latest.exercises.length;
  const routineNum = getRoutineDisplayId(workouts);

  const completedSessions = workouts.filter((w) => w.completed);

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
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-muted hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onHitIt}
            className={`text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-lg transition-all ${
              isInHitIt
                ? 'bg-primary/20 text-primary'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {isInHitIt ? 'Queued' : 'Hit It'}
          </button>
          {/* ... menu */}
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

      {/* Title + stats (always visible) */}
      <div className="px-4 pt-4 pb-2 shrink-0">
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
          <div className="flex items-center gap-2.5">
            {routineNum != null && (
              <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg tabular-nums tracking-tight">
                #{routineNum}
              </span>
            )}
            <h2 className="text-xl font-black text-white capitalize tracking-wide">
              {routineKey(latest).replace(/_/g, ' ')}
            </h2>
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

        {muscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {muscles.map((m) => muscleChip(m))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2 shrink-0">
        {([
          { key: 'routine' as DetailTab, label: 'Routine' },
          { key: 'log' as DetailTab, label: 'Log', count: completedSessions.length },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setDetailTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 ${
              detailTab === key
                ? 'bg-primary text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)]'
                : 'text-muted hover:text-white hover:bg-card-hover'
            }`}
          >
            {label}
            {count != null && count > 0 && (
              <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${
                detailTab === key ? 'bg-white/20' : 'bg-slate-700'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Routine Tab */}
      {detailTab === 'routine' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 scrollbar-hide">
          {/* Exercise breakdown grouped by muscle */}
          {groupedByMuscle.map(([muscle, exs]) => (
            <div key={muscle}>
              <div className="flex items-center gap-2 mb-3">
                {muscleChip(muscle)}
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <div className="space-y-1">
                {exs.map(({ ex, globalIndex }) => {
                  const tip = getCoachingTip(ex);
                  const lastLog = getLastLogForExercise(workouts, getExerciseName(ex));
                  return (
                    <div key={ex.id} className="py-2 border-b border-slate-800/40 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="text-[10px] text-slate-500 font-bold tabular-nums mt-0.5 shrink-0">
                            {String(globalIndex).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-semibold">
                              {getExerciseName(ex)}
                              {ex.wasSpicy && <span className="ml-1">🌶️</span>}
                            </p>
                            {tip && (
                              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed italic">
                                {tip}
                              </p>
                            )}
                            {/* Last log inline */}
                            {lastLog && (
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5 tabular-nums">
                                Last: {lastLog.map((l) => `${l.weight}×${l.reps}`).join('  ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-primary font-bold tabular-nums">
                            {ex.sets} x {ex.reps ?? '?'}
                          </p>
                          {ex.weightKg != null && (
                            <p className="text-[10px] text-muted">{ex.weightKg} kg</p>
                          )}
                          {ex.restSeconds != null && (
                            <p className="text-[10px] text-slate-600">{ex.restSeconds}s rest</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

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
      )}

      {/* Log Tab — only show sessions that have been started (have logs or marked complete) */}
      {detailTab === 'log' && (() => {
        const startedSessions = workouts.filter((w) => w.completed || sessionHasLogs(w));
        return (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-hide">
            {startedSessions.length === 0 ? (
              <div className="flex items-center justify-center min-h-[30vh]">
                <p className="text-sm text-muted font-medium">No sessions logged yet</p>
              </div>
            ) : (
              <>
                {startedSessions.map((w) => (
                  <SessionLogCard
                    key={w.id}
                    workout={w}
                    onDeleteLogs={onDeleteLogs}
                    onEditLog={onEditLog}
                    onDeleteSession={onDeleteSession}
                    canDeleteSession={workouts.length > 1}
                  />
                ))}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Set log types & parser ──────────────────────────────────────────────────

interface SetLog {
  set: number;
  weight: number;
  reps: number;
}

/**
 * Parse shorthand like "1@195x4 2@200x5 3@195x6"
 * Each token: <set>@<weight>x<reps>
 * Also supports just "<weight>x<reps>" (auto-numbers sets)
 */
function parseSetLogs(input: string): SetLog[] {
  if (!input.trim()) return [];
  const tokens = input.trim().split(/\s+/);
  const logs: SetLog[] = [];
  let autoSet = 1;

  for (const token of tokens) {
    // Try full format: 1@195x4
    const fullMatch = token.match(/^(\d+)@([\d.]+)x(\d+)$/i);
    if (fullMatch) {
      logs.push({
        set: parseInt(fullMatch[1]),
        weight: parseFloat(fullMatch[2]),
        reps: parseInt(fullMatch[3]),
      });
      autoSet = parseInt(fullMatch[1]) + 1;
      continue;
    }
    // Try short format: 195x4 (auto-number)
    const shortMatch = token.match(/^([\d.]+)x(\d+)$/i);
    if (shortMatch) {
      logs.push({
        set: autoSet++,
        weight: parseFloat(shortMatch[1]),
        reps: parseInt(shortMatch[2]),
      });
    }
  }
  return logs;
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
}: {
  ex: WorkoutExercise;
  index: number;
  isRunning: boolean;
  logs: SetLog[];
  onUpdateLogs: (logs: SetLog[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLogs = logs.length > 0;

  const handleSubmit = () => {
    const parsed = parseSetLogs(input);
    if (parsed.length > 0) {
      onUpdateLogs(parsed);
      setInput('');
      setExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setExpanded(false);
      setInput('');
    }
  };

  const toggleExpand = () => {
    if (!isRunning) return;
    setExpanded((v) => !v);
    if (!expanded) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
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

      {/* Logged sets chips */}
      {hasLogs && !expanded && (
        <div className="flex flex-wrap gap-1 ml-7 mt-0.5 mb-1">
          {logs.map((l) => (
            <span key={l.set} className="text-[10px] tabular-nums bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
              S{l.set} {formatSetLog(l)}
            </span>
          ))}
        </div>
      )}

      {/* Quick input */}
      {expanded && isRunning && (
        <div className="mt-1.5 ml-7">
          {hasLogs && (
            <div className="flex flex-wrap gap-1 mb-2">
              {logs.map((l) => (
                <span key={l.set} className="text-[10px] tabular-nums bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
                  S{l.set} {formatSetLog(l)}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="1@195x4 2@200x5"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums font-medium"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-2.5 py-1.5 bg-primary rounded-lg text-white text-xs font-bold disabled:opacity-30 transition-colors shrink-0"
            >
              Log
            </button>
          </div>
          <p className="text-[9px] text-slate-600 mt-1 font-medium">
            Format: set@weightxreps — e.g. 1@195x4 2@200x5
          </p>
        </div>
      )}
    </div>
  );
}

// ─── ActiveWorkout (in Hit It tab) ───────────────────────────────────────────

function ActiveWorkout({
  routineName,
  workouts,
  onFinish,
  onRemove,
}: {
  routineName: string;
  workouts: Workout[];
  onFinish: (routineName: string, elapsed: number, exerciseLogs: Map<string, SetLog[]>) => void;
  onRemove: (routineName: string) => void;
}) {
  const latest = workouts[0];
  const muscles = uniqueMuscles(latest);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Map of exerciseId -> SetLog[]
  const [exerciseLogs, setExerciseLogs] = useState<Map<string, SetLog[]>>(new Map());

  const updateLogs = useCallback((exerciseId: string, logs: SetLog[]) => {
    setExerciseLogs((prev) => {
      const next = new Map(prev);
      next.set(exerciseId, logs);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, [isRunning]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
        {isRunning && totalExercises > 0 && (
          <span className="text-[10px] text-muted font-bold tabular-nums">
            {loggedCount}/{totalExercises}
          </span>
        )}
      </div>

      {/* Exercise list */}
      <div className="mt-3 space-y-0.5">
        {latest.exercises.map((ex, i) => (
          <ExerciseLogRow
            key={ex.id}
            ex={ex}
            index={i}
            isRunning={isRunning}
            logs={exerciseLogs.get(ex.id) ?? []}
            onUpdateLogs={(logs) => updateLogs(ex.id, logs)}
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
          <div className="flex-1 py-2.5 rounded-lg bg-primary/20 text-primary font-bold text-sm tracking-wide uppercase text-center">
            Completed — {formatTimer(elapsed)}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── FinishedWorkoutCard ──────────────────────────────────────────────────────

function FinishedWorkoutCard({
  fw,
}: {
  fw: { name: string; elapsed: number; finishedAt: Date; exerciseLogs: Map<string, SetLog[]>; workout: Workout };
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'routines' | 'hitit';

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('routines');
  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(null);
  const [hitItQueue, setHitItQueue] = useState<string[]>([]);
  const [finishedWorkouts, setFinishedWorkouts] = useState<
    { name: string; elapsed: number; finishedAt: Date; exerciseLogs: Map<string, SetLog[]>; workout: Workout }[]
  >([]);

  const fetchWorkouts = useCallback(() => {
    fetch('/api/workouts?daysBack=90')
      .then((r) => r.json())
      .then((data: Workout[]) => {
        setWorkouts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

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

  const selectedGroup = selectedRoutine
    ? routineGroups.find(([k]) => k === selectedRoutine)?.[1] ?? null
    : null;

  const addToHitIt = (name: string) => {
    if (!hitItQueue.includes(name)) setHitItQueue((prev) => [...prev, name]);
    setSelectedRoutine(null);
    setTab('hitit');
  };

  const removeFromHitIt = (name: string) => {
    setHitItQueue((prev) => prev.filter((n) => n !== name));
  };

  const handleFinish = (name: string, elapsed: number, exerciseLogs: Map<string, SetLog[]>) => {
    const group = routineGroups.find(([k]) => k === name)?.[1];
    const workout = group?.[0] ?? null;
    if (workout) {
      setFinishedWorkouts((prev) => [...prev, { name, elapsed, finishedAt: new Date(), exerciseLogs, workout }]);
    } else {
      setFinishedWorkouts((prev) => [...prev, { name, elapsed, finishedAt: new Date(), exerciseLogs: new Map(), workout: {} as Workout }]);
    }
    setHitItQueue((prev) => prev.filter((n) => n !== name));
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
      <div className="h-[calc(100vh-4rem)] max-w-lg mx-auto flex flex-col">
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
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-lg mx-auto">
      {/* Tab bar */}
      <div className="flex gap-1 p-4 pb-2 shrink-0">
        {([
          { key: 'routines' as Tab, label: 'Routines' },
          { key: 'hitit' as Tab, label: 'Hit It' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-200 ${
              tab === key
                ? 'bg-primary text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)]'
                : 'text-muted hover:text-white hover:bg-card-hover'
            }`}
          >
            {label}
            {key === 'hitit' && hitItQueue.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-black">
                {hitItQueue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Routines Tab — full-width list */}
      {tab === 'routines' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 scrollbar-hide">
          {routineGroups.length === 0 ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Card className="text-center">
                <p className="text-muted text-sm font-medium">
                  No routines yet. Chat with your coach to generate one!
                </p>
              </Card>
            </div>
          ) : (
            routineGroups.map(([key, group]) => (
              <RoutineCard
                key={key}
                name={key}
                workouts={group}
                onClick={() => setSelectedRoutine(key)}
                onSendToHitIt={() => addToHitIt(key)}
                isInHitIt={hitItQueue.includes(key)}
              />
            ))
          )}
        </div>
      )}

      {/* Hit It Tab */}
      {tab === 'hitit' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 scrollbar-hide">
          {hitItQueue.length === 0 && finishedWorkouts.length === 0 ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="text-center px-6">
                <p className="text-2xl font-black text-slate-600 tracking-wide uppercase">
                  Queue Empty
                </p>
                <p className="text-sm text-muted mt-2 font-medium">
                  Go to Routines and tap &quot;Hit It&quot; to queue a workout
                </p>
              </div>
            </div>
          ) : (
            <>
              {hitItQueue.map((name) => {
                const group = routineGroups.find(([k]) => k === name)?.[1];
                if (!group) return null;
                return (
                  <ActiveWorkout
                    key={name}
                    routineName={name}
                    workouts={group}
                    onFinish={handleFinish}
                    onRemove={removeFromHitIt}
                  />
                );
              })}

              {finishedWorkouts.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] text-muted uppercase tracking-[0.15em] font-bold mb-3 px-1">
                    Completed This Session
                  </p>
                  {finishedWorkouts.map((fw, i) => (
                    <FinishedWorkoutCard key={i} fw={fw} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
