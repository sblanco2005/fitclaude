import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic') || 'workout';

  // Get today's start (midnight) for filtering
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const messages = await prisma.conversationHistory.findMany({
    where: {
      userId: user.id,
      topic,
      createdAt: { gte: todayStart },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      topic: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json(messages);
});
