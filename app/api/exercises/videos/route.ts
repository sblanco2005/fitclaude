import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const muscleGroup = searchParams.get('muscleGroup');

  const where: Record<string, unknown> = {
    videoType: 'reference',
    status: 'approved',
  };

  if (muscleGroup) {
    where.exercise = { muscleGroup };
  }

  const videos = await prisma.exerciseVideo.findMany({
    where,
    include: {
      exercise: {
        select: { id: true, muscleGroup: true, name: true },
      },
    },
    orderBy: [{ viewCount: 'desc' }],
  });

  return NextResponse.json(videos);
}
