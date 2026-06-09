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
      fitnessGoal: true,
      experienceLevel: true,
      gymType: true,
      injuriesNotes: true,
      equipmentText: true,
      weightKg: true,
      dailyCalorieTarget: true,
      dailyProteinTarget: true,
      carbsPercent: true,
      fatPercent: true,
      sex: true,
      trainingFrequency: true,
      timezone: true,
      weightUnit: true,
      trainerEmail: true,
      isOnboarded: true,
      isAdmin: true,
      tier: true,
      username: true,
      bio: true,
      isPublic: true,
    },
  });

  return NextResponse.json(profile);
});

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const PATCH = withAuth(async (request, user) => {
  const body = await request.json();

  const allowedFields = [
    'name', 'fitnessGoal', 'experienceLevel', 'gymType',
    'injuriesNotes', 'equipmentText', 'weightKg',
    'dailyCalorieTarget', 'dailyProteinTarget',
    'carbsPercent', 'fatPercent',
    'sex', 'trainingFrequency', 'timezone', 'weightUnit', 'isOnboarded', 'trainerEmail',
    'bio', 'isPublic',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  // Username: normalize + validate (handled separately from the simple allowlist).
  if ('username' in body) {
    if (body.username === null || body.username === '') {
      updates.username = null;
    } else {
      const normalized = String(body.username).trim().toLowerCase();
      if (!USERNAME_RE.test(normalized)) {
        return NextResponse.json(
          { error: 'Username must be 3-20 chars: lowercase letters, numbers, or underscore.' },
          { status: 400 },
        );
      }
      updates.username = normalized;
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: {
        id: true,
        name: true,
        fitnessGoal: true,
        experienceLevel: true,
        gymType: true,
        injuriesNotes: true,
        equipmentText: true,
        dailyCalorieTarget: true,
        dailyProteinTarget: true,
        carbsPercent: true,
        fatPercent: true,
        sex: true,
        trainingFrequency: true,
        timezone: true,
        weightUnit: true,
        isOnboarded: true,
        username: true,
        bio: true,
        isPublic: true,
      },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    // Unique constraint on username
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }
    throw error;
  }
});
