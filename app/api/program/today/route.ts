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

// Get the Monday (UTC noon) of the calendar week containing a given date string (YYYY-MM-DD).
function getMondayOfWeek(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0=Sun
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(d.getTime() - daysToMonday * 86400000);
}

// First Monday on-or-after the given date. Programs set up on a weekend
// should anchor to the following Monday, not the previous one.
function getFirstProgramMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  if (day === 1) return d;
  const daysForward = day === 0 ? 1 : 8 - day;
  return new Date(d.getTime() + daysForward * 86400000);
}

export const GET = withAuth(async (request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
      include: { days: { select: { id: true, weekNumber: true } } },
    });

    if (!program) {
      return NextResponse.json({ program: null });
    }

    const tz = new URL(request.url).searchParams.get('tz');
    const local = resolveLocalDayParts(tz);
    const todayWeekday = local.weekday;

    const allDayIds = program.days.map((d) => d.id);

    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${local.year}-${pad(local.month + 1)}-${pad(local.day)}`;
    const todayMonday = getMondayOfWeek(todayStr);

    let effectiveWeek = program.currentWeek;

    if (allDayIds.length > 0) {
      // Anchor from the most recent completed workout's known weekNumber.
      // Rolling forward by N calendar weeks correctly handles any number of
      // cycle wraps regardless of totalWeeks.
      const mostRecent = await prisma.workout.findFirst({
        where: { programDayId: { in: allDayIds }, completed: true },
        orderBy: { date: 'desc' },
        select: {
          date: true,
          programDay: { select: { weekNumber: true } },
        },
      });

      if (mostRecent?.programDay) {
        const lastWeek = mostRecent.programDay.weekNumber;
        const lastDateStr = tz
          ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(mostRecent.date)
          : mostRecent.date.toISOString().split('T')[0];
        const lastMonday = getMondayOfWeek(lastDateStr);
        const weeksSince = Math.max(0, Math.round((todayMonday.getTime() - lastMonday.getTime()) / (7 * 86400000)));
        const totalOffset = lastWeek - 1 + weeksSince;
        const calendarWeek = (totalOffset % program.totalWeeks) + 1;
        effectiveWeek = totalOffset >= program.totalWeeks
          ? calendarWeek
          : Math.max(program.currentWeek, calendarWeek);
      } else {
        // No linked completed workouts — fall back to createdAt anchor.
        // Use first Monday on-or-after createdAt so a program set up on a
        // weekend doesn't roll back one extra week.
        const anchorStr = tz
          ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(program.createdAt)
          : program.createdAt.toISOString().split('T')[0];
        const programStartMonday = getFirstProgramMonday(anchorStr);
        const weeksElapsed = Math.max(0, Math.round((todayMonday.getTime() - programStartMonday.getTime()) / (7 * 86400000)));
        effectiveWeek = Math.max(program.currentWeek, (weeksElapsed % program.totalWeeks) + 1);
      }
    }

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
