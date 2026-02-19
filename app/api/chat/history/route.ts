import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_request, user) => {
  // Get today's start (midnight) for filtering
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const messages = await prisma.conversationHistory.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json(messages);
});
