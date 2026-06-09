import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET — all of my training programs (active + recreated), for the programs manager
export const GET = withAuth(async (_request, user) => {
  const programs = await prisma.trainingProgram.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      isActive: true,
      totalWeeks: true,
      currentWeek: true,
      sourceUserId: true,
      createdAt: true,
      _count: { select: { days: true } },
    },
  });

  // Resolve sharer display names for recreated programs.
  const sourceIds = [...new Set(programs.map((p) => p.sourceUserId).filter((x): x is string => !!x))];
  const sources = sourceIds.length
    ? await prisma.user.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true, username: true } })
    : [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return NextResponse.json(
    programs.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      totalWeeks: p.totalWeeks,
      currentWeek: p.currentWeek,
      dayCount: p._count.days,
      source: p.sourceUserId ? sourceById.get(p.sourceUserId) ?? null : null,
    })),
  );
});
