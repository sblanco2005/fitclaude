import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const daysBack = parseInt(searchParams.get('daysBack') || '30', 10);

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  const summaries = await prisma.dailyNutritionSummary.findMany({
    where: {
      userId: user.id,
      date: { gte: since },
    },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(summaries);
});

// DELETE: Remove a daily summary by id
export const DELETE = withAuth(async (request: NextRequest, user) => {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const summary = await prisma.dailyNutritionSummary.findFirst({
    where: { id, userId: user.id },
  });
  if (!summary) {
    return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
  }

  await prisma.dailyNutritionSummary.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id });
});
