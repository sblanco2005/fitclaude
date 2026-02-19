import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const muscleGroup = searchParams.get('muscleGroup');
  const difficulty = searchParams.get('difficulty');
  const exerciseType = searchParams.get('exerciseType');

  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  if (muscleGroup) {
    where.muscleGroup = muscleGroup;
  }
  if (difficulty) {
    where.difficulty = difficulty;
  }
  if (exerciseType) {
    where.exerciseType = exerciseType;
  }

  const exercises = await prisma.exercise.findMany({
    where,
    include: {
      variations: {
        orderBy: { spicyLevel: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(exercises);
}
