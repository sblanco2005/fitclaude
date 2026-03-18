import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// GET: Retrieve user's personal food database
export const GET = withAuth(async (_request: NextRequest, user) => {
  const foods = await prisma.userFood.findMany({
    where: { userId: user.id },
    orderBy: { timesUsed: 'desc' },
  });

  return NextResponse.json(foods);
});

// PATCH: Update a food entry
export const PATCH = withAuth(async (request: NextRequest, user) => {
  const body = await request.json();
  const { id, name, servingAmount, servingUnit, calories, proteinG, carbsG, fatG, fiberG, barcode } = body;
  if (!id) {
    return NextResponse.json({ error: 'Missing food ID' }, { status: 400 });
  }

  const food = await prisma.userFood.findFirst({
    where: { id, userId: user.id },
  });
  if (!food) {
    return NextResponse.json({ error: 'Food not found' }, { status: 404 });
  }

  const updated = await prisma.userFood.update({
    where: { id },
    data: {
      ...(name != null && { name }),
      ...(servingAmount != null && { servingAmount: Number(servingAmount) }),
      ...(servingUnit != null && { servingUnit }),
      ...(calories != null && { calories: Number(calories) }),
      ...(proteinG != null && { proteinG: Number(proteinG) }),
      ...(carbsG != null && { carbsG: Number(carbsG) }),
      ...(fatG != null && { fatG: Number(fatG) }),
      ...(fiberG !== undefined && { fiberG: fiberG != null ? Number(fiberG) : null }),
      ...(barcode !== undefined && { barcode: barcode || null }),
    },
  });

  return NextResponse.json(updated);
});

// DELETE: Remove a food entry by ID
export const DELETE = withAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing food ID' }, { status: 400 });
  }

  const food = await prisma.userFood.findFirst({
    where: { id, userId: user.id },
  });
  if (!food) {
    return NextResponse.json({ error: 'Food not found' }, { status: 404 });
  }

  await prisma.userFood.delete({ where: { id } });

  return NextResponse.json({ deleted: true, id });
});
