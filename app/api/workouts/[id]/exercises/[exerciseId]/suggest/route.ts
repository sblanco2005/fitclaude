import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/workouts/[id]/exercises/[exerciseId]/suggest
 *
 * Returns a random exercise from the same muscle group that is NOT
 * already in the routine. Used by the "AI pick" swap option.
 */
export const GET = withAuth(async (_request: NextRequest, user, params) => {
  const workoutId = params?.id;
  const workoutExerciseId = params?.exerciseId;
  if (!workoutId || !workoutExerciseId) return AuthErrors.notFound('WorkoutExercise');

  const owns = await verifyWorkoutOwnership(workoutId, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  // Get the exercise being swapped
  const workoutExercise = await prisma.workoutExercise.findFirst({
    where: { id: workoutExerciseId, workoutId },
    include: { exercise: { select: { muscleGroup: true } } },
  });
  if (!workoutExercise?.exercise) return AuthErrors.notFound('WorkoutExercise');

  const muscleGroup = workoutExercise.exercise.muscleGroup;

  // Get all exercise IDs already in this routine
  const routineExercises = await prisma.workoutExercise.findMany({
    where: { workoutId },
    select: { exerciseId: true },
  });
  const excludeIds = routineExercises
    .map((e) => e.exerciseId)
    .filter((id): id is string => id !== null);

  // Find candidates from same muscle group, excluding those already in routine
  const candidates = await prisma.exercise.findMany({
    where: {
      muscleGroup,
      id: { notIn: excludeIds },
    },
    select: { id: true, name: true, muscleGroup: true, equipmentRequired: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: 'No alternative exercises available for this muscle group' },
      { status: 404 }
    );
  }

  // Pick a random one
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return NextResponse.json(pick);
});
