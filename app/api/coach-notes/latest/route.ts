import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_request, user) => {
  const note = await prisma.coachNote.findFirst({
    where: { userId: user.id },
    orderBy: { generatedAt: 'desc' },
    select: {
      id: true,
      headline: true,
      body: true,
      tone: true,
      generatedAt: true,
      forDate: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  return NextResponse.json(note);
});
