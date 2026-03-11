import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthErrors, verifyWorkoutOwnership } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const workout = await prisma.workout.findFirst({
    where: { id, userId: user.id },
    include: {
      exercises: {
        include: {
          exercise: true,
          variation: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!workout) return AuthErrors.notFound('Workout');

  return NextResponse.json(workout);
});

export const PATCH = withAuth(async (request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(id, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  const body = await request.json();

  const allowedFields = ['name', 'completed', 'fatigueRating', 'notes', 'durationMinutes', 'isFavorite'];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const updated = await prisma.workout.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_request, user, params) => {
  const id = params?.id;
  if (!id) return AuthErrors.notFound('Workout');

  const owns = await verifyWorkoutOwnership(id, user.id);
  if (!owns) return AuthErrors.notFound('Workout');

  await prisma.workout.delete({ where: { id } });

  return NextResponse.json({ success: true });
});
