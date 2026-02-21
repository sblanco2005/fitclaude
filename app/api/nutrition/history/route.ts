import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);

  let where: Record<string, unknown>;

  if (dateStr) {
    // Fetch logs for a specific date
    const start = new Date(dateStr + 'T00:00:00');
    const end = new Date(dateStr + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    where = { userId: user.id, date: { gte: start, lt: end } };
  } else {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    since.setHours(0, 0, 0, 0);
    where = { userId: user.id, date: { gte: since } };
  }

  const logs = await prisma.nutritionLog.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return NextResponse.json(logs);
});

// POST: Copy all logs from a past date to today
export const POST = withAuth(async (request: NextRequest, user) => {
  const { date: sourceDate } = await request.json();
  if (!sourceDate) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  const start = new Date(sourceDate + 'T00:00:00');
  const end = new Date(sourceDate + 'T00:00:00');
  end.setDate(end.getDate() + 1);

  const sourceLogs = await prisma.nutritionLog.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });

  if (sourceLogs.length === 0) {
    return NextResponse.json({ error: 'No logs found for that date' }, { status: 404 });
  }

  const now = new Date();
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
