import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_request, user) => {
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      age: true,
      weightKg: true,
      heightCm: true,
      fitnessGoal: true,
      experienceLevel: true,
      gymType: true,
      injuriesNotes: true,
      equipmentText: true,
      dailyCalorieTarget: true,
      dailyProteinTarget: true,
      sex: true,
      trainingFrequency: true,
      isOnboarded: true,
    },
  });

  return NextResponse.json(profile);
});

export const PATCH = withAuth(async (request, user) => {
  const body = await request.json();

  const allowedFields = [
    'name', 'age', 'weightKg', 'heightCm',
    'fitnessGoal', 'experienceLevel', 'gymType',
    'injuriesNotes', 'equipmentText',
    'dailyCalorieTarget', 'dailyProteinTarget',
    'sex', 'trainingFrequency', 'isOnboarded',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updates,
    select: {
      id: true,
      name: true,
      age: true,
      weightKg: true,
      heightCm: true,
      fitnessGoal: true,
      experienceLevel: true,
      gymType: true,
      injuriesNotes: true,
      equipmentText: true,
      dailyCalorieTarget: true,
      dailyProteinTarget: true,
      sex: true,
      trainingFrequency: true,
      isOnboarded: true,
    },
  });

  return NextResponse.json(updated);
});
