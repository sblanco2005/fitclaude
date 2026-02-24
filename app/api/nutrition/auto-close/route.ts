import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds, getUserTodayStr } from '@/lib/timezone';

/**
 * POST /api/nutrition/auto-close
 *
 * Called on page load. Finds any nutrition logs from previous days that
 * haven't been closed into DailyNutritionSummary records and closes them.
 * Uses the user's timezone to determine day boundaries correctly.
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json().catch(() => ({}));
  const timezone = body.timezone || 'UTC';

  // "Today" starts at midnight in user's timezone (as UTC)
  const { start: todayStart } = getUserDayBounds(timezone);

  // Find all nutrition logs BEFORE today in UTC terms
  const oldLogs = await prisma.nutritionLog.findMany({
    where: {
      userId: user.id,
      date: { lt: todayStart },
    },
    orderBy: { date: 'asc' },
  });

  if (oldLogs.length === 0) {
    return NextResponse.json({ closed: 0 });
  }

  // Group logs by their local date in the user's timezone
  const dayGroups: Record<string, typeof oldLogs> = {};
  for (const log of oldLogs) {
    let dateKey: string;
    try {
      dateKey = log.date.toLocaleDateString('en-CA', { timeZone: timezone });
    } catch {
      dateKey = log.date.toISOString().split('T')[0];
    }
    if (!dayGroups[dateKey]) dayGroups[dateKey] = [];
    dayGroups[dateKey].push(log);
  }

  // For each day group, check if a summary already exists; if not, create one
  let closedCount = 0;
  for (const [dateKey, logs] of Object.entries(dayGroups)) {
    const summaryDate = new Date(dateKey + 'T00:00:00Z');

    const existingSummary = await prisma.dailyNutritionSummary.findFirst({
      where: {
        userId: user.id,
        date: summaryDate,
      },
    });

    if (existingSummary) continue;

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

    await prisma.dailyNutritionSummary.create({
      data: {
        userId: user.id,
        date: summaryDate,
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
        fiberG: totals.fiberG,
        mealCount: logs.length,
      },
    });

    closedCount++;
  }

  return NextResponse.json({ closed: closedCount });
});
