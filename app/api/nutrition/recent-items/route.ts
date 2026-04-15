import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

type ParsedItem = {
  name?: string;
  quantity?: number;
  unit?: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

export type RecentItem = {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  lastUsed: string;
  useCount: number;
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const days = Math.max(1, Math.min(14, parseInt(searchParams.get('days') || '2')));
  const limit = Math.max(1, Math.min(60, parseInt(searchParams.get('limit') || '30')));

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      userId: user.id,
      date: { gte: cutoff },
      parsedItems: { not: null },
    },
    orderBy: { date: 'desc' },
    select: { parsedItems: true, date: true },
  });

  const map = new Map<string, RecentItem>();

  for (const log of logs) {
    if (!log.parsedItems) continue;
    let items: ParsedItem[];
    try {
      const parsed = JSON.parse(log.parsedItems);
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      continue;
    }

    for (const it of items) {
      const name = (it.name || '').trim();
      if (!name) continue;
      // Skip items we can't log meaningfully
      if (it.calories == null) continue;

      const key = normalize(name);
      const existing = map.get(key);
      if (existing) {
        existing.useCount += 1;
        // Keep the most recent version's macros but bump useCount
        continue;
      }
      map.set(key, {
        key,
        name,
        quantity: it.quantity ?? 1,
        unit: it.unit ?? 'serving',
        calories: it.calories ?? null,
        proteinG: it.protein_g ?? null,
        carbsG: it.carbs_g ?? null,
        fatG: it.fat_g ?? null,
        lastUsed: log.date.toISOString(),
        useCount: 1,
      });
    }
  }

  const items = Array.from(map.values())
    .sort((a, b) => {
      // Most recent first, ties broken by use count
      const d = new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
      if (d !== 0) return d;
      return b.useCount - a.useCount;
    })
    .slice(0, limit);

  return NextResponse.json({ items });
});
