import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/workouts/[id]/exercises/[exerciseId]
 * Swap a workout exercise with a different one from the library.
 * Body: { newExerciseId: string }
 */
export const PATCH = withAuth(async (request: NextRequest, user, params) => {
  const workoutId = params?.id;
  const workoutExerciseId = params?.exerciseId;
  if (!workoutId || !workoutExerciseId) return AuthErrors.notFound('WorkoutExercise');

  const owns = await verifyWorkoutOwnership(workoutId, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();
  const { newExerciseId } = body;

  if (!newExerciseId) {
    return NextResponse.json({ error: 'newExerciseId is required' }, { status: 400 });
  }

  // Verify the new exercise exists
  const newExercise = await prisma.exercise.findUnique({
    where: { id: newExerciseId },
    select: { id: true, name: true, muscleGroup: true },
  });
  if (!newExercise) return AuthErrors.notFound('Exercise');

  // Verify the workout exercise belongs to this workout
  const workoutExercise = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workoutId },
  });
  if (!workoutExercise) return AuthErrors.notFound('WorkoutExercise');

  // Update the workout exercise to point to the new exercise
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
});
