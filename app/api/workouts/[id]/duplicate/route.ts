import { NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// POST /api/workouts/[id]/duplicate
// Creates a new workout with today's date, copying all exercises (without setLogs)
export const POST = withAuth(async (_request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(id, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const original = await prisma.workout.findUnique({
    where: { id },
    include: { exercises: { orderBy: { order: 'asc' } } },
  });
  if (!original) return AuthErrors.notFound('Workout');

  // Create new workout with today's date
  const newWorkout = await prisma.workout.create({
    data: {
      userId: user.id,
      name: original.name,
      workoutType: original.workoutType,
      category: original.category,
      source: original.source,
      completed: false,
      exercises: {
        create: original.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          variationId: ex.variationId,
          order: ex.order,
          sets: ex.sets,
          reps: ex.reps,
          weightKg: ex.weightKg,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
          wasSpicy: ex.wasSpicy,
          // setLogs intentionally omitted — fresh session
        })),
      },
    },
    include: {
      exercises: {
        include: { exercise: true, variation: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  console.log(`[duplicate] Created workout ${newWorkout.id} from ${id} for user ${user.id}`);
  return NextResponse.json(newWorkout);
});
