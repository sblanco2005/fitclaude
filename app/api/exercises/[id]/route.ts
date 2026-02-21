import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: {
      variations: {
        orderBy: { spicyLevel: 'asc' },
      },
      videos: {
        where: { status: 'approved' },
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  if (!exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
  }

  return NextResponse.json(exercise);
}

export const PATCH = withAuth(async (
  request: NextRequest,
  _user,
  params,
) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const body = await request.json();
  const { name, muscleGroup, exerciseType, difficulty } = body;

  if (!name && !muscleGroup && !exerciseType && !difficulty) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Check for duplicate name
  if (name) {
    const existing = await prisma.exercise.findFirst({
      where: { name, id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'An exercise with this name already exists' }, { status: 409 });
    }
  }

  const updated = await prisma.exercise.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(muscleGroup && { muscleGroup }),
      ...(exerciseType && { exerciseType }),
      ...(difficulty && { difficulty }),
    },
    include: {
      variations: { orderBy: { spicyLevel: 'asc' } },
      videos: { where: { status: 'approved' }, orderBy: { isPrimary: 'desc' } },
    },
  });

  return NextResponse.json(updated);
});
