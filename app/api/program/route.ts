import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — fetch user's active training program
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

    return NextResponse.json({
      id: program.id,
      splitType: program.splitType,
      rotation: JSON.parse(program.rotation),
      currentDayIndex: program.currentDayIndex,
      isActive: program.isActive,
      days: program.days.map((d) => ({
        id: d.id,
        dayLabel: d.dayLabel,
        workoutType: d.workoutType,
        dayIndex: d.dayIndex,
        exerciseTemplate: JSON.parse(d.exerciseTemplate),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch program:', error);
    return NextResponse.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
});

// DELETE — deactivate user's training program
export const DELETE = withAuth(async (_request, user) => {
  try {
    const program = await prisma.trainingProgram.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!program) {
      return NextResponse.json({ error: 'No active program' }, { status: 404 });
    }

    await prisma.trainingProgram.update({
      where: { id: program.id },
      data: { isActive: false },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete program:', error);
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
});
