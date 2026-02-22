import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthErrors } from '@/lib/auth/middleware';

const BACKEND_URL =
  process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';

export const POST = withAuth(
  async (_request: NextRequest, _user, params) => {
    const id = params?.id;
    if (!id) return AuthErrors.notFound('Exercise');

    const exercise = await prisma.exercise.findUnique({ where: { id } });
    if (!exercise) return AuthErrors.notFound('Exercise');

    try {
      const { searchParams } = new URL(_request.url);
      const force = searchParams.get('force') === 'true';
      const resp = await fetch(
        `${BACKEND_URL}/api/exercises/${id}/search-videos${force ? '?force=true' : ''}`,
        { method: 'POST' }
      );

      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json(
          { error: `Backend error: ${text}` },
          { status: resp.status }
        );
      }

      const data = await resp.json();
      return NextResponse.json(data);
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to reach backend: ${error}` },
        { status: 502 }
      );
    }
  }
);
