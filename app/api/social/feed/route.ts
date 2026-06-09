import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

// GET — feed of shared items from people I follow (accepted), newest first (?cursor=)
export const GET = withAuth(async (request, user) => {
  const cursor = new URL(request.url).searchParams.get('cursor') || undefined;

  // Who I follow with an accepted relationship.
  const accepted = await prisma.follow.findMany({
    where: { followerId: user.id, status: 'accepted' },
    select: { followingId: true },
  });
  const followingIds = accepted.map((f) => f.followingId);
  if (followingIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const posts = await prisma.sharePost.findMany({
    where: { userId: { in: followingIds } },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1, // fetch one extra to compute nextCursor
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      itemType: true,
      title: true,
      caption: true,
      recreateCount: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  // Which of these I've already recreated.
  const mine = await prisma.shareRecreation.findMany({
    where: { userId: user.id, sharePostId: { in: page.map((p) => p.id) } },
    select: { sharePostId: true },
  });
  const recreatedSet = new Set(mine.map((r) => r.sharePostId));

  return NextResponse.json({
    items: page.map((p) => ({
      id: p.id,
      itemType: p.itemType,
      title: p.title,
      caption: p.caption,
      recreateCount: p.recreateCount,
      createdAt: p.createdAt,
      sharer: p.user,
      alreadyRecreated: recreatedSet.has(p.id),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});
