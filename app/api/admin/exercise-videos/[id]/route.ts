import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/auth/admin';
import { AuthErrors } from '@/lib/auth/middleware';

export const PATCH = withAdmin(
  async (request: NextRequest, _user, params) => {
    const id = params?.id;
    if (!id) return AuthErrors.notFound('Exercise video');

    const { action, videoType } = await request.json();

    if (action === 'approve') {
      await prisma.exerciseVideo.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          ...(videoType && { videoType }),
        },
      });
      return NextResponse.json({ status: 'approved', id, videoType });
    }

    if (action === 'reject') {
      await prisma.exerciseVideo.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: new Date() },
      });
      return NextResponse.json({ status: 'rejected', id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
);

export const DELETE = withAdmin(
  async (_request: NextRequest, _user, params) => {
    const id = params?.id;
    if (!id) return AuthErrors.notFound('Exercise video');

    await prisma.exerciseVideo.delete({ where: { id } });
    return NextResponse.json({ deleted: true, id });
  }
);
