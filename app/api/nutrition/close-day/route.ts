import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(async (request: NextRequest, user) => {
  // Optionally accept a specific date, defaults to today
  const body = await request.json().catch(() => ({}));
  const targetDate = body.date ? new Date(body.date) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get all logs for the target date
  const logs = await prisma.nutritionLog.findMany({
    where: {
      userId: user.id,
      date: { gte: targetDate, lt: nextDay },
    },
  });

  if (logs.length === 0) {
    return NextResponse.json(
      { error: 'No nutrition logs found for this day' },
      { status: 400 }
    );
  }

  // Aggregate totals
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

  // Upsert: create or update the summary for this date
  const summary = await prisma.dailyNutritionSummary.upsert({
    where: {
      userId_date: { userId: user.id, date: targetDate },
    },
    create: {
      userId: user.id,
      date: targetDate,
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      fiberG: totals.fiberG,
      mealCount: logs.length,
    },
    update: {
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      fiberG: totals.fiberG,
      mealCount: logs.length,
    },
  });

  return NextResponse.json(summary);
});
