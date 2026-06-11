/**
 * NextAuth.js v5 Configuration for FitClaude
 *
 * - Google OAuth provider
 * - Database sessions (not JWT)
 * - Prisma adapter
 */

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,

  adapter: PrismaAdapter(prisma),

  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase().trim() ?? '';
      if (!email) return false;

      // Already-registered users can always sign in (never lock out existing accounts).
      // Case-insensitive: stored emails may differ in case from the normalized one.
      const existing = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return true;

      // New users must be invited: present in the DB allowlist...
      const invited = await prisma.allowedEmail.findUnique({ where: { email } });
      if (invited) return true;

      // ...or in the legacy ALLOWED_EMAILS env var (bootstrap).
      const envAllowed = process.env.ALLOWED_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
      return envAllowed.includes(email);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isOnboarded: true, isAdmin: true },
        });
        session.user.isOnboarded = dbUser?.isOnboarded ?? false;
        session.user.isAdmin = dbUser?.isAdmin ?? false;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
  },

  debug: process.env.NODE_ENV === 'development',
});
