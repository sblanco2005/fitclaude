import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { recreateSharePost, ProgramCapReachedError, MAX_PROGRAMS_PER_USER } from '@/lib/social/recreate';

// POST — recreate a shared item into my account ({ sharePostId })
export const POST = withAuth(async (request, user) => {
  const { sharePostId } = await request.json();
  if (!sharePostId || typeof sharePostId !== 'string') {
    return NextResponse.json({ error: 'sharePostId required' }, { status: 400 });
  }

  const post = await prisma.sharePost.findUnique({
    where: { id: sharePostId },
    select: { id: true, userId: true, itemType: true, snapshot: true },
  });
  if (!post) return AuthErrors.notFound('Shared item');

  // Can't recreate your own post.
  if (post.userId === user.id) {
    return AuthErrors.forbidden('You cannot recreate your own share');
  }

  // Must follow (accepted) the author — matches the follow-gated feed visibility.
  const follows = await prisma.follow.findFirst({
    where: { followerId: user.id, followingId: post.userId, status: 'accepted' },
    select: { id: true },
  });
  if (!follows) {
    return AuthErrors.forbidden('You must follow this user to add their share');
  }

  try {
    const { newItemId, alreadyRecreated } = await recreateSharePost(user.id, post);
    return NextResponse.json({ newItemId, itemType: post.itemType, alreadyRecreated }, { status: alreadyRecreated ? 200 : 201 });
  } catch (err) {
    if (err instanceof ProgramCapReachedError) {
      return NextResponse.json(
        { error: 'capReached', limit: MAX_PROGRAMS_PER_USER, code: 'capReached' },
        { status: 409 },
      );
    }
    throw err;
  }
});
