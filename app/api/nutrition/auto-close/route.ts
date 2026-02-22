import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/nutrition/auto-close
 *
 * Called on page load. Finds any nutrition logs from previous days that
 * haven't been closed into DailyNutritionSummary records and closes them.
 * This ensures that when a user connects the next day, yesterday's logs
 * are properly archived to history and today starts fresh.
 *
 * Accepts optional { timezone } in body to determine "today" correctly.
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json().catch(() => ({}));
  const timezone = body.timezone || 'UTC';

  // Determine "today" in the user's timezone
  const now = new Date();
  let todayStr: string;
  try {
    todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // "YYYY-MM-DD"
  } catch {
    todayStr = now.toISOString().split('T')[0];
  }
  const todayStart = new Date(todayStr + 'T00:00:00');

  // Find all nutrition logs BEFORE today that don't have a matching summary
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

  // Group logs by date (YYYY-MM-DD)
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
    const dayDate = new Date(dateKey + 'T00:00:00');

    const existingSummary = await prisma.dailyNutritionSummary.findFirst({
      where: {
        userId: user.id,
        date: dayDate,
      },
    });

    if (existingSummary) continue; // Already closed

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
        date: dayDate,
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
