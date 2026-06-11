/**
 * Recreate (deep-clone) shared routines/programs into a recipient's account,
 * and manage the active program among a user's (up to 3) programs.
 *
 * Ports the clone semantics from the Python coach tools `_tool_log_routine_done`
 * and `_tool_generate_program`, but in the Prisma layer where the social feature
 * lives. Missing exercises are auto-created in the global Exercise library
 * (find-or-create by unique name).
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ProgramSnapshot, RoutineSnapshot, ExerciseSnapshot } from './snapshot';

export const MAX_PROGRAMS_PER_USER = 3;

/** Thrown when a user already holds the max number of programs. */
export class ProgramCapReachedError extends Error {
  constructor(public readonly limit: number) {
    super(`Program cap reached (max ${limit})`);
    this.name = 'ProgramCapReachedError';
  }
}

type Tx = Prisma.TransactionClient | PrismaClient;

// Rebuild the WorkoutExercise pipe-notes ("name|muscleGroup|coachingTip") so the
// exercise still renders even when not linked to a library row.
function buildExerciseNotes(ex: ExerciseSnapshot): string {
  return [ex.name, ex.muscleGroup || '', ex.coachingTip || ''].join('|');
}

/** Next per-user display number for a routine: MAX(displayId)+1. */
async function nextDisplayId(tx: Tx, userId: string): Promise<number> {
  const agg = await tx.workout.aggregate({ where: { userId }, _max: { displayId: true } });
  return (agg._max.displayId ?? 0) + 1;
}

/**
 * Find an exercise in the global library by name, creating it if missing.
 * Exercise.name is globally unique, so upsert is race-safe.
 */
async function findOrCreateExerciseId(tx: Tx, ex: ExerciseSnapshot): Promise<string> {
  const row = await tx.exercise.upsert({
    where: { name: ex.name },
    update: {},
    create: {
      name: ex.name,
      muscleGroup: ex.muscleGroup || 'full_body',
      // Approximate metadata for auto-created exercises; users can refine later.
      exerciseType: 'compound',
      difficulty: 'intermediate',
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Create a routine-template Workout (+exercises) for `userId` from a snapshot.
 * `displayId` may be supplied (for sequential assignment when cloning many at once).
 * Returns the new Workout id.
 */
async function createRoutineFromSnapshot(
  tx: Tx,
  userId: string,
  snapshot: RoutineSnapshot,
  opts: { displayId?: number; programDayId?: string } = {},
): Promise<string> {
  const displayId = opts.displayId ?? (await nextDisplayId(tx, userId));

  const workout = await tx.workout.create({
    data: {
      userId,
      displayId,
      name: snapshot.name,
      workoutType: snapshot.workoutType,
      category: snapshot.category,
      source: 'coach',
      notes: snapshot.notes,
      completed: false, // a recreated routine is a template, not a logged session
      programDayId: opts.programDayId ?? null,
    },
    select: { id: true },
  });

  for (const ex of snapshot.exercises) {
    const exerciseId = await findOrCreateExerciseId(tx, ex);
    await tx.workoutExercise.create({
      data: {
        workoutId: workout.id,
        exerciseId,
        order: ex.order,
        sets: ex.sets,
        reps: ex.reps,
        weightKg: ex.weightKg,
        restSeconds: ex.restSeconds,
        supersetGroup: ex.supersetGroup,
        notes: buildExerciseNotes(ex),
      },
    });
  }

  return workout.id;
}

/**
 * Recreate a shared routine into `userId`'s account as a new routine template.
 * Returns the new Workout id.
 */
export async function recreateRoutine(userId: string, snapshot: RoutineSnapshot): Promise<string> {
  return prisma.$transaction((tx) => createRoutineFromSnapshot(tx, userId, snapshot));
}

/**
 * Recreate a shared program into `userId`'s account as a NON-active program,
 * enforcing the max-programs cap. Returns the new TrainingProgram id.
 * Throws ProgramCapReachedError if the user is already at the cap.
 */
export async function recreateProgram(
  userId: string,
  snapshot: ProgramSnapshot,
  provenance: { sourceUserId?: string | null; sourceShareId?: string | null } = {},
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Enforce the cap by evicting the OLDEST non-active program (never the active
    // "main"), so adding a program at the limit replaces the oldest bench program.
    const existing = await tx.trainingProgram.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, isActive: true },
    });
    if (existing.length >= MAX_PROGRAMS_PER_USER) {
      const evict = existing.find((p) => !p.isActive);
      if (!evict) throw new ProgramCapReachedError(MAX_PROGRAMS_PER_USER); // all active (shouldn't happen)
      await tx.trainingProgram.delete({ where: { id: evict.id } });
    }

    const program = await tx.trainingProgram.create({
      data: {
        userId,
        name: snapshot.name,
        totalWeeks: snapshot.totalWeeks,
        currentWeek: 1,
        isActive: false, // recreated programs start inactive; user promotes later
        sourceUserId: provenance.sourceUserId ?? null,
        sourceShareId: provenance.sourceShareId ?? null,
      },
      select: { id: true },
    });

    let displayId = await nextDisplayId(tx, userId);

    for (const day of snapshot.days) {
      const programDay = await tx.programDay.create({
        data: {
          programId: program.id,
          weekday: day.weekday,
          weekNumber: day.weekNumber,
          dayType: day.dayType,
          dayLabel: day.dayLabel,
          workoutType: day.workoutType,
          exerciseTemplate: day.exerciseTemplate ? JSON.stringify(day.exerciseTemplate) : null,
        },
        select: { id: true },
      });

      // Coached days carry a routine-template workout; clone it linked to the day.
      if (day.routine) {
        await createRoutineFromSnapshot(tx, userId, day.routine, {
          displayId,
          programDayId: programDay.id,
        });
        displayId += 1;
      }
    }

    return program.id;
  });
}

/**
 * Prepare to build a brand-new program: demote the current active program to a
 * bench slot and evict the oldest bench program if needed so there's room for one
 * more. After this the user has no active program, so the generator will create a
 * fresh active one (keeping the old main as a bench).
 */
export async function demoteActiveAndMakeRoom(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const programs = await tx.trainingProgram.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, isActive: true },
    });
    const active = programs.find((p) => p.isActive);
    if (active) await tx.trainingProgram.update({ where: { id: active.id }, data: { isActive: false } });

    // Need room for the soon-to-be-created program: keep at most MAX-1 existing.
    let total = programs.length;
    for (const p of programs.filter((x) => x.id !== active?.id)) {
      if (total < MAX_PROGRAMS_PER_USER) break;
      await tx.trainingProgram.delete({ where: { id: p.id } });
      total -= 1;
    }
  });
}

/**
 * Make `programId` the user's single active program (deactivating the others).
 * Verifies ownership. Returns false if the program isn't found / not owned.
 */
export async function setActiveProgram(userId: string, programId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.trainingProgram.findFirst({ where: { id: programId, userId }, select: { id: true } });
    if (!target) return false;
    await tx.trainingProgram.updateMany({ where: { userId }, data: { isActive: false } });
    await tx.trainingProgram.update({ where: { id: target.id }, data: { isActive: true } });
    return true;
  });
}
