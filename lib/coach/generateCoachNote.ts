import Anthropic from '@anthropic-ai/sdk';
import type { WeekSnapshot } from './weekSnapshot';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
- If the user has zero workouts ever, encourage them to start with something small

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

export async function generateCoachNote(snapshot: WeekSnapshot): Promise<CoachNoteOutput> {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: SYS,
    messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip code fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as CoachNoteOutput;
    if (!parsed.headline || !parsed.body) throw new Error('Missing fields');
    if (!['ok', 'warn', 'celebrate'].includes(parsed.tone)) parsed.tone = 'ok';
    return parsed;
  } catch {
    return {
      headline: 'Your coach is reviewing your week',
      body: '- Check back tomorrow for a fresh briefing.',
      tone: 'ok',
    };
  }
}
