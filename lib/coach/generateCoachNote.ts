import Anthropic from '@anthropic-ai/sdk';
import type { WeekSnapshot } from './weekSnapshot';

// Primary: MiniMax-M2.7 via Anthropic-compatible endpoint
const minimaxClient = process.env.MINIMAX_API_KEY
  ? new Anthropic({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: 'https://api.minimax.io/anthropic',
    })
  : null;

// Fallback: Claude Haiku
const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYS = `You are FitClaude's morning briefing coach. You receive a JSON snapshot covering this week vs last week of training and nutrition, strength progression, and what's coming up.

Write a short briefing the user sees when they open the app.

CONTENT RULES
- Lead with the most interesting thing in the snapshot. Priorities (high→low):
  1. Strength PRs or clear progression on a repeated exercise
  2. Inactivity warning (daysSinceLastWorkout ≥ 3)
  3. Notable week-over-week delta (training volume or nutrition)
  4. A missed muscle group this week
  5. What's coming up tomorrow
- Reference ONE concrete data point per bullet (e.g. "bench 185×5 → 190×5", not "you got stronger")
- You MAY propose ONE small suggestion (extra set, +2.5 kg, add a specific accessory) only when the data supports it
- Nutrition: comment only if this week's avg protein is >15% off target OR if calories swing ±300 vs last week
- If the week looks unremarkable (no PRs, on-target, no missed sessions), close with ONE short motivational line — warm, never saccharine
- EMPTY STATE: if training.thisWeek.sessionsCompleted === 0 AND training.lastWeek.sessionsCompleted === 0, the user has no logged workouts. Do NOT fabricate any training data. Return tone "warn", headline like "Ready to start?", and 1–2 bullets encouraging them to log their first session. Nothing about strength or nutrition.

OUTPUT
JSON ONLY, no prose outside the object, no markdown fences:
{
  "headline": "≤80 chars, one line, punchy",
  "body": "2–4 markdown bullets, ≤240 chars TOTAL",
  "tone": "ok" | "warn" | "celebrate"
}

TONE FIELD
- "celebrate" → PR, week target hit, streak milestone
- "warn" → inactivity ≥3 days, protein way under target
- "ok" → everything else`;

export type CoachNoteOutput = {
  headline: string;
  body: string;
  tone: 'ok' | 'warn' | 'celebrate';
};

function parseNoteResponse(text: string): CoachNoteOutput {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as CoachNoteOutput;
  if (!parsed.headline || !parsed.body) throw new Error('Missing fields');
  if (!['ok', 'warn', 'celebrate'].includes(parsed.tone)) parsed.tone = 'ok';
  return parsed;
}

async function callLLM(client: Anthropic, model: string, snapshot: WeekSnapshot): Promise<CoachNoteOutput> {
  const res = await client.messages.create({
    model,
    max_tokens: 500,
    system: SYS,
    messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return parseNoteResponse(text);
}

export async function generateCoachNote(snapshot: WeekSnapshot): Promise<CoachNoteOutput> {
  // Try MiniMax-M2.7 first
  if (minimaxClient) {
    try {
      return await callLLM(minimaxClient, 'MiniMax-M2.7', snapshot);
    } catch (err) {
      console.warn('[coach-notes] MiniMax failed, falling back to Anthropic:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback to Claude Haiku
  try {
    return await callLLM(anthropicClient, 'claude-haiku-4-5-20251001', snapshot);
  } catch {
    return {
      headline: 'Your coach is reviewing your week',
      body: '- Check back tomorrow for a fresh briefing.',
      tone: 'ok',
    };
  }
}
