import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// GET: Consume magic link token → create session → redirect
// If the user already has a valid session, skip session creation and just redirect.
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

  const isSecure = request.url.startsWith('https');
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

  // Check if the user already has a valid session cookie
  const existingCookie = request.cookies.get(cookieName)?.value;
  if (existingCookie) {
    const existingSession = await prisma.session.findUnique({
      where: { sessionToken: existingCookie },
    });
    if (existingSession && existingSession.userId === magicToken.userId && existingSession.expires > new Date()) {
      // Session still valid for this user — just redirect, don't create a new session
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // No valid session — create a new one
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      sessionToken,
      userId: magicToken.userId,
      expires,
    },
  });

  // Set the session cookie and redirect
  const response = NextResponse.redirect(new URL('/', request.url));

  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}
