import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

type ReviewedItem = {
  name: string;
  portion?: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  confidence?: string;
};

type PhotoLogBody = {
  description: string;
  mealType?: string | null;
  items: ReviewedItem[];
};

export const POST = withAuth(async (request, user) => {
  const body = (await request.json()) as PhotoLogBody;
  const items = Array.isArray(body.items) ? body.items.filter((item) => item?.name) : [];

  if (!items.length) {
    return NextResponse.json({ error: 'At least one food item is required' }, { status: 400 });
  }

  const cleanItems = items.slice(0, 20).map((item) => ({
    name: String(item.name),
    quantity: 1,
    unit: item.portion || 'serving',
    calories: Math.max(0, Number(item.calories) || 0),
    protein_g: Math.max(0, Number(item.proteinG) || 0),
    carbs_g: Math.max(0, Number(item.carbsG) || 0),
    fat_g: Math.max(0, Number(item.fatG) || 0),
    estimated: true,
    confidence: item.confidence || 'medium',
    source: 'fuel_photo',
  }));

  const totals = cleanItems.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      proteinG: sum.proteinG + item.protein_g,
      carbsG: sum.carbsG + item.carbs_g,
      fatG: sum.fatG + item.fat_g,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const log = await prisma.nutritionLog.create({
    data: {
      userId: user.id,
      date: new Date(),
      mealType: body.mealType || null,
      rawInput: body.description?.trim() || cleanItems.map((item) => item.name).join(', '),
      parsedItems: JSON.stringify(cleanItems),
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
    },
  });

  return NextResponse.json(log);
});
