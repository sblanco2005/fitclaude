import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { getUserDayBounds } from '@/lib/timezone';

// ─── Open Food Facts helpers ─────────────────────────────────────────────────

interface OFFNutriments {
  'energy-kcal_serving'?: number;
  'energy-kcal_100g'?: number;
  proteins_serving?: number;
  proteins_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates_100g?: number;
  fat_serving?: number;
  fat_100g?: number;
}

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  serving_size?: string;
  nutriments?: OFFNutriments;
}

function mapOFFToFood(product: OFFProduct, barcode: string) {
  const n = product.nutriments || {};
  const hasServing = !!product.serving_size;

  return {
    name: product.product_name || product.product_name_en || 'Unknown Product',
    calories: Math.round(
      (hasServing ? (n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0) : (n['energy-kcal_100g'] ?? 0)) * 10
    ) / 10,
    proteinG: Math.round(
      (hasServing ? (n.proteins_serving ?? n.proteins_100g ?? 0) : (n.proteins_100g ?? 0)) * 10
    ) / 10,
    carbsG: Math.round(
      (hasServing ? (n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0) : (n.carbohydrates_100g ?? 0)) * 10
    ) / 10,
    fatG: Math.round(
      (hasServing ? (n.fat_serving ?? n.fat_100g ?? 0) : (n.fat_100g ?? 0)) * 10
    ) / 10,
    servingUnit: product.serving_size || '100g',
    barcode,
  };
}

// ─── GET: Look up barcode via Open Food Facts ────────────────────────────────

export const GET = withAuth(async (request: NextRequest) => {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing barcode' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!res.ok) {
      return NextResponse.json({ found: false, barcode: code }, { status: 404 });
    }

    const data = await res.json();
    if (data.status !== 1 || !data.product?.nutriments) {
      return NextResponse.json({ found: false, barcode: code }, { status: 404 });
    }

    const food = mapOFFToFood(data.product, code);

    // Skip if all macros are zero (incomplete data)
    if (food.calories === 0 && food.proteinG === 0 && food.carbsG === 0 && food.fatG === 0) {
      return NextResponse.json({ found: false, barcode: code }, { status: 404 });
    }

    return NextResponse.json({ found: true, food });
  } catch {
    // Timeout or network error — treat as not found
    return NextResponse.json({ found: false, barcode: code }, { status: 404 });
  }
});

// ─── POST: Log food from barcode (found or manual entry) ────────────────────

export const POST = withAuth(async (request: NextRequest, user) => {
  const body = await request.json();
  const { name, calories, proteinG, carbsG, fatG, servingUnit, timezone = 'UTC' } = body;

  if (!name || calories == null || proteinG == null) {
    return NextResponse.json(
      { error: 'Requires: name, calories, proteinG' },
      { status: 400 }
    );
  }

  const qty = Number(body.quantity) || 1;
  const perCal = Number(calories);
  const perPro = Number(proteinG);
  const perCarbs = Number(carbsG || 0);
  const perFat = Number(fatG || 0);

  const totalCal = Math.round(perCal * qty * 10) / 10;
  const totalPro = Math.round(perPro * qty * 10) / 10;
  const totalCarbs = Math.round(perCarbs * qty * 10) / 10;
  const totalFat = Math.round(perFat * qty * 10) / 10;

  // Persist a single parsed item so the Recent Items view can surface this
  // scanned product without the user rescanning.
  const parsedItems = JSON.stringify([
    {
      name,
      quantity: qty,
      unit: servingUnit || 'serving',
      calories: totalCal,
      protein_g: totalPro,
      carbs_g: totalCarbs,
      fat_g: totalFat,
      estimated: true,
    },
  ]);

  const log = await prisma.nutritionLog.create({
    data: {
      userId: user.id,
      date: new Date(),
      rawInput: `${qty === 1 ? '' : qty + 'x '}${name}`,
      parsedItems,
      calories: totalCal,
      proteinG: totalPro,
      carbsG: totalCarbs,
      fatG: totalFat,
    },
  });

  // Get daily totals
  const { start, end } = getUserDayBounds(timezone);
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
      name,
      calories: Math.round(perCal * qty * 10) / 10,
      proteinG: Math.round(perPro * qty * 10) / 10,
      carbsG: Math.round(perCarbs * qty * 10) / 10,
      fatG: Math.round(perFat * qty * 10) / 10,
      servingUnit: servingUnit || 'serving',
    },
    quantity: qty,
    logId: log.id,
    dailyTotals: totals,
  });
});
