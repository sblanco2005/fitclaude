import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workouts/[id]/exercises
 * Add an exercise from the library to the end of a workout.
 * Body: { exerciseId: string, sets?: number, reps?: string }
 */
export const POST = withAuth(async (request: NextRequest, user, params) => {
  const workoutId = params?.id;
  if (!workoutId) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(workoutId, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();
  const { sets = 3, reps = '8-12', exerciseName, exerciseMuscle } = body;
  let { exerciseId } = body;

  // Vision-add: a machine not yet in the library → find-or-create by name.
  if (!exerciseId && typeof exerciseName === 'string' && exerciseName.trim()) {
    const nm = exerciseName.trim();
    let ex = await prisma.exercise.findFirst({
      where: { name: { equals: nm, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!ex) {
      ex = await prisma.exercise.create({
        data: {
          name: nm,
          muscleGroup: (typeof exerciseMuscle === 'string' && exerciseMuscle.trim()) || 'full_body',
          exerciseType: 'compound',
        },
        select: { id: true },
      });
    }
    exerciseId = ex.id;
  }

  if (!exerciseId) {
    return NextResponse.json({ error: 'exerciseId or exerciseName is required' }, { status: 400 });
  }

  // Verify the exercise exists
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, name: true, muscleGroup: true },
  });
  if (!exercise) return AuthErrors.notFound('Exercise');

  // Get the current max order for this workout
  const lastExercise = await prisma.workoutExercise.findFirst({
    where: { workoutId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const nextOrder = (lastExercise?.order ?? -1) + 1;

  // Create the workout exercise
  const created = await prisma.workoutExercise.create({
    data: {
      workoutId,
      exerciseId,
      order: nextOrder,
      sets,
      reps,
      wasSpicy: false,
    },
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

  return NextResponse.json(created, { status: 201 });
});
