import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

const VALID_TIERS = ['free', 'pro', 'unlimited'] as const;

/**
 * PATCH /api/admin/usage/[userId]/tier
 * Sets the tier (free/pro/unlimited) for a user.
 */
export const PATCH = withAdmin(async (request: NextRequest, _user, params) => {
  const userId = params?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const body = await request.json();
  const { tier } = body;

  if (!tier || !VALID_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { tier },
    select: { id: true, name: true, email: true, tier: true },
  });

  return NextResponse.json(user);
});
