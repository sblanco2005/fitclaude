import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds } from '@/lib/timezone';

export const GET = withAuth(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10);
    const workoutType = searchParams.get('workoutType');
    const timezone = searchParams.get('tz') || 'UTC';

    // Compute "daysBack ago" in the user's timezone
    const now = new Date();
    const todayLocal = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    const sinceDate = new Date(todayLocal + 'T00:00:00Z');
    sinceDate.setDate(sinceDate.getDate() - daysBack);
    const sinceStr = sinceDate.toISOString().split('T')[0];
    const { start: since } = getUserDayBounds(timezone, sinceStr);

    const where: Record<string, unknown> = {
      userId: user.id,
      date: { gte: since },
    };

    if (workoutType) {
      where.workoutType = workoutType;
    }

    const workouts = await prisma.workout.findMany({
      where,
      include: {
        exercises: {
          include: {
            exercise: {
              select: {
                name: true,
                muscleGroup: true,
                equipmentRequired: true,
                gifUrl: true,
                videos: {
                  where: { status: { in: ['approved', 'pending'] } },
                  orderBy: [{ status: 'asc' }, { isPrimary: 'desc' }],
                  take: 1,
                  select: { youtubeVideoId: true, title: true, videoType: true, status: true },
                },
              },
            },
            variation: { select: { name: true, spicyLevel: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(workouts);
  } catch (error) {
    console.error('[workouts] GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
});
