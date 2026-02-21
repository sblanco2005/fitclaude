import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

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
