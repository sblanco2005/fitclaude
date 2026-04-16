import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildWeekSnapshot } from '@/lib/coach/weekSnapshot';
import { generateCoachNote } from '@/lib/coach/generateCoachNote';
import { resolveLocalDayParts, localMidnightToUtc, weekBounds } from '@/lib/dates';

export const maxDuration = 60;

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Active users = anyone with a workout or activity in the last 14 days, OR any user at all (small user base).
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { workouts: { some: { date: { gte: cutoff } } } },
        { activities: { some: { date: { gte: cutoff } } } },
      ],
    },
    select: { id: true, timezone: true },
  });

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const u of users) {
    try {
      const tz = u.timezone || 'UTC';
      const snapshot = await buildWeekSnapshot(u.id, tz);
      const note = await generateCoachNote(snapshot);

      const local = resolveLocalDayParts(tz);
      const forDate = localMidnightToUtc(local, tz);
      const { thisWeekStart, thisWeekEnd } = weekBounds(tz);

      await prisma.coachNote.upsert({
        where: { userId_forDate: { userId: u.id, forDate } },
        create: {
          userId: u.id,
          forDate,
          headline: note.headline,
          body: note.body,
          tone: note.tone,
          snapshot: JSON.stringify(snapshot),
          periodStart: thisWeekStart,
          periodEnd: thisWeekEnd,
        },
        update: {
          headline: note.headline,
          body: note.body,
          tone: note.tone,
          snapshot: JSON.stringify(snapshot),
          periodStart: thisWeekStart,
          periodEnd: thisWeekEnd,
          generatedAt: new Date(),
        },
      });

      results.push({ userId: u.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[coach-notes] Failed for user ${u.id}:`, msg);
      results.push({ userId: u.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    count: users.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
