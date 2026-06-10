import { NextResponse } from 'next/server';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { buildRoutineSnapshot, buildProgramSnapshot, snapshotTitle } from '@/lib/social/snapshot';

// POST — share a routine or program with my followers ({ itemType, sourceId, caption })
export const POST = withAuth(async (request, user) => {
  const { itemType, sourceId, caption } = await request.json();

  if (itemType !== 'routine' && itemType !== 'program') {
    return NextResponse.json({ error: 'itemType must be "routine" or "program"' }, { status: 400 });
  }
  if (!sourceId || typeof sourceId !== 'string') {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }
  // A comment is required to share.
  if (typeof caption !== 'string' || !caption.trim()) {
    return NextResponse.json({ error: 'Please add a comment to share.' }, { status: 400 });
  }

  // Build an immutable snapshot from the source the user owns.
  const snapshot =
    itemType === 'routine'
      ? await buildRoutineSnapshot(sourceId, user.id)
      : await buildProgramSnapshot(sourceId, user.id);

  if (!snapshot) {
    return AuthErrors.notFound(itemType === 'routine' ? 'Routine' : 'Program');
  }

  const post = await prisma.sharePost.create({
    data: {
      userId: user.id,
      itemType,
      title: snapshotTitle(snapshot),
      caption: caption.trim(),
      snapshot: JSON.stringify(snapshot),
      sourceId,
    },
    select: { id: true, title: true, itemType: true, createdAt: true },
  });

  return NextResponse.json(post, { status: 201 });
});

// DELETE — remove one of my own shares (?id=). Cascades to its recreations records.
export const DELETE = withAuth(async (request, user) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const post = await prisma.sharePost.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!post) return AuthErrors.notFound('Share');

  await prisma.sharePost.delete({ where: { id: post.id } });
  return NextResponse.json({ deleted: true });
});
