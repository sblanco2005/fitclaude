import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// JavaScript getDay(): 0=Sun, 1=Mon ... 6=Sat
// We want: 0=Mon, 1=Tue ... 6=Sun
function getMondayWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

export const GET = withAuth(async (_request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!program) {
      return NextResponse.json({ program: null });
    }

    const todayWeekday = getMondayWeekday(new Date());

    const currentDay = await prisma.programDay.findFirst({
      where: {
        programId: program.id,
        weekday: todayWeekday,
        weekNumber: program.currentWeek,
      },
    });

    if (!currentDay) {
      return NextResponse.json({
        programDayId: null,
        weekday: todayWeekday,
        weekdayName: WEEKDAY_NAMES[todayWeekday],
        weekNumber: program.currentWeek,
        dayType: 'rest',
        dayLabel: 'Rest',
        workoutType: null,
        exerciseTemplate: null,
        lastSession: null,
      });
    }

    const template = currentDay.exerciseTemplate
      ? JSON.parse(currentDay.exerciseTemplate)
      : null;

    // Load last completed workout for this program day
    let lastSession = null;
    if (currentDay.dayType === 'coached') {
      const lastWorkout = await prisma.workout.findFirst({
        where: { programDayId: currentDay.id, completed: true },
        orderBy: { date: 'desc' },
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: { exercise: { select: { name: true } } },
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
    }

    return NextResponse.json({
      programDayId: currentDay.id,
      weekday: currentDay.weekday,
      weekdayName: WEEKDAY_NAMES[currentDay.weekday],
      weekNumber: currentDay.weekNumber,
      dayType: currentDay.dayType,
      dayLabel: currentDay.dayLabel,
      workoutType: currentDay.workoutType,
      exerciseTemplate: template,
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
