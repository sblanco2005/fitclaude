import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds, getUserTodayStr } from '@/lib/timezone';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('tz') || 'UTC';

  const { start, end } = getUserDayBounds(timezone);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: end },
    },
    orderBy: { date: 'asc' },
  });

  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      proteinG: acc.proteinG + (log.proteinG || 0),
      carbsG: acc.carbsG + (log.carbsG || 0),
      fatG: acc.fatG + (log.fatG || 0),
      fiberG: acc.fiberG + (log.fiberG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );

  // Check if today has already been closed (summary exists)
  const todayStr = getUserTodayStr(timezone);
  const summaryDate = new Date(todayStr + 'T00:00:00Z');
  const summary = await prisma.dailyNutritionSummary.findUnique({
    where: { userId_date: { userId: user.id, date: summaryDate } },
  });

  return NextResponse.json({ logs, totals, closed: !!summary });
});
