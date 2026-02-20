import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';

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
      videos: {
        where: { status: 'approved' },
        orderBy: { isPrimary: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(exercises);
}

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const { name, muscleGroup, secondaryMuscles, equipmentRequired,
          difficulty, exerciseType, instructions } = body;

  if (!name || !muscleGroup || !exerciseType) {
    return NextResponse.json(
      { error: 'name, muscleGroup, and exerciseType are required' },
      { status: 400 }
    );
  }

  const existing = await prisma.exercise.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: `Exercise "${name}" already exists` },
      { status: 409 }
    );
  }

  const exercise = await prisma.exercise.create({
    data: {
      name,
      muscleGroup,
      secondaryMuscles: secondaryMuscles || null,
      equipmentRequired: equipmentRequired || null,
      difficulty: difficulty || 'intermediate',
      exerciseType,
      instructions: instructions || null,
    },
    include: {
      variations: true,
      videos: { where: { status: 'approved' } },
    },
  });

  return NextResponse.json(exercise, { status: 201 });
});
