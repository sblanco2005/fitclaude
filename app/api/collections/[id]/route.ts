import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const PATCH = withAuth(async (request: NextRequest, user) => {
  try {
    const id = request.nextUrl.pathname.split('/').at(-1)!;
    const body = await request.json();

    const existing = await prisma.workoutCollection.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.emoji !== undefined) data.emoji = body.emoji || null;
    if (body.color !== undefined) data.color = body.color || null;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const updated = await prisma.workoutCollection.update({
      where: { id },
      data,
      include: { workouts: { select: { routineName: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      emoji: updated.emoji,
      color: updated.color,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      routineNames: updated.workouts.map((w) => w.routineName),
    });
  } catch (error) {
    console.error('[collections] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest, user) => {
  try {
    const id = request.nextUrl.pathname.split('/').at(-1)!;

    const existing = await prisma.workoutCollection.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.workoutCollection.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[collections] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
  }
});
