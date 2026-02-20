import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

export const GET = withAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;

  const where = status ? { status } : {};

  const videos = await prisma.exerciseVideo.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(videos);
});
