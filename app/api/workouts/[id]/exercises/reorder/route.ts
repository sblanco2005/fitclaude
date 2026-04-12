import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/workouts/[id]/exercises/reorder
 * Body: { orderedIds: string[] } — full list of workoutExercise IDs in their new order
 */
export const POST = withAuth(async (request: NextRequest, user, params) => {
  const workoutId = params?.id;
  if (!workoutId) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(workoutId, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
  }

  // Verify all IDs belong to this workout
  const existing = await prisma.workoutExercise.findMany({
    where: { workoutId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: 'Invalid exercise IDs' }, { status: 400 });
  }

  // Update order in a transaction
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.workoutExercise.update({
        where: { id },
        data: { order: index + 1 },
      })
    )
  );

  return NextResponse.json({ success: true });
});
