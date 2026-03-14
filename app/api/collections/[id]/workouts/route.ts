import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const segments = request.nextUrl.pathname.split('/');
    const collectionId = segments[segments.indexOf('collections') + 1];
    const body = await request.json();
    const { routineName } = body;

    if (!routineName || typeof routineName !== 'string') {
      return NextResponse.json({ error: 'routineName is required' }, { status: 400 });
    }

    const collection = await prisma.workoutCollection.findFirst({
      where: { id: collectionId, userId: user.id },
    });
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    await prisma.workoutCollectionWorkout.create({
      data: { collectionId, routineName },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Routine already in collection' }, { status: 409 });
    }
    console.error('[collections/workouts] POST error:', error);
    return NextResponse.json({ error: 'Failed to add routine' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest, user) => {
  try {
    const segments = request.nextUrl.pathname.split('/');
    const collectionId = segments[segments.indexOf('collections') + 1];
    const body = await request.json();
    const { routineName } = body;

    if (!routineName || typeof routineName !== 'string') {
      return NextResponse.json({ error: 'routineName is required' }, { status: 400 });
    }

    const collection = await prisma.workoutCollection.findFirst({
      where: { id: collectionId, userId: user.id },
    });
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    await prisma.workoutCollectionWorkout.deleteMany({
      where: { collectionId, routineName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[collections/workouts] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove routine' }, { status: 500 });
  }
});
