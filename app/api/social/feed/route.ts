import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

interface DayPreview { weekday: number; weekNumber: number; dayType: string; dayLabel: string }
interface ExercisePreview { name: string; sets: number; reps: string | null }
interface Preview { days?: DayPreview[]; exercises?: ExercisePreview[] }

// Derive a lightweight preview (day strip for programs, exercise list for routines)
// from the immutable snapshot, so the feed can show "what's inside" without shipping
// the whole snapshot.
function buildPreview(itemType: string, snapshotJson: string): Preview {
  try {
    const s = JSON.parse(snapshotJson);
    if (itemType === 'program' && Array.isArray(s.days)) {
      return {
        days: s.days.map((d: Record<string, unknown>) => ({
          weekday: d.weekday as number,
          weekNumber: d.weekNumber as number,
          dayType: d.dayType as string,
          dayLabel: d.dayLabel as string,
        })),
      };
    }
    if (itemType === 'routine' && Array.isArray(s.exercises)) {
      return {
        exercises: s.exercises.map((e: Record<string, unknown>) => ({
          name: e.name as string,
          sets: (e.sets as number) ?? 0,
          reps: (e.reps as string) ?? null,
        })),
      };
    }
  } catch {
    /* malformed snapshot — no preview */
  }
  return {};
}

// GET — feed of shared items from people I follow (accepted), newest first (?cursor=)
export const GET = withAuth(async (request, user) => {
  const cursor = new URL(request.url).searchParams.get('cursor') || undefined;

  // Who I follow with an accepted relationship.
  const accepted = await prisma.follow.findMany({
    where: { followerId: user.id, status: 'accepted' },
    select: { followingId: true },
  });
  // Feed = shares from people I follow + my own shares (so I can see/manage what I posted).
  const authorIds = [...accepted.map((f) => f.followingId), user.id];

  const posts = await prisma.sharePost.findMany({
    where: { userId: { in: authorIds } },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1, // fetch one extra to compute nextCursor
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      itemType: true,
      title: true,
      caption: true,
      recreateCount: true,
      createdAt: true,
      snapshot: true,
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  // Which of these I've already recreated.
  const mine = await prisma.shareRecreation.findMany({
    where: { userId: user.id, sharePostId: { in: page.map((p) => p.id) } },
    select: { sharePostId: true },
  });
  const recreatedSet = new Set(mine.map((r) => r.sharePostId));

  return NextResponse.json({
    items: page.map((p) => ({
      id: p.id,
      itemType: p.itemType,
      title: p.title,
      caption: p.caption,
      recreateCount: p.recreateCount,
      createdAt: p.createdAt,
      sharer: p.user,
      isOwn: p.user.id === user.id,
      alreadyRecreated: recreatedSet.has(p.id),
      preview: buildPreview(p.itemType, p.snapshot),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});
