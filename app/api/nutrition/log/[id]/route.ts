import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import { extractFoodInfo } from '@/lib/nutrition';

export const PATCH = withAuth(async (request: NextRequest, user, params) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Missing log ID' }, { status: 400 });
  }

  // Verify the log belongs to this user
  const log = await prisma.nutritionLog.findFirst({
    where: { id, userId: user.id },
  });
  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }

  const body = await request.json();
  const { rawInput, calories, proteinG, carbsG, fatG, fiberG, mealType } = body;

  const updated = await prisma.nutritionLog.update({
    where: { id },
    data: {
      ...(rawInput !== undefined && { rawInput }),
      ...(calories !== undefined && { calories }),
      ...(proteinG !== undefined && { proteinG }),
      ...(carbsG !== undefined && { carbsG }),
      ...(fatG !== undefined && { fatG }),
      ...(fiberG !== undefined && { fiberG }),
      ...(mealType !== undefined && { mealType }),
    },
  });

  // Save corrected macros to personal food DB (learn from corrections)
  const finalCals = calories ?? updated.calories;
  const finalRawInput = rawInput ?? log.rawInput;
  if (finalCals != null && finalRawInput) {
    const { name, amount, unit } = extractFoodInfo(finalRawInput);
    if (name.length >= 2 && amount > 0) {
      const finalProtein = proteinG ?? updated.proteinG ?? 0;
      const finalCarbs = carbsG ?? updated.carbsG ?? 0;
      const finalFat = fatG ?? updated.fatG ?? 0;
      const finalFiber = fiberG ?? updated.fiberG;

      // Normalize to per-unit (per 1g, per 1 scoop, etc.)
      try {
        await prisma.userFood.upsert({
          where: { userId_name: { userId: user.id, name } },
          create: {
            userId: user.id,
            name,
            servingAmount: 1,
            servingUnit: unit,
            calories: finalCals / amount,
            proteinG: finalProtein / amount,
            carbsG: finalCarbs / amount,
            fatG: finalFat / amount,
            fiberG: finalFiber != null ? finalFiber / amount : null,
          },
          update: {
            servingAmount: 1,
            servingUnit: unit,
            calories: finalCals / amount,
            proteinG: finalProtein / amount,
            carbsG: finalCarbs / amount,
            fatG: finalFat / amount,
            fiberG: finalFiber != null ? finalFiber / amount : null,
            timesUsed: { increment: 1 },
          },
        });
      } catch {
        // Non-critical: don't fail the main update if food DB upsert fails
      }
    }
  }

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_request: NextRequest, user, params) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Missing log ID' }, { status: 400 });
  }

  // Verify the log belongs to this user
  const log = await prisma.nutritionLog.findFirst({
    where: { id, userId: user.id },
  });
  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }

  await prisma.nutritionLog.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id });
});
