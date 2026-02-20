import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';

export const PATCH = withAuth(
  async (request: NextRequest, _user, params) => {
    const id = params?.id;
    if (!id) return AuthErrors.notFound('Video');

    const { action } = await request.json();

    if (action === 'approve') {
      await prisma.exerciseVideo.update({
        where: { id },
        data: { status: 'approved', reviewedAt: new Date() },
      });
      return NextResponse.json({ status: 'approved', id });
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
