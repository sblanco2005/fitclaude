import { NextRequest, NextResponse } from 'next/server';

// PrismaClient cannot run in Edge Runtime, so we cannot use the full auth()
// middleware here. Auth protection and onboarding redirects are handled
// client-side via useSession() + useEffect in each page.
// This middleware only protects unauthenticated users from API routes.
export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Session cookie name used by NextAuth v5 with database sessions
  const sessionCookie =
    req.cookies.get('authjs.session-token') ||
    req.cookies.get('__Secure-authjs.session-token');

  const isPublicPath =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  if (isPublicPath) return NextResponse.next();

  // Redirect unauthenticated users away from protected pages
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/auth/signin', req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
