import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { estimateActivityKcal } from '@/lib/calorie-estimate';
import { resolveLocalDayParts, localMidnightToUtc } from '@/lib/dates';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const GET = withAuth(async (request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!program) {
      return NextResponse.json({ program: null });
    }

    const tz = new URL(request.url).searchParams.get('tz');
    const local = resolveLocalDayParts(tz);
    const todayWeekday = local.weekday;

    const currentDay = await prisma.programDay.findFirst({
      where: {
        programId: program.id,
        weekday: todayWeekday,
        weekNumber: program.currentWeek,
      },
      include: {
        workouts: {
          where: { completed: false },
          select: { id: true, name: true, displayId: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
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

    const routine = currentDay.workouts?.[0] || null;

    // Check if the user has already logged something for today
    // (completed workout OR activity dated today) — use user's local day boundaries.
    // localMidnightToUtc gives us the correct UTC time for midnight in the user's tz,
    // avoiding the bug where new Date(y,m,d) uses server UTC midnight instead.
    const startOfDay = localMidnightToUtc(local, tz);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [completedWorkoutToday, activityToday] = await Promise.all([
      prisma.workout.findFirst({
        where: {
          userId: user.id,
          completed: true,
          date: { gte: startOfDay, lt: endOfDay },
        },
        select: { id: true, name: true, workoutType: true },
        orderBy: { date: 'desc' },
      }),
      prisma.activity.findFirst({
        where: {
          userId: user.id,
          date: { gte: startOfDay, lt: endOfDay },
        },
        select: { id: true, name: true, durationMinutes: true },
        orderBy: { date: 'desc' },
      }),
    ]);

    const completedToday = !!(completedWorkoutToday || activityToday);
    const completedLabel = completedWorkoutToday?.name || activityToday?.name || null;

    // Fetch user weight for calorie estimate
    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { weightKg: true },
    });
    const weightKg = userRow?.weightKg ?? null;

    // Conservative (lower-bound) kcal estimate for the completed activity
    let estimatedKcal: number | null = null;
    if (activityToday) {
      estimatedKcal = estimateActivityKcal(
        activityToday.name,
        activityToday.durationMinutes,
        weightKg,
      );
    } else if (completedWorkoutToday) {
      // Lifting sessions default to ~50 min if duration not tracked
      estimatedKcal = estimateActivityKcal(
        completedWorkoutToday.name || 'lift',
        50,
        weightKg,
      );
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
      routineId: routine?.id || null,
      routineName: routine?.name || null,
      routineDisplayId: routine?.displayId || null,
      lastSession,
      completedToday,
      completedLabel,
      estimatedKcal,
    });
  } catch (error) {
    console.error('Failed to fetch today workout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today workout' },
      { status: 500 }
    );
  }
});
