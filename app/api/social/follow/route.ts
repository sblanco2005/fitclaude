import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// POST — request to follow a user (approval-based; starts as "pending")
export const POST = withAuth(async (request, user) => {
  const { followingId } = await request.json();
  if (!followingId || typeof followingId !== 'string') {
    return NextResponse.json({ error: 'followingId required' }, { status: 400 });
  }
  if (followingId === user.id) {
    return AuthErrors.forbidden('You cannot follow yourself');
  }

  const target = await prisma.user.findUnique({ where: { id: followingId }, select: { id: true } });
  if (!target) return AuthErrors.notFound('User');

  // Idempotent: re-requesting returns the existing row's status.
  const follow = await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: user.id, followingId } },
    update: {},
    create: { followerId: user.id, followingId, status: 'pending' },
    select: { status: true },
  });

  return NextResponse.json({ status: follow.status });
});

// DELETE — unfollow or cancel a pending request
export const DELETE = withAuth(async (request, user) => {
  const { followingId } = await request.json();
  if (!followingId || typeof followingId !== 'string') {
    return NextResponse.json({ error: 'followingId required' }, { status: 400 });
  }

  await prisma.follow.deleteMany({ where: { followerId: user.id, followingId } });
  return NextResponse.json({ status: 'none' });
});
