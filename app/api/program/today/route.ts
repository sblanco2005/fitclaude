import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — get today's workout from the training program
export const GET = withAuth(async (_request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        days: { orderBy: { dayIndex: 'asc' } },
      },
    });

    if (!program) {
      return NextResponse.json({ program: null });
    }

    const rotation = JSON.parse(program.rotation) as string[];
    if (!rotation.length) {
      return NextResponse.json({ program: null });
    }

    const currentDay = program.days.find(
      (d) => d.dayIndex === program.currentDayIndex
    );

    if (!currentDay) {
      return NextResponse.json({ program: null });
    }

    const template = JSON.parse(currentDay.exerciseTemplate);

    // Load last completed workout for this program day
    let lastSession = null;
    const lastWorkout = await prisma.workout.findFirst({
      where: {
        programDayId: currentDay.id,
        completed: true,
      },
      orderBy: { date: 'desc' },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            exercise: { select: { name: true } },
          },
        },
      },
    });

    if (lastWorkout) {
      lastSession = {
        date: lastWorkout.date.toISOString(),
        fatigueRating: lastWorkout.fatigueRating,
        exercises: lastWorkout.exercises.map((we) => {
          const name =
            we.exercise?.name ||
            (we.notes?.includes('|') ? we.notes.split('|')[0] : '?');
          return {
            name,
            sets: we.sets,
            reps: we.reps,
            weight: we.weightKg,
            setLogs: we.setLogs,
          };
        }),
      };
    }

    return NextResponse.json({
      programDayId: currentDay.id,
      dayLabel: currentDay.dayLabel,
      workoutType: currentDay.workoutType,
      dayIndex: currentDay.dayIndex,
      exerciseTemplate: template,
      isRestDay: false,
      lastSession,
    });
  } catch (error) {
    console.error('Failed to fetch today workout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today workout' },
      { status: 500 }
    );
  }
});
