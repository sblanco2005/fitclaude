import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

/**
 * GET /api/admin/usage?period=7d
 * Returns aggregated token usage per user for the given period.
 */
export const GET = withAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7d';

  const now = new Date();
  let since: Date;
  switch (period) {
    case '1d':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '30d':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const where = { createdAt: { gte: since } };

  // Aggregate per user
  const usageByUser = await prisma.tokenUsage.groupBy({
    by: ['userId'],
    where,
    _sum: {
      inputTokens: true,
      outputTokens: true,
      cacheCreationTokens: true,
      cacheReadTokens: true,
      estimatedCostUsd: true,
    },
    _count: { id: true },
  });

  // Get user info
  const userIds = usageByUser.map((u) => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, image: true, tier: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  // Get limits
  const limits = await prisma.userUsageLimit.findMany({
    where: { userId: { in: userIds } },
  });
  const limitMap = Object.fromEntries(limits.map((l) => [l.userId, l]));

  const result = usageByUser.map((row) => ({
    userId: row.userId,
    user: userMap[row.userId] || null,
    limits: limitMap[row.userId] || null,
    totalCalls: row._count.id,
    totalInputTokens: row._sum.inputTokens || 0,
    totalOutputTokens: row._sum.outputTokens || 0,
    totalCacheCreationTokens: row._sum.cacheCreationTokens || 0,
    totalCacheReadTokens: row._sum.cacheReadTokens || 0,
    totalCostUsd: row._sum.estimatedCostUsd || 0,
  }));

  // Sort by cost descending
  result.sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  const globalTotals = result.reduce(
    (acc, r) => ({
      totalCalls: acc.totalCalls + r.totalCalls,
      totalCostUsd: acc.totalCostUsd + r.totalCostUsd,
      totalInputTokens: acc.totalInputTokens + r.totalInputTokens,
      totalOutputTokens: acc.totalOutputTokens + r.totalOutputTokens,
    }),
    { totalCalls: 0, totalCostUsd: 0, totalInputTokens: 0, totalOutputTokens: 0 }
  );

  return NextResponse.json({
    users: result,
    totals: globalTotals,
    period,
    since: since.toISOString(),
  });
});
