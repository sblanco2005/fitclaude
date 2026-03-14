import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const DELETE = withAuth(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await prisma.activity.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete activity:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
});

export const GET = withAuth(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '90', 10);

    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const activities = await prisma.activity.findMany({
      where: {
        userId: user.id,
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
});
