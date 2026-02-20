/**
 * Admin-only auth wrapper for API routes.
 * Extends withAuth to also check isAdmin on the User record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, AuthErrors, AuthenticatedUser } from './middleware';

export function withAdmin(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    params?: Record<string, string>
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const user = await getCurrentUser();

      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true },
      });

      if (!fullUser?.isAdmin) {
        return AuthErrors.forbidden('Admin access required');
      }

      const params = context?.params ? await context.params : undefined;
      return await handler(request, user, params);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return AuthErrors.unauthorized();
      }
      console.error('[Admin Middleware] Error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
