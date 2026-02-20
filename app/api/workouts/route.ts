import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10);
    const workoutType = searchParams.get('workoutType');

    const since = new Date();
    since.setDate(since.getDate() - daysBack);

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
                videos: {
                  where: { status: 'approved', videoType: 'tutorial' },
                  orderBy: { isPrimary: 'desc' },
                  take: 1,
                  select: { youtubeVideoId: true, title: true },
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
