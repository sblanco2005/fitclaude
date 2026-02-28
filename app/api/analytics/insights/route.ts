import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simple in-memory cache: userId+weekNumber → { insights, generatedAt }
const insightsCache = new Map<string, { insights: string; generatedAt: string }>();

function getCurrentWeekKey(userId: string): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${userId}:${d.getUTCFullYear()}-W${week}`;
}

interface SetLog {
  set: number;
  weight: number;
  reps: number;
}

function parseSetLogs(raw: string | null): SetLog[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as SetLog).weight === 'number' &&
        typeof (s as SetLog).reps === 'number'
    );
  } catch {
    return [];
  }
}

export const maxDuration = 30;

export const GET = withAuth(async (request, user) => {
  try {
    // Check cache
    const cacheKey = getCurrentWeekKey(user.id);
    const cached = insightsCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch last 14 days of completed workouts
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const workouts = await prisma.workout.findMany({
      where: {
        userId: user.id,
        completed: true,
        date: { gte: since },
      },
      include: {
        exercises: {
          include: {
            exercise: { select: { name: true, muscleGroup: true, exerciseType: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    if (workouts.length < 2) {
      return NextResponse.json({
        insights: 'Need at least 2 completed workouts in the last 14 days to generate insights. Keep training!',
        generatedAt: new Date().toISOString(),
      });
    }

    // Fetch user profile
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        fitnessGoal: true,
        experienceLevel: true,
        age: true,
        weightKg: true,
      },
    });

    // Build a compact workout summary for Claude
    const workoutSummary = workouts.map((w) => {
      let totalVolume = 0;
      const exercises = w.exercises.map((ex) => {
        const logs = parseSetLogs(ex.setLogs);
        let exVolume = 0;
        const maxWeight = logs.length > 0 ? Math.max(...logs.map((l) => l.weight)) : 0;
        for (const log of logs) {
          exVolume += log.weight * log.reps;
        }
        totalVolume += exVolume;
        return {
          name: ex.exercise?.name || 'Unknown',
          muscleGroup: ex.exercise?.muscleGroup || 'unknown',
          type: ex.exercise?.exerciseType || 'unknown',
          setsLogged: logs.length,
          maxWeight,
          volume: Math.round(exVolume),
          reps: logs.map((l) => l.reps),
        };
      });
      return {
        date: w.date.toISOString().split('T')[0],
        name: w.name || w.workoutType,
        workoutType: w.workoutType,
        durationMinutes: w.durationMinutes,
        fatigueRating: w.fatigueRating,
        totalVolume: Math.round(totalVolume),
        exercises,
      };
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `You are a strength training analyst for a fitness app. Analyze the user's recent lifting data and provide 3-5 concise, actionable insights. Focus on:
- Plateau detection: exercises where weight hasn't increased across sessions
- Deload recommendations if volume has been consistently high
- Rep range effectiveness: which rep ranges are producing the most volume
- Recovery patterns: correlating rest days between workouts with performance
- Progressive overload trends: are they getting stronger?
Be direct and specific. Reference actual exercise names and numbers from the data. Format as bullet points starting with a bold topic. Do NOT use motivational fluff or generic advice. Weights are in pounds (lb).`,
      messages: [
        {
          role: 'user',
          content: `User profile:
- Goal: ${profile?.fitnessGoal || 'not set'}
- Experience: ${profile?.experienceLevel || 'not set'}
- Age: ${profile?.age || 'not set'}
- Weight: ${profile?.weightKg ? Math.round(profile.weightKg * 2.205) + ' lb' : 'not set'}

Recent workout data (last 14 days, ${workouts.length} sessions):
${JSON.stringify(workoutSummary, null, 2)}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const result = {
      insights: text,
      generatedAt: new Date().toISOString(),
    };

    // Cache for this week
    insightsCache.set(cacheKey, result);

    // Clean old cache entries (older than 7 days based on key pattern)
    for (const key of insightsCache.keys()) {
      if (key !== cacheKey && key.startsWith(user.id)) {
        insightsCache.delete(key);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[analytics/insights] GET error:', errMsg, error);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: errMsg },
      { status: 500 }
    );
  }
});
