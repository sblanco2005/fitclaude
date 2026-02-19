import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_request, user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      userId: user.id,
      date: { gte: today, lt: tomorrow },
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

  return NextResponse.json({ logs, totals });
});
