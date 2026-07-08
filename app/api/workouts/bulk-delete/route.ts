import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// POST — bulk-delete the user's routines/workouts by id. Program-linked workouts
// are intentionally NOT deletable here (they're managed from the Program page);
// the query filters programDayId: null so any program-linked id is ignored.
export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body.workoutIds) ? body.workoutIds.filter((x: unknown) => typeof x === 'string') : [];
    if (!ids.length) return NextResponse.json({ error: 'No workouts provided' }, { status: 400 });

    const result = await prisma.workout.deleteMany({
      where: { id: { in: ids }, userId: user.id, programDayId: null },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('Failed to bulk-delete workouts:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
});
