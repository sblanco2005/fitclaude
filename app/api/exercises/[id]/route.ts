import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    },
  });

  if (!exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
  }

  return NextResponse.json(exercise);
}
