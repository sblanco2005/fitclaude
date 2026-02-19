import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      userId: user.id,
      date: { gte: since },
    },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(logs);
});
