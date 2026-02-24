import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds } from '@/lib/timezone';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);
  const timezone = searchParams.get('tz') || 'UTC';

  let where: Record<string, unknown>;

  if (dateStr) {
    // Fetch logs for a specific date in user's timezone
    const { start, end } = getUserDayBounds(timezone, dateStr);
    where = { userId: user.id, date: { gte: start, lt: end } };
  } else {
    // Fetch logs for the last N days
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);
    const sinceStr = sinceDate.toLocaleDateString('en-CA', { timeZone: timezone });
    const { start } = getUserDayBounds(timezone, sinceStr);
    where = { userId: user.id, date: { gte: start } };
  }

  const logs = await prisma.nutritionLog.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return NextResponse.json(logs);
});

// POST: Copy all logs from a past date to today
// Body: { date, timezone, mode: "append" | "replace" }
export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json();
  const { date: sourceDate, timezone = 'UTC', mode = 'append' } = body;
  if (!sourceDate) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  const { start, end } = getUserDayBounds(timezone, sourceDate);

  const sourceLogs = await prisma.nutritionLog.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });

  if (sourceLogs.length === 0) {
    return NextResponse.json({ error: 'No logs found for that date' }, { status: 404 });
  }

  const now = new Date();

  // If replace mode, delete today's existing logs first
  if (mode === 'replace') {
    const { start: todayStart, end: todayEnd } = getUserDayBounds(timezone);
    await prisma.nutritionLog.deleteMany({
      where: { userId: user.id, date: { gte: todayStart, lt: todayEnd } },
    });
  }

  const created = await prisma.$transaction(
    sourceLogs.map((log) =>
      prisma.nutritionLog.create({
        data: {
          userId: user.id,
          date: now,
          mealType: log.mealType,
          rawInput: log.rawInput,
          calories: log.calories,
          proteinG: log.proteinG,
          carbsG: log.carbsG,
          fatG: log.fatG,
          fiberG: log.fiberG,
        },
      })
    )
  );

  return NextResponse.json({ copied: created.length });
});
