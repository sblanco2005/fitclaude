import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// POST — reschedule a day within the active program by swapping two weekday
// slots in a given week. Moving Tuesday's workout to Wednesday is a swap: if
// Wednesday is an empty rest slot, Tuesday's session lands there and Tuesday
// becomes rest; if Wednesday already has a session, the two exchange places.
//
// Body: { weekNumber: number, fromWeekday: number (0=Mon..6=Sun), toWeekday: number }
//
// ProgramDay has @@unique([programId, weekday, weekNumber]), so a swap can't set
// both rows directly — we park the source in a temp slot (-1) inside a
// transaction, then reassign.
export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const { weekNumber, fromWeekday, toWeekday } = body as {
      weekNumber?: number;
      fromWeekday?: number;
      toWeekday?: number;
    };

    const valid = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
    if (!valid(weekNumber) || !valid(fromWeekday) || !valid(toWeekday)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (fromWeekday < 0 || fromWeekday > 6 || toWeekday < 0 || toWeekday > 6) {
      return NextResponse.json({ error: 'weekday out of range' }, { status: 400 });
    }
    if (fromWeekday === toWeekday) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
      select: { id: true },
    });
    if (!program) return NextResponse.json({ error: 'No active program' }, { status: 404 });

    const [source, target] = await Promise.all([
      prisma.programDay.findUnique({
        where: { programId_weekday_weekNumber: { programId: program.id, weekday: fromWeekday, weekNumber } },
        select: { id: true },
      }),
      prisma.programDay.findUnique({
        where: { programId_weekday_weekNumber: { programId: program.id, weekday: toWeekday, weekNumber } },
        select: { id: true },
      }),
    ]);

    if (!source) return NextResponse.json({ error: 'Nothing scheduled on that day' }, { status: 404 });

    if (!target) {
      // Empty destination — a plain move.
      await prisma.programDay.update({ where: { id: source.id }, data: { weekday: toWeekday } });
    } else {
      // Both slots occupied — swap via a temporary weekday to dodge the unique index.
      await prisma.$transaction([
        prisma.programDay.update({ where: { id: source.id }, data: { weekday: -1 } }),
        prisma.programDay.update({ where: { id: target.id }, data: { weekday: fromWeekday } }),
        prisma.programDay.update({ where: { id: source.id }, data: { weekday: toWeekday } }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to move program day:', error);
    return NextResponse.json({ error: 'Failed to move day' }, { status: 500 });
  }
});
