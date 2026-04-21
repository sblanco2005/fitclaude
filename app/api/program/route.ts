import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

function computeEffectiveWeek(createdAt: Date, totalWeeks: number): number {
  const created = new Date(createdAt);
  const createdDay = created.getUTCDay();
  const daysToMonday = createdDay === 0 ? 6 : createdDay - 1;
  const programStartMonday = new Date(created.getTime() - daysToMonday * 86400000);
  const now = new Date();
  const nowDay = now.getUTCDay();
  const daysToTodayMonday = nowDay === 0 ? 6 : nowDay - 1;
  const todayMonday = new Date(now.getTime() - daysToTodayMonday * 86400000);
  const weeksElapsed = Math.max(0, Math.round((todayMonday.getTime() - programStartMonday.getTime()) / (7 * 86400000)));
  return (weeksElapsed % totalWeeks) + 1;
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
      currentWeek: computeEffectiveWeek(program.createdAt, program.totalWeeks),
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
