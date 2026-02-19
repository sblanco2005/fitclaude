/**
 * Authentication middleware for FitClaude API routes.
 *
 * Every API route must verify user identity.
 * Every database query must filter by userId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
}

/**
 * Get the currently authenticated user from NextAuth session.
 * Throws if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.email) {
    throw new Error('Unauthorized: No active session.');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
    },
  });

  if (!user || !user.email) {
    throw new Error('Unauthorized: User not found.');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}

/**
 * Verify that a workout belongs to the authenticated user.
 */
export async function verifyWorkoutOwnership(workoutId: string, userId: string): Promise<boolean> {
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    select: { id: true },
  });
  return workout !== null;
}

/**
 * Standard error responses.
 */
export const AuthErrors = {
  unauthorized: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),

  forbidden: (message = 'Forbidden') =>
    NextResponse.json({ error: message }, { status: 403 }),

  notFound: (resource = 'Resource') =>
    NextResponse.json({ error: `${resource} not found` }, { status: 404 }),
};

/**
 * Wrapper for authenticated API routes.
 *
 * Usage:
 * export const GET = withAuth(async (request, user) => {
 *   const workouts = await prisma.workout.findMany({ where: { userId: user.id } });
 *   return NextResponse.json(workouts);
 * });
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser, params?: Record<string, string>) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => {
    try {
      const user = await getCurrentUser();
      const params = context?.params ? await context.params : undefined;
      return await handler(request, user, params);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        return AuthErrors.unauthorized();
      }
      console.error('[Auth Middleware] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
