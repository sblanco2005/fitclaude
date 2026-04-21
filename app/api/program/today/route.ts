import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { estimateActivityKcal } from '@/lib/calorie-estimate';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// JavaScript getDay(): 0=Sun, 1=Mon ... 6=Sat
// We want: 0=Mon, 1=Tue ... 6=Sun
function getMondayWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

// Convert the user's local calendar midnight to the correct UTC time.
// new Date(y, m, d) uses SERVER timezone (UTC on Vercel) — wrong for users
// in other timezones.  This computes the UTC offset at noon on that date
// (noon avoids DST midnight edge cases) and shifts accordingly.
function localMidnightToUtc(local: { year: number; month: number; day: number }, tz: string | null): Date {
  if (!tz) return new Date(local.year, local.month, local.day);
  try {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${local.year}-${pad(local.month + 1)}-${pad(local.day)}`;
    const noonUtc = new Date(`${dateStr}T12:00:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(noonUtc);
    const localHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '12', 10);
    const localMin  = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const tzOffsetMs = (12 * 60 - (localHour * 60 + localMin)) * 60 * 1000;
    return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + tzOffsetMs);
  } catch {
    return new Date(local.year, local.month, local.day);
  }
}

// Get the Mon-indexed weekday AND Y/M/D parts for a given IANA tz.
// Falls back to server-local time if tz is missing or invalid.
function resolveLocalDayParts(tz: string | null): { weekday: number; year: number; month: number; day: number } {
  const now = new Date();
  if (!tz) {
    return {
      weekday: getMondayWeekday(now),
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const wdMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const weekday = wdMap[get('weekday')] ?? getMondayWeekday(now);
    return {
      weekday,
      year: parseInt(get('year'), 10),
      month: parseInt(get('month'), 10) - 1,
      day: parseInt(get('day'), 10),
    };
  } catch {
    return {
      weekday: getMondayWeekday(now),
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }
}

// Compute which program week we're actually in based on calendar weeks elapsed
// since the Monday of the week the program was created (in the user's tz).
// This makes week advancement automatic — no manual DB writes needed.
function computeEffectiveWeek(
  programCreatedAt: Date,
  totalWeeks: number,
  local: { year: number; month: number; day: number },
  tz: string | null,
): number {
  // Monday of the week the program was created (in user tz)
  const createdLocal = new Date(
    tz
      ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(programCreatedAt) + 'T12:00:00Z'
      : programCreatedAt.toISOString().split('T')[0] + 'T12:00:00Z'
  );
  const createdDay = createdLocal.getUTCDay(); // 0=Sun
  const daysToMonday = createdDay === 0 ? 6 : createdDay - 1;
  const programStartMonday = new Date(createdLocal.getTime() - daysToMonday * 86400000);

  // Monday of the current local week
  const todayLocal = new Date(`${local.year}-${String(local.month + 1).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T12:00:00Z`);
  const todayDay = todayLocal.getUTCDay();
  const daysToTodayMonday = todayDay === 0 ? 6 : todayDay - 1;
  const todayMonday = new Date(todayLocal.getTime() - daysToTodayMonday * 86400000);

  const weeksElapsed = Math.max(0, Math.round((todayMonday.getTime() - programStartMonday.getTime()) / (7 * 86400000)));
  return (weeksElapsed % totalWeeks) + 1;
}

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

    // Use whichever is higher: DB value (user manually advanced) or calendar (auto-advances weekly).
    // This means the user tapping > on the home screen persists and is respected here.
    const calendarWeek = computeEffectiveWeek(program.createdAt, program.totalWeeks, local, tz);
    const effectiveWeek = Math.max(program.currentWeek, calendarWeek);

    const currentDay = await prisma.programDay.findFirst({
      where: {
        programId: program.id,
        weekday: todayWeekday,
        weekNumber: effectiveWeek,
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
        weekNumber: effectiveWeek,
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
    const startOfDay = localMidnightToUtc(local, tz);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // 48h window as fallback: covers evening workouts stored as "next day" UTC
    // and PT sessions linked via programDayId regardless of UTC date storage.
    const twoDaysAgo = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);

    const [completedWorkoutToday, activityToday] = await Promise.all([
      prisma.workout.findFirst({
        where: {
          userId: user.id,
          completed: true,
          OR: [
            { date: { gte: startOfDay, lt: endOfDay } },
            // Fallback: workout linked to this exact program day logged in last 48h.
            // Handles the case where an evening workout is stored as UTC "next day"
            // and still falls outside the timezone-adjusted window.
            { programDayId: currentDay.id, date: { gte: twoDaysAgo, lt: endOfDay } },
          ],
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
