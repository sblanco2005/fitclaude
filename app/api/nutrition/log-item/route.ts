import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

type ItemBody = {
  name: string;
  quantity?: number;
  unit?: string;
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  mealType?: string | null;
};

export const POST = withAuth(async (request, user) => {
  const body = (await request.json()) as ItemBody;

  if (!body?.name || typeof body.calories !== 'number') {
    return NextResponse.json(
      { error: 'name and calories are required' },
      { status: 400 }
    );
  }

  const quantity = body.quantity ?? 1;
  const unit = body.unit ?? 'serving';
  const label = quantity !== 1 || unit !== 'serving'
    ? `${quantity} ${unit} ${body.name}`
    : body.name;

  // Persist parsedItems in the same shape the nutrition agent emits so the
  // recent-items endpoint can pick it up uniformly.
  const parsedItems = JSON.stringify([
    {
      name: body.name,
      quantity,
      unit,
      calories: body.calories,
      protein_g: body.proteinG ?? null,
      carbs_g: body.carbsG ?? null,
      fat_g: body.fatG ?? null,
      estimated: true,
    },
  ]);

  const log = await prisma.nutritionLog.create({
    data: {
      userId: user.id,
      date: new Date(),
      mealType: body.mealType ?? null,
      rawInput: label,
      parsedItems,
      calories: body.calories,
      proteinG: body.proteinG ?? null,
      carbsG: body.carbsG ?? null,
      fatG: body.fatG ?? null,
    },
  });

  return NextResponse.json(log);
});
