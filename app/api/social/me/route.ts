import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — my social profile summary (username + follower/following/pending counts)
export const GET = withAuth(async (_request, user) => {
  const [me, followers, following, pendingCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { username: true, bio: true, isPublic: true } }),
    prisma.follow.count({ where: { followingId: user.id, status: 'accepted' } }),
    prisma.follow.count({ where: { followerId: user.id, status: 'accepted' } }),
    prisma.follow.count({ where: { followingId: user.id, status: 'pending' } }),
  ]);

  return NextResponse.json({
    username: me?.username ?? null,
    bio: me?.bio ?? null,
    isPublic: me?.isPublic ?? true,
    followers,
    following,
    pendingCount,
  });
});
