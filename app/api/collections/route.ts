import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_request, user) => {
  try {
    const collections = await prisma.workoutCollection.findMany({
      where: { userId: user.id },
      include: { workouts: { select: { routineName: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(
      collections.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        sortOrder: c.sortOrder,
        createdAt: c.createdAt.toISOString(),
        routineNames: c.workouts.map((w) => w.routineName),
      }))
    );
  } catch (error) {
    console.error('[collections] GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
});

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const { name, emoji, color } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const maxOrder = await prisma.workoutCollection.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });

    const collection = await prisma.workoutCollection.create({
      data: {
        userId: user.id,
        name: name.trim(),
        emoji: emoji || null,
        color: color || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({
      id: collection.id,
      name: collection.name,
      emoji: collection.emoji,
      color: collection.color,
      sortOrder: collection.sortOrder,
      createdAt: collection.createdAt.toISOString(),
      routineNames: [],
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A collection with that name already exists' }, { status: 409 });
    }
    console.error('[collections] POST error:', error);
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
});
