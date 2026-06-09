/**
 * Snapshot builders for shareable routines and programs.
 *
 * A SharePost stores an immutable JSON snapshot rather than referencing the source
 * Workout/TrainingProgram, because the source is mutable and deletable. The snapshot
 * is the source of truth for recreation (see ./recreate.ts).
 */

import { prisma } from '@/lib/prisma';

export interface ExerciseSnapshot {
  name: string;
  muscleGroup: string | null;
  order: number;
  sets: number;
  reps: string | null;
  weightKg: number | null;
  restSeconds: number | null;
  supersetGroup: string | null;
  coachingTip: string | null;
}

export interface RoutineSnapshot {
  kind: 'routine';
  name: string | null;
  workoutType: string;
  category: string;
  notes: string | null;
  exercises: ExerciseSnapshot[];
}

export interface ProgramDaySnapshot {
  weekday: number;
  weekNumber: number;
  dayType: string;
  dayLabel: string;
  workoutType: string | null;
  exerciseTemplate: unknown | null; // parsed JSON template (coached days)
  routine: RoutineSnapshot | null; // linked routine-template, if a coached day
}

export interface ProgramSnapshot {
  kind: 'program';
  name: string | null;
  totalWeeks: number;
  days: ProgramDaySnapshot[];
}

// WorkoutExercise.notes is pipe-delimited: "name|muscleGroup|coachingTip".
function parseExerciseNotes(notes: string | null): { name: string | null; muscleGroup: string | null; coachingTip: string | null } {
  if (!notes) return { name: null, muscleGroup: null, coachingTip: null };
  const [name, muscleGroup, coachingTip] = notes.split('|');
  return {
    name: name?.trim() || null,
    muscleGroup: muscleGroup?.trim() || null,
    coachingTip: coachingTip?.trim() || null,
  };
}

type WorkoutWithExercises = {
  name: string | null;
  workoutType: string;
  category: string;
  notes: string | null;
  exercises: {
    order: number;
    sets: number;
    reps: string | null;
    weightKg: number | null;
    restSeconds: number | null;
    supersetGroup: string | null;
    notes: string | null;
    exercise: { name: string; muscleGroup: string } | null;
  }[];
};

function workoutToRoutineSnapshot(w: WorkoutWithExercises): RoutineSnapshot {
  const exercises: ExerciseSnapshot[] = w.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((we) => {
      const parsed = parseExerciseNotes(we.notes);
      // Prefer the linked Exercise's canonical name/muscle; fall back to pipe notes.
      const name = we.exercise?.name || parsed.name || 'Exercise';
      const muscleGroup = we.exercise?.muscleGroup || parsed.muscleGroup;
      return {
        name,
        muscleGroup,
        order: we.order,
        sets: we.sets,
        reps: we.reps,
        weightKg: we.weightKg,
        restSeconds: we.restSeconds,
        supersetGroup: we.supersetGroup,
        coachingTip: parsed.coachingTip,
      };
    });

  return {
    kind: 'routine',
    name: w.name,
    workoutType: w.workoutType,
    category: w.category,
    notes: w.notes,
    exercises,
  };
}

const WORKOUT_EXERCISE_INCLUDE = {
  exercises: { include: { exercise: { select: { name: true, muscleGroup: true } } } },
} as const;

/**
 * Build a routine snapshot from a Workout the user owns (template or session).
 * Returns null if the workout doesn't exist or isn't owned by the user.
 */
export async function buildRoutineSnapshot(workoutId: string, userId: string): Promise<RoutineSnapshot | null> {
  const w = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: WORKOUT_EXERCISE_INCLUDE,
  });
  if (!w) return null;
  return workoutToRoutineSnapshot(w as unknown as WorkoutWithExercises);
}

/**
 * Build a program snapshot from a TrainingProgram the user owns, including each
 * coached day's linked routine-template.
 */
export async function buildProgramSnapshot(programId: string, userId: string): Promise<ProgramSnapshot | null> {
  const program = await prisma.trainingProgram.findFirst({
    where: { id: programId, userId },
    include: {
      days: {
        orderBy: [{ weekNumber: 'asc' }, { weekday: 'asc' }],
        include: {
          workouts: {
            where: { completed: false },
            orderBy: { createdAt: 'asc' },
            take: 1,
            include: WORKOUT_EXERCISE_INCLUDE,
          },
        },
      },
    },
  });
  if (!program) return null;

  const days: ProgramDaySnapshot[] = program.days.map((d) => {
    const routineWorkout = d.workouts?.[0] || null;
    return {
      weekday: d.weekday,
      weekNumber: d.weekNumber,
      dayType: d.dayType,
      dayLabel: d.dayLabel,
      workoutType: d.workoutType,
      exerciseTemplate: d.exerciseTemplate ? JSON.parse(d.exerciseTemplate) : null,
      routine: routineWorkout ? workoutToRoutineSnapshot(routineWorkout as unknown as WorkoutWithExercises) : null,
    };
  });

  return {
    kind: 'program',
    name: program.name,
    totalWeeks: program.totalWeeks,
    days,
  };
}

/** Short human title for a share post. */
export function snapshotTitle(snapshot: RoutineSnapshot | ProgramSnapshot): string {
  if (snapshot.kind === 'program') {
    return snapshot.name || `${snapshot.totalWeeks}-week program`;
  }
  return snapshot.name || `${snapshot.workoutType} routine`;
}
