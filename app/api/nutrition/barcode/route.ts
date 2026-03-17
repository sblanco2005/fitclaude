import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds } from '@/lib/timezone';

/**
 * GET /api/nutrition/barcode?code=123456789
 * Look up a barcode in the user's food database.
 * Returns the food if found, 404 if not.
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing barcode' }, { status: 400 });
  }

  const food = await prisma.userFood.findFirst({
    where: { userId: user.id, barcode: code },
  });

  if (!food) {
    return NextResponse.json({ found: false, barcode: code }, { status: 404 });
  }

  return NextResponse.json({
    found: true,
    food: {
      id: food.id,
      name: food.name,
      servingAmount: food.servingAmount,
      servingUnit: food.servingUnit,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fiberG: food.fiberG,
      barcode: food.barcode,
    },
  });
});

/**
 * POST /api/nutrition/barcode
 * Auto-log a known barcode OR register a new food with barcode.
 *
 * Body for auto-log (barcode exists):
 *   { barcode: "123", quantity: 2, timezone: "America/New_York" }
 *
 * Body for new food registration:
 *   { barcode: "123", name: "Product Name", calories: 200, proteinG: 30,
 *     carbsG: 10, fatG: 5, servingUnit: "bar", timezone: "America/New_York" }
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json();
  const { barcode, timezone = 'UTC' } = body;

  if (!barcode) {
    return NextResponse.json({ error: 'Missing barcode' }, { status: 400 });
  }

  // Check if barcode exists
  let food = await prisma.userFood.findFirst({
    where: { userId: user.id, barcode },
  });

  // New food registration
  if (!food) {
    const { name, calories, proteinG, carbsG, fatG, fiberG, servingUnit } = body;
    if (!name || calories == null || proteinG == null) {
      return NextResponse.json(
        { error: 'New food requires: name, calories, proteinG, carbsG, fatG' },
        { status: 400 }
      );
    }

    food = await prisma.userFood.create({
      data: {
        userId: user.id,
        name,
        servingAmount: 1,
        servingUnit: servingUnit || 'serving',
        calories: Number(calories),
        proteinG: Number(proteinG),
        carbsG: Number(carbsG || 0),
        fatG: Number(fatG || 0),
        fiberG: fiberG != null ? Number(fiberG) : null,
        barcode,
        timesUsed: 0,
      },
    });
  }

  // Auto-log the food
  const qty = Number(body.quantity) || 1;
  const { start, end } = getUserDayBounds(timezone);

  const log = await prisma.nutritionLog.create({
    data: {
      userId: user.id,
      date: new Date(),
      rawInput: `${qty === 1 ? '' : qty + 'x '}${food.name}`,
      calories: Math.round(food.calories * qty * 10) / 10,
      proteinG: Math.round(food.proteinG * qty * 10) / 10,
      carbsG: Math.round(food.carbsG * qty * 10) / 10,
      fatG: Math.round(food.fatG * qty * 10) / 10,
      fiberG: food.fiberG ? Math.round(food.fiberG * qty * 10) / 10 : null,
    },
  });

  // Increment times_used
  await prisma.userFood.update({
    where: { id: food.id },
    data: { timesUsed: { increment: 1 } },
  });

  // Get daily totals
  const todayLogs = await prisma.nutritionLog.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
  });
  const totals = todayLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      proteinG: acc.proteinG + (l.proteinG || 0),
      carbsG: acc.carbsG + (l.carbsG || 0),
      fatG: acc.fatG + (l.fatG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return NextResponse.json({
    logged: true,
    food: {
      name: food.name,
      calories: Math.round(food.calories * qty * 10) / 10,
      proteinG: Math.round(food.proteinG * qty * 10) / 10,
      carbsG: Math.round(food.carbsG * qty * 10) / 10,
      fatG: Math.round(food.fatG * qty * 10) / 10,
    },
    quantity: qty,
    logId: log.id,
    dailyTotals: totals,
  });
});
