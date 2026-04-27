import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

function getMondayOfWeek(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(d.getTime() - daysToMonday * 86400000);
}

async function computeEffectiveWeek(programId: string, anchorDate: Date, totalWeeks: number, currentWeek: number): Promise<number> {
  const allDayIds = (await prisma.programDay.findMany({ where: { programId }, select: { id: true } })).map(d => d.id);
  const firstWorkout = allDayIds.length > 0
    ? await prisma.workout.findFirst({ where: { programDayId: { in: allDayIds }, completed: true }, orderBy: { date: 'asc' }, select: { date: true } })
    : null;
  const anchor = firstWorkout?.date ?? anchorDate;
  const anchorStr = anchor.toISOString().split('T')[0];
  const programStartMonday = getMondayOfWeek(anchorStr);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMonday = getMondayOfWeek(todayStr);
  const weeksElapsed = Math.max(0, Math.round((todayMonday.getTime() - programStartMonday.getTime()) / (7 * 86400000)));
  const calendarWeek = (weeksElapsed % totalWeeks) + 1;
  // When a new cycle starts (weeksElapsed is an exact multiple of totalWeeks),
  // the DB currentWeek may still hold a value from the previous cycle.
  // Treat the calendar as authoritative at cycle boundaries so it resets properly.
  const isNewCycleStart = weeksElapsed > 0 && weeksElapsed % totalWeeks === 0;
  return isNewCycleStart ? calendarWeek : Math.max(currentWeek, calendarWeek);
}

// GET — fetch user's active training program
export const GET = withAuth(async (_request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        days: {
          orderBy: [{ weekNumber: 'asc' }, { weekday: 'asc' }],
          include: {
            workouts: {
              where: { completed: false },
              select: { id: true, name: true, displayId: true },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ program: null });
    }

    return NextResponse.json({
      id: program.id,
      totalWeeks: program.totalWeeks,
      currentWeek: await computeEffectiveWeek(program.id, program.createdAt, program.totalWeeks, program.currentWeek),
      isActive: program.isActive,
      days: program.days.map((d) => {
        const routine = d.workouts?.[0] || null;
        return {
          id: d.id,
          weekday: d.weekday,
          weekNumber: d.weekNumber,
          dayType: d.dayType,
          dayLabel: d.dayLabel,
          workoutType: d.workoutType,
          exerciseTemplate: d.exerciseTemplate ? JSON.parse(d.exerciseTemplate) : null,
          routineId: routine?.id || null,
          routineName: routine?.name || null,
          routineDisplayId: routine?.displayId || null,
        };
      }),
    });
  } catch (error) {
    console.error('Failed to fetch program:', error);
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
});

// PATCH — update currentWeek (called when user manually navigates weeks on home screen)
export const PATCH = withAuth(async (request, user) => {
  try {
    const { currentWeek } = await request.json();
    if (typeof currentWeek !== 'number') return NextResponse.json({ error: 'Invalid currentWeek' }, { status: 400 });

    const program = await prisma.trainingProgram.findFirst({ where: { userId: user.id, isActive: true } });
    if (!program) return NextResponse.json({ error: 'No active program' }, { status: 404 });

    const clamped = Math.max(1, Math.min(currentWeek, program.totalWeeks));
    await prisma.trainingProgram.update({ where: { id: program.id }, data: { currentWeek: clamped } });
    return NextResponse.json({ ok: true, currentWeek: clamped });
  } catch (error) {
    console.error('Failed to update program week:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
});

// DELETE — remove user's training program
export const DELETE = withAuth(async (_request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id },
    });

    if (!program) {
      return NextResponse.json({ error: 'No program' }, { status: 404 });
    }

    await prisma.trainingProgram.delete({ where: { id: program.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete program:', error);
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
});
