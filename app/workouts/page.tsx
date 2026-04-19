'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useFitClaude } from '@/context/FitClaudeContext';
import { Modal } from '@/components/ui/Modal';
import type { Workout, WorkoutExercise, Exercise, Activity, WorkoutCollection } from '@/types';
import SetRow, { type WeightUnit, lbToKg } from '@/components/workout/SetRow';
import FocusedExerciseView from '@/components/workout/FocusedExerciseView';
import MuscleGroupPicker from '@/components/workout/MuscleGroupPicker';
import { groupExercises } from '@/lib/workout-utils';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatWeight(lbs: number, unit: 'lb' | 'kg'): string {
  if (unit === 'kg') return `${lbToKg(lbs)}kg`;
  return `${lbs}lb`;
}

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

// ─── CreateCollectionForm ────────────────────────────────────────────────────

const COLLECTION_EMOJIS = ['🔥', '💪', '🏋️', '⚡', '🎯', '🚀', '💎', '🌟', '🏆', '🦾', '🧠', '❤️'];
const COLLECTION_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function CreateCollectionForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: { name: string; emoji: string | null; color: string | null };
  onSubmit: (name: string, emoji?: string, color?: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '');
  const [color, setColor] = useState(initial?.color || '');

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 font-medium block mb-1.5">Name</label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alpha Fit"
          className="w-full px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 font-medium block mb-1.5">Icon</label>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(emoji === e ? '' : e)}
              className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                emoji === e ? 'bg-slate-700 ring-2 ring-primary' : 'bg-slate-800/40 hover:bg-slate-700/60'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 font-medium block mb-1.5">Color</label>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTION_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(color === c ? '' : c)}
              className={`w-8 h-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
          >
            Delete
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { if (name.trim()) onSubmit(name.trim(), emoji || undefined, color || undefined); }}
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {initial ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
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
  onAddToCollection,
}: {
  name: string;
  workouts: Workout[];
  onClick: () => void;
  onAddToCollection?: (routineName: string) => void;
}) {
  const latest = workouts[0];
  const typeColor = TYPE_COLORS[latest.workoutType] ?? 'default';
  const muscles = uniqueMuscles(latest);
  const routineNum = getRoutineDisplayId(workouts);
  const isLifting = (latest.category || 'lifting') === 'lifting';
  const isProgramLinked = workouts.some((w) => w.programDayId != null);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left px-4 py-3 rounded-xl glass hover:bg-slate-800/60 hover:border-slate-600 transition-all duration-200"
      >
        {/* Row 1: #N + name + badge */}
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
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${CATEGORY_COLORS[latest.category!] || 'bg-slate-700/30 text-slate-400 border-slate-600'}`}>
                {latest.category}
              </span>
            )}
            {latest.source === 'manual' && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
                ext
              </span>
            )}
          </div>
        </div>

        {/* Row 2: muscles */}
        {isLifting && muscles.length > 0 && (
          <div className="flex items-center gap-2 mt-1 ml-0.5">
            <span className="text-xs text-slate-500/80 uppercase tracking-wider truncate">
              {muscles.slice(0, 2).join(' · ')}
              {muscles.length > 2 && ` +${muscles.length - 2}`}
            </span>
          </div>
        )}
      </button>

      {/* Right-side action: program link (if linked) OR collection folder */}
      {isProgramLinked ? (
        <Link
          href="/program"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-800/60"
          title="Linked to training program"
        >
          <svg className="w-[18px] h-[18px] text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </Link>
      ) : onAddToCollection ? (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCollection(name); }}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-800/60"
        >
          <svg className="w-[18px] h-[18px] text-slate-600 hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
      ) : null}
    </div>
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
  weightUnit = 'lb',
}: {
  workout: Workout;
  onDeleteLogs: (workoutId: string) => void;
  onEditLog: (workoutId: string, exerciseId: string, logs: SetLog[]) => void;
  onDeleteSession: (workoutId: string) => void;
  canDeleteSession?: boolean;
  weightUnit?: 'lb' | 'kg';
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
                <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Done
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {workout.durationMinutes && (
                <span className="text-xs text-muted font-medium tabular-nums">
                  {workout.durationMinutes} min
                </span>
              )}
              {hasLogs && (
                <span className="text-xs text-slate-500 font-medium">
                  {loggedExercises.length} logged
                </span>
              )}
              {!hasLogs && (
                <span className="text-xs text-slate-600 font-medium italic">
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

        {/* Trash button — direct delete with inline confirm */}
        {canDeleteSession && (
          <div className="pr-2 shrink-0">
            {confirmDeleteSession ? (
              <div className="flex items-center gap-1.5 pr-1">
                <button
                  onClick={() => { onDeleteSession(workout.id); setConfirmDeleteSession(false); }}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDeleteSession(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteSession(true)}
                className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800"
                aria-label="Delete session"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
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
                    <span className={`text-xs font-bold w-5 shrink-0 tabular-nums ${hasExLogs ? 'text-primary' : 'text-slate-600'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`text-xs font-medium truncate ${hasExLogs ? 'text-white' : 'text-slate-400'}`}>
                      {getExerciseName(ex)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted tabular-nums font-medium">
                      {ex.sets}x{ex.reps ?? '?'}
                    </span>
                    {hasExLogs && !isEditing && (
                      <button
                        onClick={() => startEdit(ex)}
                        className="text-slate-600 hover:text-slate-400 active:text-slate-300 transition-colors p-2 -m-1 rounded-md"
                        title="Edit logs"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                        unit={weightUnit}
                      />
                    ))}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => submitEdit(ex.id)}
                        className="px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-bold shrink-0"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingExId(null); setEditLogs([]); }}
                        className="px-3 py-1.5 bg-slate-700 rounded-lg text-slate-300 text-xs font-bold shrink-0"
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
                        className="text-xs tabular-nums bg-primary/10 text-primary/80 px-1.5 py-0.5 rounded font-medium"
                      >
                        S{l.set} {formatWeight(l.weight, weightUnit)} × {l.reps}
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
                  <p className="text-xs text-muted uppercase tracking-widest">Volume</p>
                  <p className="text-sm font-black text-white tabular-nums">
                    {(() => {
                      const volLb = loggedExercises.reduce((acc, ex) => {
                        const logs = parseStoredSetLogs(ex.setLogs);
                        return acc + logs.reduce((s, l) => s + l.weight * l.reps, 0);
                      }, 0);
                      return weightUnit === 'kg'
                        ? `${Math.round(volLb / 2.20462).toLocaleString()} kg`
                        : `${volLb.toLocaleString()} lb`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Sets</p>
                  <p className="text-sm font-black text-white tabular-nums">
                    {loggedExercises.reduce((acc, ex) => acc + parseStoredSetLogs(ex.setLogs).length, 0)}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  {!confirmClearLogs ? (
                    <button
                      onClick={() => setConfirmClearLogs(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-xs font-bold transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear Logs
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-400 font-medium">Clear all?</span>
                      <button
                        onClick={() => {
                          onDeleteLogs(workout.id);
                          setConfirmClearLogs(false);
                        }}
                        className="px-3 py-2 rounded-md bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 active:scale-[0.95] transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmClearLogs(false)}
                        className="px-3 py-2 rounded-md bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 active:scale-[0.95] transition-colors"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>
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

// ─── find personal record (heaviest weight) for an exercise ─────────────────

function getPRForExercise(
  workouts: Workout[],
  exerciseName: string,
): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (getExerciseName(ex) !== exerciseName) continue;
      const logs = parseStoredSetLogs(ex.setLogs);
      for (const l of logs) {
        if (l.weight > 0 && (!best || l.weight > best.weight || (l.weight === best.weight && l.reps > best.reps))) {
          best = { weight: l.weight, reps: l.reps };
        }
      }
    }
  }
  return best;
}

// ─── RoutineExerciseRow (expandable exercise in routine detail) ──────────────

function RoutineExerciseRow({
  ex,
  globalIndex,
  tip,
  lastLog,
  pr,
  onSwap,
  onUpdate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  weightUnit = 'lb',
  supersetLabel,
}: {
  ex: WorkoutExercise;
  globalIndex: number;
  tip: string | null;
  lastLog: SetLog[] | null;
  pr: { weight: number; reps: number } | null;
  onSwap: () => void;
  onUpdate: (updates: { sets?: number; reps?: string; restSeconds?: number }) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  weightUnit?: 'lb' | 'kg';
  supersetLabel?: string | null;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSets, setEditSets] = useState(ex.sets);
  const [editReps, setEditReps] = useState(ex.reps ?? '');
  const firstVideo = ex.exercise?.videos?.[0] ?? null;
  const videoId = firstVideo?.youtubeVideoId ?? null;
  const videoPending = firstVideo?.status === 'pending';
  const gifUrl = ex.exercise?.gifUrl ?? null;
  const setsInputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditSets(ex.sets);
    setEditReps(ex.reps ?? '');
    setEditing(true);
    setTimeout(() => setsInputRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    const updates: { sets?: number; reps?: string } = {};
    if (editSets !== ex.sets) updates.sets = editSets;
    if (editReps !== (ex.reps ?? '')) updates.reps = editReps;
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
          <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
            <span className="text-xs text-slate-500 font-bold tabular-nums leading-none">
              {String(globalIndex).padStart(2, '0')}
            </span>
            {(onMoveUp || onMoveDown) && (
              <div className="flex flex-col -space-y-1">
                {onMoveUp && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                    disabled={!canMoveUp}
                    className="p-0.5 rounded transition-colors text-slate-600 hover:text-emerald-400 disabled:opacity-20 disabled:hover:text-slate-600"
                    title="Move up"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                )}
                {onMoveDown && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                    disabled={!canMoveDown}
                    className="p-0.5 rounded transition-colors text-slate-600 hover:text-emerald-400 disabled:opacity-20 disabled:hover:text-slate-600"
                    title="Move down"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-white font-semibold truncate flex-1 min-w-0">
                {getExerciseName(ex)}
                {ex.wasSpicy && <span className="ml-1">🌶️</span>}
                {supersetLabel && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-black bg-amber-400/15 text-amber-300">
                    {supersetLabel}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-0.5 shrink-0">
                {videoId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowVideo((v) => !v); setShowGif(false); }}
                    className={`shrink-0 p-1.5 rounded transition-colors relative ${
                      videoPending
                        ? showVideo ? 'text-amber-400' : 'text-amber-400/50 hover:text-amber-400'
                        : showVideo ? 'text-red-400' : 'text-red-400/40 hover:text-red-400'
                    }`}
                    title={videoPending ? 'Video pending approval' : 'Watch tutorial'}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    {videoPending && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </button>
                )}
                {gifUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowGif((v) => !v); setShowVideo(false); }}
                    className={`shrink-0 p-1.5 rounded transition-colors ${
                      showGif ? 'text-cyan-400' : 'text-cyan-400/40 hover:text-cyan-400'
                    }`}
                    title="View form demo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onSwap}
                  className="shrink-0 p-1.5 rounded transition-colors text-slate-600 hover:text-amber-400"
                  title="Swap exercise"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>
            </div>
            {tip && (
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed italic">
                {tip}
              </p>
            )}
            {lastLog && (
              <p className="text-xs text-slate-300 font-medium mt-0.5 tabular-nums">
                <span className="text-slate-400">Last:</span> {lastLog.map((l) => `${formatWeight(l.weight, weightUnit)}×${l.reps}`).join('  ')}
              </p>
            )}
            {pr && (
              <p className="text-xs font-bold mt-0.5 tabular-nums">
                <span className="text-amber-400">PR:</span> <span className="text-amber-300">{formatWeight(pr.weight, weightUnit)}×{pr.reps}</span>
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
              <div className="flex gap-1.5 mt-0.5">
                <button onClick={saveEdit} className="text-xs text-emerald-400 font-medium hover:text-emerald-300">Save</button>
                <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-400">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={startEdit} className="text-right group" title="Tap to edit sets & reps">
              <p className="text-sm text-primary font-bold tabular-nums group-hover:text-emerald-300 transition-colors">
                {ex.sets} x {ex.reps ?? '?'}
              </p>
              {ex.weightKg != null && (
                <p className="text-xs text-muted">{ex.weightKg} kg</p>
              )}
            </button>
          )}
        </div>
      </div>
      {showVideo && videoId && (
        <div className="ml-7 mt-2">
          <div className="relative aspect-video max-h-[50vh] landscape:max-h-[70vh] rounded-lg overflow-hidden bg-slate-900">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?mute=1&cc_load_policy=1&cc_lang_pref=en`}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              loading="lazy"
            />
            {videoPending && (
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-400/90 text-black text-xs font-bold uppercase tracking-wider">
                Pending
              </div>
            )}
          </div>
        </div>
      )}
      {showGif && gifUrl && (
        <div className="ml-7 mt-2">
          <div className="rounded-lg overflow-hidden bg-slate-900">
            <img
              src={gifUrl}
              alt={`${getExerciseName(ex)} form`}
              className="w-full max-w-[280px]"
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
  defaultMuscle,
  title = 'Swap Exercise',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  currentExerciseName: string;
  defaultMuscle?: string | null;
  title?: string;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // AI photo identification state
  const [identifying, setIdentifying] = useState(false);
  const [aiMatches, setAiMatches] = useState<{id: string; name: string; muscleGroup: string; confidence: string}[] | null>(null);
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSearch('');
    setMuscleFilter(defaultMuscle ?? null);
    setIdentifying(false);
    setAiMatches(null);
    setAiLabel(null);
    setAiError(null);
    fetch('/api/exercises')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Exercise[]) => {
        setExercises(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  // Resize image on client to keep payload small (~200KB)
  const resizeImage = useCallback((file: File): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          let { width, height } = img;
          const maxWidth = 1024;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          resolve({ base64, mediaType: 'image/jpeg' });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleCameraCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be re-selected
    e.target.value = '';

    setIdentifying(true);
    setAiError(null);
    setAiMatches(null);
    setAiLabel(null);

    try {
      const { base64, mediaType } = await resizeImage(file);

      const res = await fetch('/api/exercises/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, image_media_type: mediaType }),
      });

      if (!res.ok) throw new Error('Failed to identify');

      const data = await res.json();

      if (data.error) {
        setAiError(data.error);
      } else {
        setAiLabel(data.raw_identification);
        setAiMatches(data.matches);
        // Auto-filter to the best match
        if (data.matches.length > 0) {
          const bestMatch = data.matches[0];
          setSearch(bestMatch.name.split(' ').slice(0, 2).join(' '));
          setMuscleFilter(bestMatch.muscleGroup);
        }
      }
    } catch {
      setAiError('Could not identify the machine. Try searching manually.');
    } finally {
      setIdentifying(false);
    }
  }, [resizeImage]);

  const muscleGroups = useMemo(() => {
    const groups = new Set<string>();
    exercises.forEach((e) => groups.add(e.muscleGroup));
    return Array.from(groups).sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    let result = exercises.filter((e) => {
      if (e.name === currentExerciseName) return false;
      if (muscleFilter && e.muscleGroup !== muscleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
      }
      return true;
    });

    // Sort AI matches to the top
    if (aiMatches && aiMatches.length > 0) {
      const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      result.sort((a, b) => {
        const aMatch = aiMatches.find(m => m.id === a.id);
        const bMatch = aiMatches.find(m => m.id === b.id);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        if (aMatch && bMatch) return (confidenceOrder[aMatch.confidence] ?? 3) - (confidenceOrder[bMatch.confidence] ?? 3);
        return 0;
      });
    }

    return result;
  }, [exercises, search, muscleFilter, currentExerciseName, aiMatches]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        {/* Search + Camera */}
        <div className="flex gap-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setAiMatches(null); setAiLabel(null); }}
            placeholder="Search exercises..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraCapture}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={identifying}
            className={`px-3 py-2 rounded-lg border transition-colors shrink-0 ${
              identifying
                ? 'bg-primary/20 border-primary/30 text-primary animate-pulse'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
            title="Take photo of machine"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* AI identification result */}
        {identifying && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-xs text-primary font-medium">Identifying machine...</p>
          </div>
        )}
        {aiLabel && !identifying && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-primary font-medium truncate">Found: {aiLabel}</p>
            </div>
            <button
              onClick={() => { setAiLabel(null); setAiMatches(null); setSearch(''); setMuscleFilter(null); }}
              className="text-primary/60 hover:text-primary text-xs font-bold shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}
        {aiError && !identifying && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400 font-medium">{aiError}</p>
            <button
              onClick={() => setAiError(null)}
              className="text-red-400/60 hover:text-red-400 text-xs font-bold shrink-0 ml-auto"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Muscle group chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setMuscleFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              !muscleFilter ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            All
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
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
            filtered.map((ex) => {
              const aiMatch = aiMatches?.find(m => m.id === ex.id);
              return (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex)}
                  className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-colors group ${
                    aiMatch?.confidence === 'high'
                      ? 'bg-primary/10 border border-primary/20 hover:bg-primary/15'
                      : aiMatch
                      ? 'bg-slate-800/50 hover:bg-slate-800'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white font-medium group-hover:text-primary transition-colors truncate">
                        {ex.name}
                      </p>
                      {aiMatch && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                          aiMatch.confidence === 'high' ? 'bg-primary/20 text-primary' :
                          aiMatch.confidence === 'medium' ? 'bg-amber-400/20 text-amber-400' :
                          'bg-slate-600/20 text-slate-400'
                        }`}>
                          {aiMatch.confidence === 'high' ? 'Best match' : aiMatch.confidence === 'medium' ? 'Similar' : 'Related'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{ex.muscleGroup} · {ex.difficulty} · {ex.exerciseType}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-primary shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              );
            })
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
  onPause,
  onRename,
  onDelete,
  onDeleteLogs,
  onEditLog,
  onDeleteSession,
  onSwapExercise,
  onAddExercise,
  onUpdateExercise,
  onReorderExercises,
  onSpin,
  weightUnit = 'lb',
}: {
  workouts: Workout[];
  onBack: () => void;
  onHitIt: () => void;
  isInHitIt: boolean;
  onPause?: () => void;
  onRename: (workoutIds: string[], newName: string) => void;
  onDelete: (workoutIds: string[]) => void;
  onDeleteLogs: (workoutId: string) => void;
  onEditLog: (workoutId: string, exerciseId: string, logs: SetLog[]) => void;
  onDeleteSession: (workoutId: string) => void;
  onSwapExercise: (workoutId: string, workoutExerciseId: string, newExerciseId: string) => Promise<void>;
  onAddExercise: (workoutId: string, exerciseId: string) => Promise<void>;
  onUpdateExercise: (workoutId: string, workoutExerciseId: string, updates: { sets?: number; reps?: string; restSeconds?: number }) => Promise<void>;
  onReorderExercises: (workoutId: string, orderedIds: string[]) => Promise<void>;
  onSpin: () => void;
  weightUnit?: 'lb' | 'kg';
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swappingExercise, setSwappingExercise] = useState<WorkoutExercise | null>(null);
  const [swapMenuExercise, setSwapMenuExercise] = useState<WorkoutExercise | null>(null);
  const [aiSwapping, setAiSwapping] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const latest = workouts[0];
  const muscles = uniqueMuscles(latest);
  const totalSets = latest.exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const exerciseGroups = useMemo(() => groupExercises(latest.exercises), [latest.exercises]);
  const totalExercises = exerciseGroups.length;
  const routineNum = getRoutineDisplayId(workouts);

  // Sorted list of exercises by current order — used to figure out neighbors for up/down
  const orderedExercises = useMemo(
    () => [...latest.exercises].sort((a, b) => a.order - b.order),
    [latest.exercises]
  );

  const moveExercise = (exerciseId: string, direction: 'up' | 'down') => {
    const ids = orderedExercises.map((e) => e.id);
    const idx = ids.indexOf(exerciseId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ids.length) return;
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    onReorderExercises(latest.id, ids);
  };

  const isFirst = (exerciseId: string) => orderedExercises[0]?.id === exerciseId;
  const isLast = (exerciseId: string) => orderedExercises[orderedExercises.length - 1]?.id === exerciseId;

  // Build a map from exercise ID → superset label (e.g., "A1", "A2")
  const supersetLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    let groupLetterIdx = 0;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const group of exerciseGroups) {
      if (group.supersetGroup && group.exercises.length > 1) {
        const letter = letters[groupLetterIdx % letters.length];
        group.exercises.forEach((ex, ei) => {
          map.set(ex.id, `${letter}${ei + 1}`);
        });
        groupLetterIdx++;
      }
    }
    return map;
  }, [exerciseGroups]);

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

  const handleAiSwap = async (ex: WorkoutExercise) => {
    setSwapMenuExercise(null);
    setAiSwapping(true);
    try {
      const res = await fetch(`/api/workouts/${latest.id}/exercises/${ex.id}/suggest`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'No alternatives found');
        return;
      }
      const suggestion = await res.json();
      await onSwapExercise(latest.id, ex.id, suggestion.id);
    } catch {
      alert('Failed to get suggestion');
    } finally {
      setAiSwapping(false);
    }
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
                        onClick={() => { setMenuOpen(false); onSpin(); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 hover:text-amber-300 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Swap / Regenerate
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
        <div className={`grid ${latest.durationMinutes ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mt-3`}>
          <div className="text-center">
            <p className="text-lg font-black text-white">{totalExercises}</p>
            <p className="text-xs text-muted uppercase tracking-widest">Exercises</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-white">{totalSets}</p>
            <p className="text-xs text-muted uppercase tracking-widest">Sets</p>
          </div>
          {latest.durationMinutes && (
            <div className="text-center">
              <p className="text-lg font-black text-white">{latest.durationMinutes}</p>
              <p className="text-xs text-muted uppercase tracking-widest">Min</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-lg font-black text-white">{workouts.length}</p>
            <p className="text-xs text-muted uppercase tracking-widest">Sessions</p>
          </div>
        </div>

        {muscles.length > 0 && (latest.category || 'lifting') === 'lifting' && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {muscles.map((m) => muscleChip(m))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex gap-2 px-4 py-2 shrink-0">
        <button
          onClick={onSpin}
          className="py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Swap
        </button>
        {isInHitIt && onPause ? (
          <button
            onClick={onPause}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-200 bg-amber-500/90 text-white shadow-[0_2px_12px_rgba(245,158,11,0.3)] hover:bg-amber-600 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </svg>
            Pause
          </button>
        ) : (
          <button
            onClick={onHitIt}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold tracking-wide uppercase transition-all duration-200 bg-primary text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.4)]"
          >
            Hit It
          </button>
        )}
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
                  pr={getPRForExercise(workouts, getExerciseName(ex))}
                  onSwap={() => setSwapMenuExercise(ex)}
                  onUpdate={(updates) => onUpdateExercise(latest.id, ex.id, updates)}
                  onMoveUp={() => moveExercise(ex.id, 'up')}
                  onMoveDown={() => moveExercise(ex.id, 'down')}
                  canMoveUp={!isFirst(ex.id)}
                  canMoveDown={!isLast(ex.id)}
                  weightUnit={weightUnit}
                  supersetLabel={supersetLabelMap.get(ex.id)}
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
                      pr={getPRForExercise(workouts, getExerciseName(ex))}
                      onSwap={() => setSwapMenuExercise(ex)}
                      onUpdate={(updates) => onUpdateExercise(latest.id, ex.id, updates)}
                      onMoveUp={() => moveExercise(ex.id, 'up')}
                      onMoveDown={() => moveExercise(ex.id, 'down')}
                      canMoveUp={!isFirst(ex.id)}
                      canMoveDown={!isLast(ex.id)}
                      weightUnit={weightUnit}
                      supersetLabel={supersetLabelMap.get(ex.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Tips */}
          {latest.notes && (
            <div>
              <p className="text-xs text-muted uppercase tracking-[0.15em] font-bold mb-2">
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

      {/* Swap Method Action Sheet */}
      {swapMenuExercise && !aiSwapping && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setSwapMenuExercise(null)} />
          <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 w-[280px] shadow-2xl">
            <p className="text-xs text-muted uppercase tracking-[0.15em] font-bold mb-3 text-center">
              Swap {getExerciseName(swapMenuExercise)}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const ex = swapMenuExercise;
                  setSwapMenuExercise(null);
                  setSwappingExercise(ex);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-white">Pick manually</p>
                  <p className="text-xs text-muted">Browse exercises</p>
                </div>
              </button>
              <button
                onClick={() => handleAiSwap(swapMenuExercise)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-primary">Regenerate</p>
                  <p className="text-xs text-muted">New exercise, same muscle</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* AI Swap Loading Overlay */}
      {aiSwapping && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-white">Finding a new exercise...</p>
          </div>
        </>
      )}

      {/* Swap Exercise Modal */}
      <SwapExerciseModal
        isOpen={!!swappingExercise}
        onClose={() => setSwappingExercise(null)}
        currentExerciseName={swappingExercise ? getExerciseName(swappingExercise) : ''}
        defaultMuscle={swappingExercise?.exercise?.muscleGroup ?? null}
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


function formatSetLog(log: SetLog, unit: 'lb' | 'kg' = 'lb'): string {
  return `${formatWeight(log.weight, unit)} × ${log.reps}`;
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
  defaultUnit = 'lb',
}: {
  ex: WorkoutExercise;
  index: number;
  isRunning: boolean;
  logs: SetLog[];
  onUpdateLogs: (logs: SetLog[], restSeconds?: number) => void;
  lastLogs?: SetLog[] | null;
  onSwap?: () => void;
  defaultUnit?: 'lb' | 'kg';
}) {
  const [expanded, setExpanded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const isBarbell = (ex.exercise?.equipmentRequired?.toLowerCase().includes('barbell') ?? false)
    || getExerciseName(ex).toLowerCase().includes('barbell');
  const [plateMode, setPlateMode] = useState(isBarbell);
  const [barWeight, setBarWeight] = useState(45);
  const [unit, setUnit] = useState<WeightUnit>(defaultUnit);
  const hasLogs = logs.length > 0;

  const firstVid = ex.exercise?.videos?.[0] ?? null;
  const videoId = firstVid?.youtubeVideoId ?? null;
  const vidPending = firstVid?.status === 'pending';
  const numSets = ex.sets || 3;

  // Parse prescribed reps (e.g. "8-10" → 8, "12" → 12)
  const repNums = (ex.reps ?? '').match(/\d+/g);
  const prescribedReps = repNums ? parseInt(repNums[repNums.length - 1]) : 0;

  // Get default weight/reps for a given set number
  // No cross-set carry-forward — only use existing log or last session data
  const getDefaults = (setNum: number) => {
    const existing = logs.find((l) => l.set === setNum);
    if (existing) return { weight: existing.weight, reps: existing.reps };

    if (lastLogs) {
      const lastForSet = lastLogs.find((l) => l.set === setNum) ?? lastLogs[lastLogs.length - 1];
      if (lastForSet) return { weight: lastForSet.weight, reps: lastForSet.reps };
    }

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
          <span className={`text-xs font-bold w-5 shrink-0 tabular-nums ${hasLogs ? 'text-primary' : 'text-slate-600'}`}>
            {hasLogs ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
            <span className="relative shrink-0">
              <svg className={`w-3 h-3 ${vidPending ? 'text-amber-400/50' : 'text-red-400/60'} shrink-0`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              {vidPending && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </span>
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
            <span key={l.set} className="text-xs tabular-nums bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
              S{l.set} {formatSetLog(l, defaultUnit)}
            </span>
          ))}
        </div>
      )}

      {/* Per-set logging UI */}
      {expanded && isRunning && (
        <div className="mt-1.5 ml-3 space-y-0.5">
          {/* Exercise-level toolbar: unit toggle + per-side */}
          <div className="flex items-center gap-2 mb-1 pb-1 border-b border-slate-800/40 flex-wrap">
            {/* Unit toggle */}
            <button
              type="button"
              onClick={() => setUnit(unit === 'lb' ? 'kg' : 'lb')}
              className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors p-1 rounded ${
                unit === 'kg'
                  ? 'text-blue-400'
                  : 'text-slate-500 hover:text-blue-400'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {unit === 'lb' ? 'lb' : 'kg'}
            </button>

            {/* Per-Side toggle — for barbell exercises */}
            {isBarbell && (
              <>
                <span className="text-slate-800">|</span>
                <button
                  type="button"
                  onClick={() => setPlateMode(!plateMode)}
                  className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors p-1 rounded ${
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
                    <span className="text-xs text-slate-600">bar:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={barWeight}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setBarWeight(Math.max(0, Math.min(100, v)));
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-8 h-5 text-center bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 tabular-nums font-medium focus:outline-none focus:ring-1 focus:ring-amber-400/50 focus:text-white"
                    />
                    <span className="text-xs text-slate-600">{unit}</span>
                  </div>
                )}
              </>
            )}
          </div>

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

          {/* Fill remaining button */}
          {logs.length > 0 && logs.length < numSets && (
            <button
              onClick={handleFillRemaining}
              className="w-full py-1.5 mt-1 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 active:scale-[0.98] transition-colors truncate"
            >
              Fill ({formatWeight(logs[logs.length - 1].weight, unit)} &times; {logs[logs.length - 1].reps})
            </button>
          )}

          {/* Action row: swap + shorthand */}
          <div className="flex items-center gap-2 pt-1">
            {onSwap && (
              <button
                onClick={(e) => { e.stopPropagation(); onSwap(); }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-amber-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              vidPending
                ? showVideo ? 'text-amber-400' : 'text-amber-400/60 hover:text-amber-400'
                : showVideo ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            {showVideo ? 'Hide video' : vidPending ? 'Watch form (pending)' : 'Watch form'}
          </button>
          {showVideo && (
            <div className="relative aspect-video max-h-[50vh] landscape:max-h-[70vh] rounded-lg overflow-hidden bg-slate-900 mt-1.5">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?mute=1&cc_load_policy=1&cc_lang_pref=en`}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                loading="lazy"
              />
              {vidPending && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-400/90 text-black text-xs font-bold uppercase tracking-wider">
                  Pending
                </div>
              )}
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
  weightUnit = 'lb',
  registerPause,
}: {
  routineName: string;
  workouts: Workout[];
  allWorkouts: Workout[];
  onFinish: (routineName: string, elapsed: number, exerciseLogs: Map<string, SetLog[]>) => void;
  onRemove: (routineName: string) => void;
  onSwapExercise?: (workoutId: string, workoutExerciseId: string) => void;
  weightUnit?: 'lb' | 'kg';
  registerPause?: (fn: () => void) => void;
}) {
  const latest = workouts[0];
  const muscles = uniqueMuscles(latest);
  const INACTIVITY_LIMIT = 20 * 60; // 20 minutes with no set logged
  const HARD_CAP = 90 * 60; // 90 minutes max

  // ─── Session persistence helpers ───
  const sessionKey = `fitclaude:session:${routineName}`;

  const saveSession = useCallback((fields: {
    startTime: number | null;
    pausedAt: number;
    running: boolean;
    paused: boolean;
    lastActivity: number;
    logs?: Map<string, SetLog[]>;
  }) => {
    try {
      const logsObj: Record<string, SetLog[]> = {};
      const logsMap = fields.logs ?? exerciseLogsRef.current;
      logsMap.forEach((v, k) => { logsObj[k] = v; });
      localStorage.setItem(sessionKey, JSON.stringify({
        startTime: fields.startTime,
        pausedAt: fields.pausedAt,
        running: fields.running,
        paused: fields.paused,
        lastActivity: fields.lastActivity,
        logs: logsObj,
      }));
    } catch { /* quota exceeded — non-critical */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(sessionKey);
  }, [sessionKey]);

  // Restore session from localStorage on mount
  const restored = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.startTime) return null;
      // Don't restore sessions older than the hard cap (1 hour)
      const age = (Date.now() - s.startTime) / 1000;
      if (age > 3600) { localStorage.removeItem(sessionKey); return null; }
      return s as {
        startTime: number;
        pausedAt: number;
        running: boolean;
        paused: boolean;
        lastActivity: number;
        logs: Record<string, SetLog[]>;
      };
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isRunning, setIsRunning] = useState(restored?.running ?? false);
  const [isPaused, setIsPaused] = useState(restored?.paused ?? false);
  const [elapsed, setElapsed] = useState(() => {
    if (!restored) return 0;
    if (restored.paused) return restored.pausedAt;
    return Math.floor((Date.now() - restored.startTime) / 1000);
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<null | 'success' | 'error'>(null);
  const [autoStopped, setAutoStopped] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'save' | 'discard'>(null);
  const pausedAtRef = useRef<number>(restored?.pausedAt ?? 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(restored?.startTime ?? null);
  const lastActivityRef = useRef<number>(restored?.lastActivity ?? Date.now());

  // Map of exerciseId -> SetLog[]
  const [exerciseLogs, setExerciseLogs] = useState<Map<string, SetLog[]>>(() => {
    if (restored?.logs) {
      const m = new Map<string, SetLog[]>();
      for (const [k, v] of Object.entries(restored.logs)) {
        m.set(k, v as SetLog[]);
      }
      return m;
    }
    return new Map();
  });
  const exerciseLogsRef = useRef(exerciseLogs);
  exerciseLogsRef.current = exerciseLogs;

  const updateLogs = useCallback((exerciseId: string, logs: SetLog[]) => {
    lastActivityRef.current = Date.now();
    setExerciseLogs((prev) => {
      const next = new Map(prev);
      next.set(exerciseId, logs);
      return next;
    });
  }, []);

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
    pausedAtRef.current = 0;
    setAutoStopped(false);
    setIsRunning(true);
    setIsPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  }, [isRunning, tick]);

  // Auto-start workout immediately when added to Hit It (skip pre-start screen)
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current && !isRunning && !isPaused && elapsed === 0) {
      startedRef.current = true;
      start();
    }
  }, [start, isRunning, isPaused, elapsed]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (startTimeRef.current != null) {
      pausedAtRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(pausedAtRef.current);
    }
    setIsRunning(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    const now = Date.now();
    // Adjust startTime so elapsed continues from where we paused
    startTimeRef.current = now - pausedAtRef.current * 1000;
    lastActivityRef.current = now;
    setIsRunning(true);
    setIsPaused(false);
    setConfirmAction(null);
    intervalRef.current = setInterval(tick, 1000);
  }, [tick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (startTimeRef.current != null) {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  // Keep stopRef in sync so tick can call it without stale closure
  stopRef.current = pause;

  // Expose pause to parent so RoutineDetail can trigger it
  useEffect(() => { registerPause?.(pause); }, [registerPause, pause]);

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
    };
  }, [tick]);

  // Restart interval when restoring a running (not paused) session
  useEffect(() => {
    if (restored && restored.running && !restored.paused && startTimeRef.current != null) {
      intervalRef.current = setInterval(tick, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session state whenever timer state or logs change
  useEffect(() => {
    if (startTimeRef.current != null) {
      saveSession({
        startTime: startTimeRef.current,
        pausedAt: pausedAtRef.current,
        running: isRunning,
        paused: isPaused,
        lastActivity: lastActivityRef.current,
        logs: exerciseLogs,
      });
    }
  }, [isRunning, isPaused, exerciseLogs, saveSession]);

  const handleSave = async () => {
    setConfirmAction(null);
    setSaving(true);
    setSaveStatus(null);

    // Use ref to avoid stale closure issues
    const currentLogs = exerciseLogsRef.current;

    // Save logs to API
    const exercisePayload = Array.from(currentLogs.entries())
      .filter(([, logs]) => logs.length > 0)
      .map(([exerciseId, setLogs]) => ({ exerciseId, setLogs }));

    const totalSets = exercisePayload.reduce((s, e) => s + e.setLogs.length, 0);
    console.log(`[save] workoutId=${latest.id}, routine="${routineName}", exercises=${exercisePayload.length}, totalSets=${totalSets}`);
    console.log('[save] exerciseIds:', exercisePayload.map(e => e.exerciseId));
    console.log('[save] Map size:', currentLogs.size, 'entries:', Array.from(currentLogs.keys()));

    if (exercisePayload.length > 0) {
      const requestBody = {
        exercises: exercisePayload,
        durationMinutes: Math.ceil(elapsed / 60),
      };
      console.log('[save] POST body:', JSON.stringify(requestBody).substring(0, 500));

      try {
        const res = await fetch(`/api/workouts/${latest.id}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const responseText = await res.text();
        console.log(`[save] Response status=${res.status}, body=${responseText.substring(0, 300)}`);

        if (!res.ok) {
          console.error(`[save] API error ${res.status}:`, responseText);
          throw new Error(`HTTP ${res.status}`);
        }

        clearSession();
        setSaving(false);
        setSaveStatus('success');
        navigator.vibrate?.(200);
        setTimeout(() => onFinish(routineName, elapsed, currentLogs), 2000);
        return;
      } catch (err) {
        console.error('[save] Failed:', err);
        setSaving(false);
        setSaveStatus('error');
        return;
      }
    }

    console.warn('[save] No exercises to save — exerciseLogs Map was empty, finishing immediately');
    clearSession();
    setSaving(false);
    onFinish(routineName, elapsed, currentLogs);
  };

  const handleDiscard = () => {
    clearSession();
    setConfirmAction(null);
    onRemove(routineName);
  };

  const retrySave = () => {
    setSaveStatus(null);
    handleSave();
  };

  const hitItGroups = useMemo(() => groupExercises(latest.exercises), [latest.exercises]);
  const loggedCount = hitItGroups.filter((g) =>
    g.exercises.some((e) => (exerciseLogs.get(e.id) ?? []).length > 0)
  ).length;
  const totalExercises = hitItGroups.length;

  const isActive = isRunning || isPaused;

  // ─── Active workout: Focused exercise-by-exercise view ───
  if (isActive || elapsed > 0) {
    return (
      <div className="flex flex-col h-full -mx-4 -mt-4">
        {/* Routine name header — PAUSE/RESUME lives here */}
        <div className="px-4 pt-2 pb-2.5 bg-[#111118] space-y-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate text-center">
            {routineName.replace(/_/g, ' ')}
          </h4>
          {isRunning && !saving && !saveStatus && (
            <button
              onClick={pause}
              className="w-full py-2.5 rounded-xl bg-amber-500/90 text-white font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(245,158,11,0.25)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="5" height="16" rx="1" />
                <rect x="14" y="4" width="5" height="16" rx="1" />
              </svg>
              Pause
            </button>
          )}
          {isPaused && !saving && !saveStatus && (
            <button
              onClick={resume}
              className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 hover:bg-primary-dark active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(16,185,129,0.25)]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Resume
            </button>
          )}
        </div>

        {/* Focused exercise view */}
        <div className="flex-1 min-h-0">
          <FocusedExerciseView
            exercises={latest.exercises}
            exerciseLogs={exerciseLogs}
            onUpdateLogs={updateLogs}
            allWorkouts={allWorkouts}
            latestWorkoutId={latest.id}
            onSwapExercise={onSwapExercise ? (exId) => onSwapExercise(latest.id, exId) : undefined}
            weightUnit={weightUnit}
            isRunning={isRunning}
            isPaused={isPaused}
            elapsed={elapsed}
            onFinishWorkout={() => {
              if (isRunning) pause();
              setConfirmAction('save');
            }}
            onSave={() => setConfirmAction('save')}
            onDiscard={() => setConfirmAction('discard')}
          />
        </div>

        {/* Bottom bar — saving state + confirm popup only */}
        <div className="px-4 bg-[#111118] border-t border-slate-800/50 pb-[env(safe-area-inset-bottom)]">
          {autoStopped && isPaused && (
            <p className="text-xs text-amber-400 font-bold text-center uppercase tracking-wider py-2">
              Auto-paused after inactivity
            </p>
          )}

          {/* Saving spinner */}
          {saving && (
            <div className="w-full py-2.5 rounded-lg bg-slate-800 text-slate-400 font-bold text-sm tracking-wide uppercase text-center">
              Saving...
            </div>
          )}

          {/* Confirmation popup */}
          {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-20">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
              <div className="relative w-full max-w-sm glass rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                <div className="p-5 text-center">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                    confirmAction === 'save' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                  }`}>
                    {confirmAction === 'save' ? (
                      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {confirmAction === 'save' ? 'Save Workout?' : 'Discard Workout?'}
                  </h3>
                  <p className="text-sm text-slate-400 mb-5">
                    {confirmAction === 'save'
                      ? `${Array.from(exerciseLogs.values()).reduce((s, l) => s + l.length, 0)} sets logged — save to your history.`
                      : 'All logged sets will be lost.'}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmAction === 'save' ? handleSave : handleDiscard}
                      className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm active:scale-95 transition-transform ${
                        confirmAction === 'save'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {confirmAction === 'save' ? 'Save' : 'Discard'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save feedback banners */}
          {saveStatus === 'success' && (
            <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-center">
              <p className="text-xs font-bold text-emerald-400">
                Workout saved &mdash; {Array.from(exerciseLogs.values()).reduce((s, l) => s + l.length, 0)} sets logged
              </p>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-between">
              <p className="text-xs font-bold text-red-400">Save failed</p>
              <button
                onClick={retrySave}
                className="px-3 py-1 rounded-md bg-red-500/20 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Pre-start: Card view with routine info + Start button ───
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
        <button
          onClick={() => { clearSession(); onRemove(routineName); }}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Timer (pre-start) */}
      <div className="mt-4 flex items-center justify-center">
        <span className="text-3xl font-black tabular-nums tracking-tight text-slate-400">
          {formatTimer(elapsed)}
        </span>
      </div>

      {/* Exercise preview list */}
      <div className="mt-3 space-y-0.5">
        {latest.exercises.map((ex, i) => (
          <ExerciseLogRow
            key={ex.id}
            ex={ex}
            index={i}
            isRunning={false}
            logs={[]}
            onUpdateLogs={() => {}}
            lastLogs={getLastLogForExercise(allWorkouts, getExerciseName(ex), latest.id)}
            onSwap={onSwapExercise ? () => onSwapExercise(latest.id, ex.id) : undefined}
            defaultUnit={weightUnit}
          />
        ))}
      </div>

      {/* Start button */}
      {!saveStatus && (
        <div className="mt-5">
          <button
            onClick={start}
            className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm tracking-wide uppercase transition-all hover:bg-primary-dark active:scale-[0.98]"
          >
            Start Workout
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── FinishedWorkoutCard ──────────────────────────────────────────────────────

function FinishedWorkoutCard({
  fw,
  onDelete,
  weightUnit = 'lb',
}: {
  fw: { name: string; elapsed: number; finishedAt: Date; exerciseLogs: Map<string, SetLog[]>; workout: Workout };
  onDelete: () => void;
  weightUnit?: 'lb' | 'kg';
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white capitalize tracking-wide truncate">
            {fw.name.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-muted mt-0.5">
            Finished at {fw.finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {loggedExercises.length > 0 && (
              <span className="text-slate-500 ml-2">
                {loggedExercises.length} ex &middot; {totalSets} sets
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-black text-primary tabular-nums">
            {formatTimer(fw.elapsed)}
          </span>
          <svg
            className={`w-5 h-5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
                    <span key={j} className="text-xs text-slate-400 tabular-nums">
                      {formatWeight(log.weight, weightUnit)} &times; {log.reps}
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
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

function WorkoutsPageInner() {
  const { chatOpen, dataVersion, sendMessage, setChatOpen, setChatTopic, setCustomBack, profile } = useFitClaude();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Track if the current routine was opened via deep link (e.g. from / or /program)
  const [routineOpenedViaDeepLink, setRoutineOpenedViaDeepLink] = useState(() => {
    if (typeof window !== 'undefined') return !!searchParams.get('routine');
    return false;
  });
  const weightUnit = (profile?.weightUnit === 'kg' ? 'kg' : 'lb') as 'lb' | 'kg';
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const urlTab = searchParams.get('tab');
      if (urlTab === 'hit-it' || urlTab === 'routines' || urlTab === 'history') return urlTab;
      const saved = localStorage.getItem('fitclaude:activeTab');
      if (saved === 'hit-it' || saved === 'routines' || saved === 'history') return saved;
    }
    return 'routines';
  });
  const [selectedRoutine, setSelectedRoutine] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('routine');
    }
    return null;
  });
  const [hitItQueue, setHitItQueue] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('fitclaude:hitItQueue') || '[]');
        return Array.isArray(saved) ? saved : [];
      } catch { return []; }
    }
    return [];
  });
  const [spinTarget, setSpinTarget] = useState<{ name: string; muscles: string[]; exerciseCount: number; category: string; confirm: typeof SPIN_CONFIRMS[number] } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [musclePickerOpen, setMusclePickerOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [routineSearch, setRoutineSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  // If navigated with ?chat=1, auto-open the chat overlay in workout topic
  useEffect(() => {
    if (searchParams.get('chat') === '1') {
      setChatTopic('workout');
      setChatOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [finishedWorkouts, setFinishedWorkouts] = useState<
    { name: string; elapsed: number; finishedAt: Date; exerciseLogs: Map<string, SetLog[]>; workout: Workout }[]
  >([]);
  const [hitItSwapping, setHitItSwapping] = useState<{ workoutId: string; workoutExerciseId: string; exerciseName: string; muscleGroup?: string | null } | null>(null);
  const [hitItSwapMenu, setHitItSwapMenu] = useState<{ workoutId: string; workoutExerciseId: string; exerciseName: string; muscleGroup?: string | null } | null>(null);
  const [hitItAiSwapping, setHitItAiSwapping] = useState(false);
  const [hitItReplaceConfirm, setHitItReplaceConfirm] = useState<string | null>(null); // name of routine trying to start
  const [activities, setActivities] = useState<Activity[]>([]);
  const [collections, setCollections] = useState<WorkoutCollection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(searchParams.get('collection'));
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [assignCollectionRoutine, setAssignCollectionRoutine] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<WorkoutCollection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<WorkoutCollection | null>(null);
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const [spunRoutineName, setSpunRoutineName] = useState<string | null>(null);
  const [sessionTypePrompt, setSessionTypePrompt] = useState<string | null>(null); // routine name pending type selection
  const [condDuration, setCondDuration] = useState('60');
  const prevRoutineNamesRef = useRef<Set<string>>(new Set());
  const hitItPauseRef = useRef<(() => void) | null>(null);

  // Persist Hit It queue and active tab to localStorage
  useEffect(() => {
    localStorage.setItem('fitclaude:hitItQueue', JSON.stringify(hitItQueue));
    // If queue is empty, clear the saved tab so next visit starts on routines
    if (hitItQueue.length === 0 && tab !== 'hit-it') {
      localStorage.removeItem('fitclaude:activeTab');
    }
  }, [hitItQueue, tab]);

  useEffect(() => {
    if (tab === 'hit-it' && hitItQueue.length > 0) {
      localStorage.setItem('fitclaude:activeTab', 'hit-it');
    } else {
      localStorage.removeItem('fitclaude:activeTab');
    }
  }, [tab, hitItQueue]);

  // Override Header back button when routine detail is open
  useEffect(() => {
    if (selectedRoutine) {
      setCustomBack(() => {
        if (routineOpenedViaDeepLink) {
          setRoutineOpenedViaDeepLink(false);
          router.back();
        } else {
          setSelectedRoutine(null);
        }
      });
    } else {
      setCustomBack(null);
    }
    return () => setCustomBack(null);
  }, [selectedRoutine, routineOpenedViaDeepLink, setCustomBack, router]);

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

  const handleDeleteActivity = async (activityId: string) => {
    await fetch(`/api/activities?id=${activityId}`, { method: 'DELETE' });
    fetchActivities();
  };

  const fetchCollections = useCallback(() => {
    fetch('/api/collections')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCollections(Array.isArray(data) ? data : []))
      .catch(() => setCollections([]));
  }, []);

  // Initial load + re-fetch when chat creates/modifies workouts
  useEffect(() => {
    fetchWorkouts();
    fetchActivities();
    fetchCollections();
  }, [fetchWorkouts, fetchActivities, fetchCollections, dataVersion]);

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

  // Transfer collection membership when a spin creates a new routine
  useEffect(() => {
    if (!spunRoutineName || loading || routineGroups.length === 0) return;
    const currentNames = new Set(routineGroups.map(([k]) => k));
    const newNames = [...currentNames].filter((n) => !prevRoutineNamesRef.current.has(n));
    // Update ref for next comparison
    prevRoutineNamesRef.current = currentNames;
    if (newNames.length === 0) return;
    // Find which collections the old routine was in
    const memberCollections = collections.filter((c) => c.routineNames.includes(spunRoutineName));
    if (memberCollections.length === 0) { setSpunRoutineName(null); return; }
    // Add the newest routine to those collections
    const newRoutine = newNames[newNames.length - 1];
    for (const col of memberCollections) {
      if (!col.routineNames.includes(newRoutine)) {
        toggleRoutineInCollection(col.id, newRoutine);
      }
    }
    setSpunRoutineName(null);
  }, [routineGroups, spunRoutineName, loading, collections]);

  // Keep prevRoutineNamesRef in sync when not spinning
  useEffect(() => {
    if (!spunRoutineName) {
      prevRoutineNamesRef.current = new Set(routineGroups.map(([k]) => k));
    }
  }, [routineGroups, spunRoutineName]);

  // Clean up stale Hit It queue entries (routine deleted/renamed while in queue)
  useEffect(() => {
    if (loading || hitItQueue.length === 0 || routineGroups.length === 0) return;
    const validNames = new Set(routineGroups.map(([k]) => k));
    const stale = hitItQueue.filter((name) => !validNames.has(name));
    if (stale.length > 0) {
      setHitItQueue((prev) => prev.filter((n) => validNames.has(n)));
    }
  }, [loading, hitItQueue, routineGroups]);

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
    if (activeCollection) {
      const col = collections.find((c) => c.id === activeCollection);
      if (col) {
        const names = new Set(col.routineNames);
        filtered = filtered.filter(([key]) => names.has(key));
      }
    }
    return filtered;
  }, [routineGroups, categoryFilter, muscleFilter, routineSearch, activeCollection, collections]);

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

  const createCollection = async (name: string, emoji?: string, color?: string) => {
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji: emoji || null, color: color || null }),
      });
      if (!res.ok) return;
      const col = await res.json();
      setCollections((prev) => [...prev, col]);
    } catch (err) {
      console.error('Failed to create collection:', err);
    }
  };

  const deleteCollection = async (id: string, deleteRoutines?: boolean) => {
    const col = collections.find((c) => c.id === id);
    try {
      // Delete routines inside the collection if requested
      if (deleteRoutines && col && col.routineNames.length > 0) {
        for (const name of col.routineNames) {
          const group = routineGroups.find(([k]) => k === name)?.[1];
          if (group) {
            await Promise.all(group.map((w) => fetch(`/api/workouts/${w.id}`, { method: 'DELETE' })));
          }
        }
      }
      await fetch(`/api/collections/${id}`, { method: 'DELETE' });
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (activeCollection === id) setActiveCollection(null);
      if (deleteRoutines) fetchWorkouts();
    } catch (err) {
      console.error('Failed to delete collection:', err);
    }
  };

  const updateCollection = async (id: string, data: { name?: string; emoji?: string; color?: string }) => {
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Failed to update collection:', err);
    }
  };

  const toggleRoutineInCollection = async (collectionId: string, routineName: string) => {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return;
    const isIn = col.routineNames.includes(routineName);
    try {
      if (isIn) {
        await fetch(`/api/collections/${collectionId}/workouts`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routineName }),
        });
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId ? { ...c, routineNames: c.routineNames.filter((n) => n !== routineName) } : c
          )
        );
      } else {
        await fetch(`/api/collections/${collectionId}/workouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routineName }),
        });
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId ? { ...c, routineNames: [...c.routineNames, routineName] } : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle routine in collection:', err);
    }
  };

  const activeFilterCount = (categoryFilter !== 'all' ? 1 : 0) + (muscleFilter ? 1 : 0);

  const selectedGroup = selectedRoutine
    ? routineGroups.find(([k]) => k === selectedRoutine)?.[1] ?? null
    : null;

  const _startHitIt = async (name: string) => {
    // Find the latest workout for this routine and duplicate it for a fresh session
    const group = routineGroups.find(([k]) => k === name)?.[1];
    const latestWorkout = group?.[0];
    if (latestWorkout) {
      try {
        const res = await fetch(`/api/workouts/${latestWorkout.id}/duplicate`, { method: 'POST' });
        if (res.ok) {
          await new Promise<void>((resolve) => {
            fetch('/api/workouts?daysBack=90')
              .then((r) => r.ok ? r.json() : [])
              .then((data) => {
                setWorkouts(Array.isArray(data) ? data : []);
                resolve();
              })
              .catch(() => resolve());
          });
        } else {
          console.error('[hitIt] Failed to duplicate workout:', await res.text().catch(() => ''));
        }
      } catch (err) {
        console.error('[hitIt] Error duplicating workout:', err);
      }
    }
    // Replace queue with only this routine (max 1)
    setHitItQueue([name]);
    setSelectedRoutine(null);
    setTab('hit-it');
  };

  const addToHitIt = async (name: string) => {
    if (hitItQueue.includes(name)) {
      // Already active — just switch to Hit It tab
      setSelectedRoutine(null);
      setTab('hit-it');
      return;
    }

    if (hitItQueue.length > 0) {
      // Another routine is active — ask for confirmation
      setHitItReplaceConfirm(name);
      return;
    }

    // Ask whether this is a lifting session or conditioning class
    setCondDuration('60');
    setSessionTypePrompt(name);
  };

  const removeFromHitIt = (name: string) => {
    setHitItQueue((prev) => prev.filter((n) => n !== name));
  };

  useEffect(() => {
    if (hitItQueue.length === 0 && tab === 'hit-it') {
      setTab('routines');
      router.push('/');
    }
  }, [hitItQueue, tab, router]);

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
      if (next.length === 0) {
        setTab('history');
        router.push('/');
      }
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

  const handleReorderExercises = async (workoutId: string, orderedIds: string[]) => {
    // Optimistic update
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workoutId) return w;
        const byId = new Map(w.exercises.map((e) => [e.id, e]));
        const reordered = orderedIds
          .map((id, i) => {
            const ex = byId.get(id);
            return ex ? { ...ex, order: i + 1 } : null;
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);
        return { ...w, exercises: reordered };
      })
    );
    const res = await fetch(`/api/workouts/${workoutId}/exercises/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      // Revert on failure by refetching
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
    setSpinTarget({ name: routineName, muscles, exerciseCount: groupExercises(latest.exercises).length, category, confirm });
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
    // Remember which collections this routine belongs to so we can add the new one
    const memberCollections = collections.filter((c) => c.routineNames.includes(name));
    if (memberCollections.length > 0) {
      setSpunRoutineName(name);
    }
    setChatTopic('workout');
    setChatOpen(true);
    setSpinTarget(null);
    setSpinning(false);
    await sendMessage(msg);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full max-w-lg mx-auto px-4 pt-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-800/60 h-16 w-full" />
        ))}
      </div>
    );
  }

  // ── Full-screen detail view ──
  if (selectedRoutine && selectedGroup) {
    return (
      <div className="h-full max-w-lg mx-auto flex flex-col">
        <RoutineDetail
          workouts={selectedGroup}
          onBack={() => {
            if (routineOpenedViaDeepLink) {
              // Came from dashboard / program — go back to that page
              setRoutineOpenedViaDeepLink(false);
              router.back();
            } else {
              setSelectedRoutine(null);
            }
          }}
          onHitIt={() => addToHitIt(selectedRoutine)}
          isInHitIt={hitItQueue.includes(selectedRoutine)}
          onPause={hitItQueue.includes(selectedRoutine) ? () => hitItPauseRef.current?.() : undefined}
          onRename={handleRename}
          onDelete={handleDeleteRoutine}
          onDeleteLogs={handleDeleteLogs}
          onEditLog={handleEditLog}
          onDeleteSession={handleDeleteSession}
          onSwapExercise={handleSwapExercise}
          onAddExercise={handleAddExercise}
          onUpdateExercise={handleUpdateExercise}
          onReorderExercises={handleReorderExercises}
          onSpin={() => requestSpin(selectedRoutine!)}
          weightUnit={weightUnit}
        />

        {/* Spin confirmation overlay (must be inside detail view's return) */}
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
              <p className="text-xs text-slate-500 mt-2 text-center">
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

        {/* Hit It replace confirmation */}
        {hitItReplaceConfirm && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setHitItReplaceConfirm(null)} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[320px] w-full shadow-2xl">
              <p className="text-sm font-bold text-white text-center">Workout in progress</p>
              <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed">
                You already have <span className="text-white font-semibold">{hitItQueue[0]?.replace(/_/g, ' ')}</span> active. Stop it and start <span className="text-white font-semibold">{hitItReplaceConfirm.replace(/_/g, ' ')}</span>?
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setHitItReplaceConfirm(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 transition-colors"
                >
                  Keep current
                </button>
                <button
                  onClick={async () => {
                    const name = hitItReplaceConfirm;
                    setHitItReplaceConfirm(null);
                    await _startHitIt(name);
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors"
                >
                  Switch
                </button>
              </div>
            </div>
          </>
        )}
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
          {/* Collection strip */}
          {collections.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
              <button
                onClick={() => setActiveCollection(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                  activeCollection === null
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300'
                }`}
              >
                All
              </button>
              {collections.map((col) => {
                const validNames = routineGroups.map(([k]) => k);
                const count = col.routineNames.filter((n) => validNames.includes(n)).length;
                const isActive = activeCollection === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => {
                      if (longPressFired.current) { longPressFired.current = false; return; }
                      setActiveCollection(isActive ? null : col.id);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); setEditingCollection(col); }}
                    onTouchStart={() => {
                      longPressFired.current = false;
                      longPressTimer.current = setTimeout(() => {
                        longPressFired.current = true;
                        setEditingCollection(col);
                      }, 500);
                    }}
                    onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all border flex items-center gap-1 select-none ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300'
                    }`}
                    style={col.color && isActive ? { borderColor: col.color + '60', backgroundColor: col.color + '20', color: col.color } : undefined}
                  >
                    {col.emoji && <span>{col.emoji}</span>}
                    <span className="truncate max-w-[100px]">{col.name}</span>
                    {count > 0 && <span className="text-slate-500 tabular-nums">{count}</span>}
                  </button>
                );
              })}
              <button
                onClick={() => setCreateCollectionOpen(true)}
                className="shrink-0 w-7 h-7 rounded-full border border-dashed border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-500 flex items-center justify-center transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )}

          {/* Compact toolbar: search + filter toggle */}
          <div className="flex items-center gap-2 px-4 pb-2">
            {searchExpanded ? (
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  autoFocus
                  value={routineSearch}
                  onChange={(e) => setRoutineSearch(e.target.value)}
                  placeholder="Search routines..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-colors"
                />
                <button
                  onClick={() => { setSearchExpanded(false); setRoutineSearch(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSearchExpanded(true)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Search routines"
                >
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                {(activeCategories.size > 1 || activeMuscles.size > 1) && (
                  <button
                    onClick={() => setFilterOpen((v) => !v)}
                    className={`relative p-2 rounded-lg transition-colors ${
                      filterOpen ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Filter routines"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Filter panel */}
          {filterOpen && !searchExpanded && (
            <div className="px-4 pb-3 space-y-2">
              {activeCategories.size > 1 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1.5">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.filter((c) => c === 'all' || activeCategories.has(c)).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setMuscleFilter(null); }}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
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
                </div>
              )}
              {activeMuscles.size > 1 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1.5">Muscle</p>
                  <div className="flex flex-wrap gap-1.5">
                    {MUSCLE_PILL_ORDER.filter((m) => activeMuscles.has(m)).map((muscle) => (
                      <button
                        key={muscle}
                        onClick={() => setMuscleFilter(muscleFilter === muscle ? null : muscle)}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                          muscleFilter === muscle
                            ? (MUSCLE_COLORS[muscle] || 'bg-slate-500/20 text-slate-300') + ' border-transparent'
                            : 'bg-transparent text-slate-500 border-slate-700/50 hover:text-slate-300'
                        }`}
                      >
                        {muscle}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
                {routineGroups.length === 0 && (
                  <button
                    onClick={() => { setChatTopic('workout'); setChatOpen(true); }}
                    className="mt-3 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold tracking-wide uppercase hover:bg-primary-dark transition-colors"
                  >
                    Generate a Routine
                  </button>
                )}
              </Card>
            </div>
          ) : (
            filteredRoutineGroups.map(([key, group]) => (
              <RoutineCard
                key={key}
                name={key}
                workouts={group}
                onClick={() => setSelectedRoutine(key)}
                onAddToCollection={(routineName) => setAssignCollectionRoutine(routineName)}
              />
            ))
          )}
          </div>

          {/* Muscle Picker FAB */}
          <button
            onClick={() => setMusclePickerOpen(true)}
            className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/25 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L12 22M2 12L22 12M7 7L17 17M17 7L7 17" opacity="0.3" />
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
        </div>
      )}

      {/* Hit It Tab — always mounted to preserve workout state */}
      <div className={`flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide ${tab === 'hit-it' ? '' : 'hidden'}`}>
          {hitItQueue.length === 0 ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="text-center px-6">
                <p className="text-2xl font-black text-slate-600 tracking-wide uppercase">
                  No Active Workouts
                </p>
                <p className="text-sm text-muted mt-2 font-medium">
                  Queue a routine to start training
                </p>
                <button
                  onClick={() => setTab('routines')}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-bold tracking-wide uppercase hover:bg-slate-600 transition-colors"
                >
                  Browse Routines
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-1">
              {hitItQueue.map((name, idx) => {
                const group = routineGroups.find(([k]) => k === name)?.[1];
                if (!group) return null;
                return (
                  <ActiveWorkout
                    key={`${name}-${idx}`}
                    routineName={name}
                    workouts={group}
                    allWorkouts={workouts}
                    onFinish={handleFinish}
                    onRemove={removeFromHitIt}
                    onSwapExercise={(workoutId, workoutExerciseId) => {
                      const we = workouts.find((w) => w.id === workoutId)?.exercises?.find((e) => e.id === workoutExerciseId);
                      setHitItSwapMenu({ workoutId, workoutExerciseId, exerciseName: we?.exercise?.name ?? '', muscleGroup: we?.exercise?.muscleGroup ?? null });
                    }}
                    weightUnit={weightUnit}
                    registerPause={(fn) => { hitItPauseRef.current = fn; }}
                  />
                );
              })}
            </div>
          )}
      </div>

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
                  <button
                    onClick={() => setTab('routines')}
                    className="mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white text-xs font-bold tracking-wide uppercase hover:bg-slate-600 transition-colors"
                  >
                    Start a Workout
                  </button>
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
                      weightUnit={weightUnit}
                    />
                  ) : (
                    <div key={item.data.id} className="px-4 py-3 rounded-xl glass">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Activity
                          </span>
                          <p className="font-bold text-white text-sm capitalize">{item.data.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.data.durationMinutes && (
                            <span className="text-xs text-muted tabular-nums">{item.data.durationMinutes} min</span>
                          )}
                          {confirmDeleteActivity !== item.data.id && (
                            <button
                              onClick={() => setConfirmDeleteActivity(item.data.id)}
                              className="p-1.5 text-slate-600 hover:text-red-400 active:text-red-500 transition-colors"
                              aria-label="Delete activity"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(item.data.date)}</p>
                      {item.data.notes && (
                        <p className="text-xs text-slate-400 mt-1">{item.data.notes}</p>
                      )}
                      {confirmDeleteActivity === item.data.id && (
                        <div className="flex items-center justify-end gap-1.5 mt-2">
                          <span className="text-xs text-red-400 font-medium">Delete activity?</span>
                          <button
                            onClick={() => {
                              handleDeleteActivity(item.data.id);
                              setConfirmDeleteActivity(null);
                            }}
                            className="px-3 py-2 rounded-md bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/30 active:scale-[0.95] transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteActivity(null)}
                            className="px-3 py-2 rounded-md bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 active:scale-[0.95] transition-colors"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Hit It Swap Method Action Sheet */}
      {hitItSwapMenu && !hitItAiSwapping && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setHitItSwapMenu(null)} />
          <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 w-[280px] shadow-2xl">
            <p className="text-xs text-muted uppercase tracking-[0.15em] font-bold mb-3 text-center">
              Swap Exercise
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const menu = hitItSwapMenu;
                  setHitItSwapMenu(null);
                  setHitItSwapping(menu);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-white">Pick manually</p>
                  <p className="text-xs text-muted">Browse exercises</p>
                </div>
              </button>
              <button
                onClick={async () => {
                  const menu = hitItSwapMenu;
                  setHitItSwapMenu(null);
                  setHitItAiSwapping(true);
                  try {
                    const res = await fetch(`/api/workouts/${menu.workoutId}/exercises/${menu.workoutExerciseId}/suggest`);
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      alert(err.error || 'No alternatives found');
                      return;
                    }
                    const suggestion = await res.json();
                    await handleSwapExercise(menu.workoutId, menu.workoutExerciseId, suggestion.id);
                  } catch {
                    alert('Failed to get suggestion');
                  } finally {
                    setHitItAiSwapping(false);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors text-left"
              >
                <svg className="w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-primary">Regenerate</p>
                  <p className="text-xs text-muted">New exercise, same muscle</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hit It AI Swap Loading */}
      {hitItAiSwapping && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-white">Finding a new exercise...</p>
          </div>
        </>
      )}

      {/* Swap Exercise Modal for Hit It tab */}
      <SwapExerciseModal
        isOpen={!!hitItSwapping}
        onClose={() => setHitItSwapping(null)}
        currentExerciseName={hitItSwapping?.exerciseName ?? ''}
        defaultMuscle={hitItSwapping?.muscleGroup ?? null}
        onSelect={async (exercise) => {
          if (!hitItSwapping) return;
          await handleSwapExercise(hitItSwapping.workoutId, hitItSwapping.workoutExerciseId, exercise.id);
          setHitItSwapping(null);
        }}
      />

      {/* Muscle Picker Modal */}
      <Modal isOpen={musclePickerOpen} onClose={() => setMusclePickerOpen(false)} title="Build a Workout" size="xl">
        <MuscleGroupPicker
          onGenerate={async (prompt) => {
            setMusclePickerOpen(false);
            setChatTopic('workout');
            setChatOpen(true);
            await sendMessage(prompt);
          }}
          onClose={() => setMusclePickerOpen(false)}
        />
      </Modal>

      {/* Create Collection Modal */}
      <Modal isOpen={createCollectionOpen} onClose={() => setCreateCollectionOpen(false)} title="New Collection" size="sm">
        <CreateCollectionForm
          onSubmit={(name, emoji, color) => {
            createCollection(name, emoji, color);
            setCreateCollectionOpen(false);
          }}
          onCancel={() => setCreateCollectionOpen(false)}
        />
      </Modal>

      {/* Edit Collection Modal */}
      {editingCollection && (
        <Modal isOpen={true} onClose={() => setEditingCollection(null)} title="Edit Collection" size="sm">
          <CreateCollectionForm
            initial={editingCollection}
            onSubmit={(name, emoji, color) => {
              updateCollection(editingCollection.id, { name, emoji, color });
              setEditingCollection(null);
            }}
            onCancel={() => setEditingCollection(null)}
            onDelete={() => {
              setDeletingCollection(editingCollection);
              setEditingCollection(null);
            }}
          />
        </Modal>
      )}

      {/* Delete Collection Confirmation */}
      {deletingCollection && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-20">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingCollection(null)} />
          <div className="relative w-full max-w-sm glass rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            <div className="p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Delete &ldquo;{deletingCollection.emoji ? `${deletingCollection.emoji} ` : ''}{deletingCollection.name}&rdquo;?
              </h3>
              {deletingCollection.routineNames.length > 0 ? (
                <>
                  <p className="text-sm text-slate-400 mb-5">
                    This collection has {deletingCollection.routineNames.length} routine{deletingCollection.routineNames.length !== 1 ? 's' : ''}. Do you also want to delete the routines inside?
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        deleteCollection(deletingCollection.id, true);
                        setDeletingCollection(null);
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm active:scale-95 transition-transform"
                    >
                      Delete Collection & Routines
                    </button>
                    <button
                      onClick={() => {
                        deleteCollection(deletingCollection.id, false);
                        setDeletingCollection(null);
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-amber-500/20 text-amber-400 font-medium text-sm active:scale-95 transition-transform"
                    >
                      Delete Collection Only
                    </button>
                    <button
                      onClick={() => setDeletingCollection(null)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-400 mb-5">
                    This collection is empty. It will be permanently removed.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeletingCollection(null)}
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        deleteCollection(deletingCollection.id);
                        setDeletingCollection(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium text-sm active:scale-95 transition-transform"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Routine to Collection Modal */}
      {assignCollectionRoutine && (
        <Modal isOpen={true} onClose={() => setAssignCollectionRoutine(null)} title="Add to Collection" size="sm">
          <div className="space-y-2">
            {collections.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted mb-3">No collections yet</p>
                <button
                  onClick={() => { setAssignCollectionRoutine(null); setCreateCollectionOpen(true); }}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"
                >
                  Create First Collection
                </button>
              </div>
            ) : (
              <>
                {collections.map((col) => {
                  const isIn = col.routineNames.includes(assignCollectionRoutine);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleRoutineInCollection(col.id, assignCollectionRoutine)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="text-lg">{col.emoji || '📁'}</span>
                      <span className="flex-1 text-left text-sm font-medium text-white">{col.name}</span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isIn ? 'bg-primary border-primary' : 'border-slate-600'
                      }`}>
                        {isIn && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => { setAssignCollectionRoutine(null); setCreateCollectionOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium">New Collection</span>
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

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
            <p className="text-xs text-slate-500 mt-2 text-center">
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

      {/* Session type prompt — Lifting or Conditioning? */}
      {sessionTypePrompt && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setSessionTypePrompt(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[320px] w-full shadow-2xl">
            <p className="text-sm font-bold text-white text-center">What type of session?</p>
            <p className="text-xs text-slate-400 mt-1 text-center">{sessionTypePrompt.replace(/_/g, ' ')}</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  const name = sessionTypePrompt;
                  setSessionTypePrompt(null);
                  await _startHitIt(name);
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity flex flex-col items-center gap-1"
              >
                <span>🏋️</span>
                <span>Lifting</span>
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 text-center mb-2">Or log as conditioning class</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={condDuration}
                  onChange={e => setCondDuration(e.target.value)}
                  placeholder="Duration (min)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-400">min</span>
              </div>
              <button
                onClick={async () => {
                  const name = sessionTypePrompt;
                  setSessionTypePrompt(null);
                  await fetch('/api/activities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, durationMinutes: parseInt(condDuration) || null }),
                  });
                  fetchActivities();
                  setTab('history');
                }}
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors"
              >
                🏃 Log as Conditioning
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hit It replace confirmation */}
      {hitItReplaceConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setHitItReplaceConfirm(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-[320px] w-full shadow-2xl">
            <p className="text-sm font-bold text-white text-center">Workout in progress</p>
            <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed">
              You already have <span className="text-white font-semibold">{hitItQueue[0]?.replace(/_/g, ' ')}</span> active. Stop it and start <span className="text-white font-semibold">{hitItReplaceConfirm.replace(/_/g, ' ')}</span>?
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setHitItReplaceConfirm(null)}
                className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 transition-colors"
              >
                Keep current
              </button>
              <button
                onClick={async () => {
                  const name = hitItReplaceConfirm;
                  setHitItReplaceConfirm(null);
                  await _startHitIt(name);
                }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors"
              >
                Switch
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkoutsPage() {
  return (
    <Suspense>
      <WorkoutsPageInner />
    </Suspense>
  );
}
