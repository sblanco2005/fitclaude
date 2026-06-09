import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — incoming pending follow requests (people who want to follow me)
export const GET = withAuth(async (_request, user) => {
  const requests = await prisma.follow.findMany({
    where: { followingId: user.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      follower: { select: { id: true, name: true, username: true, image: true } },
    },
  });
  return NextResponse.json(requests);
});

// POST — accept or decline a pending request ({ followId, accept })
export const POST = withAuth(async (request, user) => {
  const { followId, accept } = await request.json();
  if (!followId || typeof followId !== 'string') {
    return NextResponse.json({ error: 'followId required' }, { status: 400 });
  }

  // Only the target of the request (the followee) may act on it.
  const follow = await prisma.follow.findFirst({
    where: { id: followId, followingId: user.id, status: 'pending' },
    select: { id: true },
  });
  if (!follow) return AuthErrors.notFound('Follow request');

  if (accept) {
    await prisma.follow.update({ where: { id: follow.id }, data: { status: 'accepted' } });
    return NextResponse.json({ status: 'accepted' });
  }
  await prisma.follow.delete({ where: { id: follow.id } });
  return NextResponse.json({ status: 'declined' });
});
