import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { demoteActiveAndMakeRoom } from '@/lib/social/recreate';

// POST — prep for building a brand-new program: demote the current main to a bench
// slot (and evict the oldest bench if at the cap) so the generator creates a fresh
// active program instead of overwriting the existing main.
export const POST = withAuth(async (_request, user) => {
  await demoteActiveAndMakeRoom(user.id);
  return NextResponse.json({ ok: true });
});
