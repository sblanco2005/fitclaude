import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET — list invited emails (admin only)
export const GET = withAdmin(async () => {
  const emails = await prisma.allowedEmail.findMany({ orderBy: { createdAt: 'desc' } });
  // Annotate whether each invited email has already signed up.
  const registered = await prisma.user.findMany({
    where: { email: { in: emails.map((e) => e.email) } },
    select: { email: true },
  });
  const registeredSet = new Set(registered.map((r) => r.email));
  return NextResponse.json(
    emails.map((e) => ({ id: e.id, email: e.email, createdAt: e.createdAt, joined: registeredSet.has(e.email) })),
  );
});

// POST — invite an email ({ email })
export const POST = withAdmin(async (request, user) => {
  const { email } = await request.json();
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const created = await prisma.allowedEmail.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized, invitedBy: user.id },
    select: { id: true, email: true, createdAt: true },
  });
  return NextResponse.json({ ...created, joined: false }, { status: 201 });
});

// DELETE — revoke an invite (?email=)
export const DELETE = withAdmin(async (request) => {
  const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  await prisma.allowedEmail.deleteMany({ where: { email } });
  return NextResponse.json({ deleted: true });
});
