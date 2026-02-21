/**
 * Mobile Auth — Token exchange endpoint.
 *
 * POST: Exchange a Google ID token for a FitClaude API token.
 * DELETE: Revoke the current API token (sign out).
 * PATCH: Refresh (extend) the current API token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

const TOKEN_EXPIRY_DAYS = 30;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function tokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TOKEN_EXPIRY_DAYS);
  return d;
}

/**
 * POST /api/auth/mobile
 * Body: { idToken: string } — Google ID token from iOS Sign-In SDK
 * Returns: { token, user }
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    // Verify Google ID token
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!googleRes.ok) {
      return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
    }

    const googleUser = await googleRes.json();
    const { email, name, picture, sub: googleId } = googleUser;

    if (!email) {
      return NextResponse.json({ error: 'No email in Google token' }, { status: 400 });
    }

    // Verify the token was issued for our app
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID;
    if (googleUser.aud !== clientId && googleUser.aud !== iosClientId) {
      return NextResponse.json({ error: 'Token not issued for this app' }, { status: 401 });
    }

    // Find or create user (mirrors NextAuth's adapter behavior)
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          image: picture || null,
          accounts: {
            create: {
              type: 'oauth',
              provider: 'google',
              providerAccountId: googleId,
            },
          },
        },
      });
    }

    // Generate API token
    const token = generateToken();
    await prisma.apiToken.create({
      data: {
        userId: user.id,
        token,
        name: 'ios',
        expiresAt: tokenExpiry(),
      },
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        isOnboarded: user.isOnboarded,
      },
    });
  } catch (error) {
    console.error('[Mobile Auth] Error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/mobile
 * Header: Authorization: Bearer <token>
 * Extends token expiry by TOKEN_EXPIRY_DAYS.
 */
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const apiToken = await prisma.apiToken.findUnique({ where: { token } });

  if (!apiToken || apiToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  await prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { expiresAt: tokenExpiry() },
  });

  return NextResponse.json({ expiresAt: tokenExpiry().toISOString() });
}

/**
 * DELETE /api/auth/mobile
 * Header: Authorization: Bearer <token>
 * Revokes the API token (sign out).
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  try {
    await prisma.apiToken.delete({ where: { token } });
  } catch {
    // Token already deleted or not found — that's fine
  }

  return NextResponse.json({ signedOut: true });
}
