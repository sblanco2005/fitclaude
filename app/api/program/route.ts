import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — fetch user's active training program
export const GET = withAuth(async (_request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        days: { orderBy: [{ weekNumber: 'asc' }, { weekday: 'asc' }] },
      },
    });

    if (!program) {
      return NextResponse.json({ program: null });
    }

    return NextResponse.json({
      id: program.id,
      totalWeeks: program.totalWeeks,
      currentWeek: program.currentWeek,
      isActive: program.isActive,
      days: program.days.map((d) => ({
        id: d.id,
        weekday: d.weekday,
        weekNumber: d.weekNumber,
        dayType: d.dayType,
        dayLabel: d.dayLabel,
        workoutType: d.workoutType,
        exerciseTemplate: d.exerciseTemplate ? JSON.parse(d.exerciseTemplate) : null,
      })),
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
