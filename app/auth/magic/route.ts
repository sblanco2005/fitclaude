import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// GET: Consume magic link token → create session → redirect to /
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  const magicToken = await prisma.magicLinkToken.findUnique({
    where: { token },
  });

  if (!magicToken || magicToken.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/auth/signin?error=expired', request.url));
  }

  // Create a NextAuth-compatible database session
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      sessionToken,
      userId: magicToken.userId,
      expires,
    },
  });

  // Set the session cookie and redirect to home
  const response = NextResponse.redirect(new URL('/', request.url));
  const isSecure = request.url.startsWith('https');

  response.cookies.set('authjs.session-token', sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}
