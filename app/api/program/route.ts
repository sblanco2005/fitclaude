import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { setActiveProgram } from '@/lib/social/recreate';

function getMondayOfWeek(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(d.getTime() - daysToMonday * 86400000);
}

// Returns the Monday that starts the week containing dateStr,
// or the next Monday if dateStr is not itself a Monday.
// Used to anchor a program that was set up on a weekend before
// training actually began on Monday.
function getFirstProgramMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (day === 1) return d; // already Monday
  const daysForward = day === 0 ? 1 : 8 - day;
  return new Date(d.getTime() + daysForward * 86400000);
}

async function computeEffectiveWeek(programId: string, anchorDate: Date, totalWeeks: number, currentWeek: number): Promise<number> {
  const allDayIds = (await prisma.programDay.findMany({ where: { programId }, select: { id: true } })).map(d => d.id);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayMonday = getMondayOfWeek(todayStr);

  if (allDayIds.length > 0) {
    // Anchor from the most recent completed workout's known weekNumber.
    // Rolling forward by N calendar weeks from that week gives the correct
    // current week even across multiple cycle wraps, regardless of totalWeeks.
    const mostRecent = await prisma.workout.findFirst({
      where: { programDayId: { in: allDayIds }, completed: true },
      orderBy: { date: 'desc' },
      select: { date: true, programDay: { select: { weekNumber: true } } },
    });

    if (mostRecent?.programDay) {
      const lastWeek = mostRecent.programDay.weekNumber;
      const lastMonday = getMondayOfWeek(mostRecent.date.toISOString().split('T')[0]);
      const weeksSince = Math.max(0, Math.round((todayMonday.getTime() - lastMonday.getTime()) / (7 * 86400000)));
      const totalOffset = lastWeek - 1 + weeksSince;
      const calendarWeek = (totalOffset % totalWeeks) + 1;
      console.log('[week-debug] mostRecent date:', mostRecent.date.toISOString(), 'weekNumber:', lastWeek, 'weeksSince:', weeksSince, 'totalOffset:', totalOffset, 'calendarWeek:', calendarWeek, 'currentWeek:', currentWeek, 'totalWeeks:', totalWeeks);
      return totalOffset >= totalWeeks ? calendarWeek : Math.max(currentWeek, calendarWeek);
    }
  }

  // Fallback: no linked completed workouts.
  // Use the first Monday on-or-after createdAt as the program start.
  // Programs are typically set up on the weekend before training begins,
  // so getMondayOfWeek(createdAt) would go back one extra week.
  const anchorStr = anchorDate.toISOString().split('T')[0];
  const programStartMonday = getFirstProgramMonday(anchorStr);
  const weeksElapsed = Math.max(0, Math.round((todayMonday.getTime() - programStartMonday.getTime()) / (7 * 86400000)));
  const calendarWeek = (weeksElapsed % totalWeeks) + 1;
  // Same cycle-crossing guard: if we've completed at least one full cycle,
  // trust the calendar over the stale DB currentWeek.
  return weeksElapsed >= totalWeeks ? calendarWeek : Math.max(currentWeek, calendarWeek);
}

// GET — fetch the user's active training program, or a specific one with
// ?programId= (owned) so bench programs can be inspected without activating.
export const GET = withAuth(async (request, user) => {
  try {
    const programId = new URL(request.url).searchParams.get('programId');
    const program = await prisma.trainingProgram.findFirst({
      where: programId ? { id: programId, userId: user.id } : { userId: user.id, isActive: true },
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
      // Calendar-aware week only makes sense for the active program; bench
      // programs just report their stored currentWeek.
      currentWeek: program.isActive
        ? await computeEffectiveWeek(program.id, program.createdAt, program.totalWeeks, program.currentWeek)
        : program.currentWeek,
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

// PATCH — rename ({ name, programId? }), promote a program to active
// ({ programId }) or update the active program's currentWeek ({ currentWeek }).
export const PATCH = withAuth(async (request, user) => {
  try {
    const body = await request.json();

    // Rename (checked before promote since a rename also carries programId).
    if (typeof body.name === 'string') {
      const target = await prisma.trainingProgram.findFirst({
        where: body.programId ? { id: body.programId, userId: user.id } : { userId: user.id, isActive: true },
        select: { id: true },
      });
      if (!target) return AuthErrors.notFound('Program');
      const name = body.name.trim().slice(0, 40) || null;
      await prisma.trainingProgram.update({ where: { id: target.id }, data: { name } });
      return NextResponse.json({ ok: true, name });
    }

    if (typeof body.programId === 'string') {
      const ok = await setActiveProgram(user.id, body.programId);
      if (!ok) return AuthErrors.notFound('Program');
      return NextResponse.json({ ok: true, activeProgramId: body.programId });
    }

    const { currentWeek } = body;
    if (typeof currentWeek !== 'number') return NextResponse.json({ error: 'Invalid currentWeek' }, { status: 400 });

    const program = await prisma.trainingProgram.findFirst({ where: { userId: user.id, isActive: true } });
    if (!program) return NextResponse.json({ error: 'No active program' }, { status: 404 });

    const clamped = Math.max(1, Math.min(currentWeek, program.totalWeeks));
    await prisma.trainingProgram.update({ where: { id: program.id }, data: { currentWeek: clamped } });
    return NextResponse.json({ ok: true, currentWeek: clamped });
  } catch (error) {
    console.error('Failed to update program:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
});

// DELETE — remove a training program. With ?programId= removes that specific
// program (must be owned); otherwise removes the active program.
export const DELETE = withAuth(async (request, user) => {
  try {
    const programId = new URL(request.url).searchParams.get('programId');

    const program = await prisma.trainingProgram.findFirst({
      where: programId ? { id: programId, userId: user.id } : { userId: user.id, isActive: true },
      select: { id: true, isActive: true },
    });

    if (!program) {
      return NextResponse.json({ error: 'No program' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const dayIds = (await tx.programDay.findMany({ where: { programId: program.id }, select: { id: true } })).map((d) => d.id);
      if (dayIds.length) {
        // Delete the routine TEMPLATES linked to this program (incomplete, "Hit It"-able
        // routines shown on Train). Completed sessions are training history — they're
        // preserved (their programDayId is nulled when the days cascade-delete).
        await tx.workout.deleteMany({ where: { programDayId: { in: dayIds }, completed: false } });
      }
      await tx.trainingProgram.delete({ where: { id: program.id } });

      // If we removed the active Main, promote the most recent remaining program.
      if (program.isActive) {
        const next = await tx.trainingProgram.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { id: true } });
        if (next) await tx.trainingProgram.update({ where: { id: next.id }, data: { isActive: true } });
      }
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete program:', error);
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
});
