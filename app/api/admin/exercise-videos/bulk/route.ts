import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';

export const POST = withAdmin(async (request: NextRequest) => {
  const { ids, action } = await request.json();

  if (action === 'delete-all') {
    const count = await prisma.exerciseVideo.deleteMany({});
    return NextResponse.json({ deleted: count.count });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  if (action === 'approve') {
    await prisma.exerciseVideo.updateMany({
      where: { id: { in: ids } },
      data: { status: 'approved', reviewedAt: new Date() },
    });
    return NextResponse.json({ approved: ids.length });
  }

  if (action === 'reject') {
    await prisma.exerciseVideo.updateMany({
      where: { id: { in: ids } },
      data: { status: 'rejected', reviewedAt: new Date() },
    });
    return NextResponse.json({ rejected: ids.length });
  }

  if (action === 'delete') {
    await prisma.exerciseVideo.deleteMany({
      where: { id: { in: ids } },
    });
    return NextResponse.json({ deleted: ids.length });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});
