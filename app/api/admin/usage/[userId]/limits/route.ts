import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

/**
 * PATCH /api/admin/usage/[userId]/limits
 * Upserts rate limits for a user.
 */
export const PATCH = withAdmin(async (request: NextRequest, _user, params) => {
  const userId = params?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // Verify user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json();
  const {
    maxCallsPerDay,
    maxCallsPerWeek,
    maxCallsPerMonth,
    maxCostPerMonth,
    isThrottled,
  } = body;

  const limits = await prisma.userUsageLimit.upsert({
    where: { userId },
    update: {
      ...(maxCallsPerDay !== undefined && { maxCallsPerDay }),
      ...(maxCallsPerWeek !== undefined && { maxCallsPerWeek }),
      ...(maxCallsPerMonth !== undefined && { maxCallsPerMonth }),
      ...(maxCostPerMonth !== undefined && { maxCostPerMonth }),
      ...(isThrottled !== undefined && { isThrottled }),
    },
    create: {
      userId,
      maxCallsPerDay: maxCallsPerDay ?? null,
      maxCallsPerWeek: maxCallsPerWeek ?? null,
      maxCallsPerMonth: maxCallsPerMonth ?? null,
      maxCostPerMonth: maxCostPerMonth ?? null,
      isThrottled: isThrottled ?? false,
    },
  });

  return NextResponse.json(limits);
});
