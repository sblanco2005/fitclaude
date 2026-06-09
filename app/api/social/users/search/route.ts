import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — search discoverable users by username or name (?q=)
export const GET = withAuth(async (request, user) => {
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 2) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      isPublic: true,
      id: { not: user.id },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, username: true, image: true },
    take: 20,
  });

  // Annotate each with my follow state toward them.
  const follows = await prisma.follow.findMany({
    where: { followerId: user.id, followingId: { in: users.map((u) => u.id) } },
    select: { followingId: true, status: true },
  });
  const stateById = new Map(follows.map((f) => [f.followingId, f.status]));

  return NextResponse.json(
    users.map((u) => ({ ...u, followState: stateById.get(u.id) ?? 'none' })),
  );
});
