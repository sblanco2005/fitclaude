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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isOnboarded: true },
        });
        session.user.isOnboarded = dbUser?.isOnboarded ?? false;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
  },

  debug: process.env.NODE_ENV === 'development',
});
