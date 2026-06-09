import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { recreateRoutine, recreateProgram, ProgramCapReachedError, MAX_PROGRAMS_PER_USER } from '@/lib/social/recreate';
import type { RoutineSnapshot, ProgramSnapshot } from '@/lib/social/snapshot';

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

  // Can't recreate your own post; only recreate once per post.
  if (post.userId === user.id) {
    return AuthErrors.forbidden('You cannot recreate your own share');
  }
  const existing = await prisma.shareRecreation.findUnique({
    where: { sharePostId_userId: { sharePostId, userId: user.id } },
    select: { newItemId: true },
  });
  if (existing) {
    return NextResponse.json({ newItemId: existing.newItemId, alreadyRecreated: true });
  }

  const snapshot = JSON.parse(post.snapshot);

  let newItemId: string;
  try {
    if (post.itemType === 'program') {
      newItemId = await recreateProgram(user.id, snapshot as ProgramSnapshot, {
        sourceUserId: post.userId,
        sourceShareId: post.id,
      });
    } else {
      newItemId = await recreateRoutine(user.id, snapshot as RoutineSnapshot);
    }
  } catch (err) {
    if (err instanceof ProgramCapReachedError) {
      return NextResponse.json(
        { error: 'capReached', limit: MAX_PROGRAMS_PER_USER, code: 'capReached' },
        { status: 409 },
      );
    }
    throw err;
  }

  // Record the recreation and bump the post's counter.
  await prisma.$transaction([
    prisma.shareRecreation.create({ data: { sharePostId, userId: user.id, newItemId } }),
    prisma.sharePost.update({ where: { id: sharePostId }, data: { recreateCount: { increment: 1 } } }),
  ]);

  return NextResponse.json({ newItemId, itemType: post.itemType }, { status: 201 });
});
