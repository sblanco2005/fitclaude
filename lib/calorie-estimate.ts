/**
 * Conservative calorie-burn estimate for an activity.
 *
 * Uses MET values (Metabolic Equivalent of Task) from the Compendium of
 * Physical Activities, then applies a 0.85 multiplier to stay on the
 * lower-bound side — we prefer to UNDER-estimate so users never feel like
 * the app is inflating their numbers.
 *
 * kcal = MET × weight_kg × hours × 0.85
 *
 * If the activity can't be matched we fall back to 3.5 MET (light effort).
 */

const LOWER_BOUND_MULTIPLIER = 0.85;

// MET values — conservative ends of the published ranges
const MET_BY_KEYWORD: Array<{ keywords: string[]; met: number }> = [
  { keywords: ['alpha'], met: 6.0 },                    // mixed HIIT/functional class
  { keywords: ['hiit', 'crossfit', 'metcon'], met: 7.0 },
  { keywords: ['yoga'], met: 2.5 },
  { keywords: ['pilates'], met: 3.0 },
  { keywords: ['stretch', 'mobility'], met: 2.3 },
  { keywords: ['walk'], met: 3.5 },
  { keywords: ['hike', 'hiking'], met: 5.3 },
  { keywords: ['run', 'jog'], met: 8.0 },
  { keywords: ['bike', 'cycling', 'cycle'], met: 6.0 },
  { keywords: ['swim'], met: 6.0 },
  { keywords: ['row', 'rower'], met: 7.0 },
  { keywords: ['basketball', 'soccer', 'football', 'tennis', 'pickleball'], met: 7.0 },
  { keywords: ['box', 'kick box', 'muay'], met: 7.5 },
  { keywords: ['spin'], met: 7.0 },
  { keywords: ['pt ', 'personal training', 'training session', 'lift', 'weight', 'strength'], met: 5.0 },
  { keywords: ['class'], met: 5.5 },                    // generic fitness class
];

const DEFAULT_MET = 3.5;

export function estimateActivityKcal(
  activityName: string | null | undefined,
  durationMinutes: number | null | undefined,
  weightKg: number | null | undefined,
): number | null {
  if (!weightKg || weightKg <= 0) return null;
  // Fall back to a conservative 45 min when duration is not tracked
  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : 45;

  const name = (activityName || '').toLowerCase();
  let met = DEFAULT_MET;
  for (const entry of MET_BY_KEYWORD) {
    if (entry.keywords.some((k) => name.includes(k))) {
      met = entry.met;
      break;
    }
  }

  const hours = duration / 60;
  const kcal = met * weightKg * hours * LOWER_BOUND_MULTIPLIER;
  return Math.round(kcal);
}
