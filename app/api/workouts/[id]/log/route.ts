import { NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// POST /api/workouts/[id]/log
// Body: { exercises: [{ exerciseId: string, setLogs: SetLog[] }], durationMinutes?: number }
export const POST = withAuth(async (request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(id, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();
  const exerciseLogs: { exerciseId: string; setLogs: unknown[] }[] = body.exercises ?? [];

  console.log(`[log] Saving workout ${id}: ${exerciseLogs.length} exercises, durationMinutes=${body.durationMinutes}`);
  console.log(`[log] Exercise IDs:`, exerciseLogs.map(e => e.exerciseId));
  console.log(`[log] Full body:`, JSON.stringify(body).substring(0, 500));

  // Use a transaction so all updates succeed or all fail
  const workout = await prisma.$transaction(async (tx) => {
    // Update each exercise's setLogs
    for (const entry of exerciseLogs) {
      // Verify the exercise belongs to this workout before updating
      const we = await tx.workoutExercise.findFirst({
        where: { id: entry.exerciseId, workoutId: id },
        select: { id: true },
      });
      if (!we) {
        console.warn(`[log] WorkoutExercise ${entry.exerciseId} not found in workout ${id}, skipping`);
        continue;
      }
      const serialized = JSON.stringify(entry.setLogs);
      console.log(`[log] Updating exercise ${entry.exerciseId}: ${serialized.substring(0, 100)}`);
      await tx.workoutExercise.update({
        where: { id: entry.exerciseId },
        data: { setLogs: serialized },
      });
    }

    // Mark workout completed and optionally set duration
    const updates: Record<string, unknown> = { completed: true };
    if (body.durationMinutes) {
      updates.durationMinutes = body.durationMinutes;
    }

    return tx.workout.update({
      where: { id },
      data: updates,
      include: {
        exercises: {
          orderBy: { order: 'asc' },
        },
      },
    });
  });

  console.log(`[log] Workout ${id} saved successfully, completed=${workout.completed}`);
  return NextResponse.json(workout);
});

// DELETE /api/workouts/[id]/log — clear all setLogs for this workout session
export const DELETE = withAuth(async (_request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(id, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  // Clear all setLogs for exercises in this workout
  await prisma.workoutExercise.updateMany({
    where: { workoutId: id },
    data: { setLogs: null },
  });

  // Also reset completed status
  await prisma.workout.update({
    where: { id },
    data: { completed: false, durationMinutes: null },
  });

  return NextResponse.json({ success: true });
});

// PATCH /api/workouts/[id]/log — update setLogs for specific exercises
// Body: { exercises: [{ exerciseId: string, setLogs: SetLog[] }] }
export const PATCH = withAuth(async (request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(id, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();
  const exerciseLogs: { exerciseId: string; setLogs: unknown[] }[] = body.exercises ?? [];

  for (const entry of exerciseLogs) {
    await prisma.workoutExercise.update({
      where: { id: entry.exerciseId },
      data: { setLogs: JSON.stringify(entry.setLogs) },
    });
  }

  return NextResponse.json({ success: true });
});
