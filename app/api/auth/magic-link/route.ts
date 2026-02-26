import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// POST: Generate a magic link token for the authenticated user
export const POST = withAuth(async (_request: NextRequest, user) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  // Upsert — one active token per user (userId is @unique)
  await prisma.magicLinkToken.upsert({
    where: { userId: user.id },
    create: { token, userId: user.id, expiresAt },
    update: { token, expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://fitclaude.com';
  const url = `${baseUrl}/auth/magic?token=${token}`;

  return NextResponse.json({ url });
});
