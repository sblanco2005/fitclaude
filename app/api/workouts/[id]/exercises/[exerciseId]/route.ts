import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/workouts/[id]/exercises/[exerciseId]
 * - Swap exercise: { newExerciseId: string }
 * - Update sets/reps: { sets?: number, reps?: string, restSeconds?: number }
 */
export const PATCH = withAuth(async (request: NextRequest, user, params) => {
  const workoutId = params?.id;
  const workoutExerciseId = params?.exerciseId;
  if (!workoutId || !workoutExerciseId) return AuthErrors.notFound('WorkoutExercise');

  const owns = await verifyWorkoutOwnership(workoutId, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();
  const { sets, reps, restSeconds, newExerciseName, newExerciseMuscle } = body;
  let { newExerciseId } = body;

  // Verify the workout exercise belongs to this workout
  const workoutExercise = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workoutId },
  });
  if (!workoutExercise) return AuthErrors.notFound('WorkoutExercise');

  // Photo-swap to a machine not yet in the library: find-or-create it by name,
  // then fall through to the normal swap below.
  if (!newExerciseId && typeof newExerciseName === 'string' && newExerciseName.trim()) {
    const nm = newExerciseName.trim();
    let ex = await prisma.exercise.findFirst({
      where: { name: { equals: nm, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!ex) {
      ex = await prisma.exercise.create({
        data: {
          name: nm,
          muscleGroup: (typeof newExerciseMuscle === 'string' && newExerciseMuscle.trim()) || 'full_body',
          exerciseType: 'compound',
        },
        select: { id: true },
      });
    }
    newExerciseId = ex.id;
  }

  // If swapping exercise
  if (newExerciseId) {
    const newExercise = await prisma.exercise.findUnique({
      where: { id: newExerciseId },
      select: { id: true, name: true, muscleGroup: true },
    });
    if (!newExercise) return AuthErrors.notFound('Exercise');

    const updated = await prisma.workoutExercise.update({
      where: { id: workoutExerciseId },
      data: {
        exerciseId: newExerciseId,
        variationId: null,
        wasSpicy: false,
        notes: null,
      },
      include: {
        exercise: {
          include: {
            videos: {
              where: { status: 'approved' },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
        variation: true,
      },
    });
    return NextResponse.json(updated);
  }

  // Otherwise update sets/reps/rest
  const updateData: Record<string, unknown> = {};
  if (typeof sets === 'number' && sets > 0) updateData.sets = sets;
  if (typeof reps === 'string' && reps.trim()) updateData.reps = reps.trim();
  if (typeof restSeconds === 'number' && restSeconds >= 0) updateData.restSeconds = restSeconds;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.workoutExercise.update({
    where: { id: workoutExerciseId },
    data: updateData,
    include: {
      exercise: {
        include: {
          videos: {
            where: { status: { in: ['approved', 'pending'] } },
            orderBy: [{ status: 'asc' }, { isPrimary: 'desc' }],
          },
        },
      },
      variation: true,
    },
  });

  return NextResponse.json(updated);
});

// DELETE /api/workouts/[id]/exercises/[exerciseId] — remove exercise from routine
export const DELETE = withAuth(async (_request: NextRequest, user, params) => {
  const workoutId = params?.id;
  const workoutExerciseId = params?.exerciseId;
  if (!workoutId || !workoutExerciseId) return AuthErrors.notFound('WorkoutExercise');

  const owns = await verifyWorkoutOwnership(workoutId, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  await prisma.workoutExercise.deleteMany({
    where: { id: workoutExerciseId, workoutId },
  });

  return NextResponse.json({ ok: true });
});
