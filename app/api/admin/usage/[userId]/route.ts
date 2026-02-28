import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

/**
 * GET /api/admin/usage/[userId]?days=30
 * Returns detailed usage breakdown for a specific user.
 */
export const GET = withAdmin(async (request: NextRequest, _user, params) => {
  const userId = params?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Raw usage records
  const usageRecords = await prisma.tokenUsage.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate by day
  const byDay: Record<string, {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }> = {};

  for (const record of usageRecords) {
    const day = record.createdAt.toISOString().split('T')[0];
    if (!byDay[day]) {
      byDay[day] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }
    byDay[day].calls++;
    byDay[day].inputTokens += record.inputTokens;
    byDay[day].outputTokens += record.outputTokens;
    byDay[day].costUsd += record.estimatedCostUsd;
  }

  // User info and limits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  const limits = await prisma.userUsageLimit.findUnique({
    where: { userId },
  });

  // Aggregate by endpoint
  const byEndpoint: Record<string, { calls: number; costUsd: number }> = {};
  for (const record of usageRecords) {
    if (!byEndpoint[record.endpoint]) {
      byEndpoint[record.endpoint] = { calls: 0, costUsd: 0 };
    }
    byEndpoint[record.endpoint].calls++;
    byEndpoint[record.endpoint].costUsd += record.estimatedCostUsd;
  }

  return NextResponse.json({
    user,
    limits,
    dailyBreakdown: Object.entries(byDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    byEndpoint,
    totalRecords: usageRecords.length,
  });
});
