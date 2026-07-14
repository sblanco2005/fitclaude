// Deterministic free-text → cardio segments parser. Sibling to
// lib/program/exercises.ts (which is muscle-group based and NOT reused here).
// Turns "rower 5min + air bike 2min + run 400m" into structured segments that
// persist as WorkoutExercise rows on a Workout(category='cardio').

import type { Ex } from './exercises';

export type CardioSegment = {
  name: string;
  exerciseId: string | null;
  rounds: number;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: 'm' | 'km' | 'mi' | null;
  reps: string | null;
  restSeconds: number | null;
};

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Split a whole cardio description into per-segment strings.
function splitSegments(text: string): string[] {
  return text
    .split(/\s*(?:\+|,|;|\n|·|\bthen\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parse one segment string into metrics + a cleaned name.
function parseOne(seg: string, cardioExercises: Ex[]): CardioSegment | null {
  let s = ` ${seg.toLowerCase()} `;
  let durationSeconds: number | null = null;
  let distance: number | null = null;
  let distanceUnit: 'm' | 'km' | 'mi' | null = null;
  let reps: string | null = null;

  const strip = (re: RegExp) => { s = s.replace(re, ' '); };

  // duration — mm:ss
  const mmss = s.match(/(\d+):(\d{1,2})/);
  if (mmss) { durationSeconds = parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10); strip(/\d+:\d{1,2}/); }
  // duration — minutes
  const min = s.match(/(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)\b/);
  if (min && durationSeconds == null) { durationSeconds = Math.round(parseFloat(min[1]) * 60); }
  if (min) strip(/(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)\b/);
  // duration — seconds
  const sec = s.match(/(\d+)\s*(?:secs?|seconds?|s)\b/);
  if (sec && durationSeconds == null) { durationSeconds = parseInt(sec[1], 10); }
  if (sec) strip(/(\d+)\s*(?:secs?|seconds?|s)\b/);

  // distance — km (incl. "5k"), miles, meters
  const km = s.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometers?|kilometres?|k)\b/);
  const mi = s.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/);
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)\b/);
  if (km) { distance = parseFloat(km[1]); distanceUnit = 'km'; strip(/(\d+(?:\.\d+)?)\s*(?:km|kilometers?|kilometres?|k)\b/); }
  else if (mi) { distance = parseFloat(mi[1]); distanceUnit = 'mi'; strip(/(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/); }
  else if (m) { distance = parseFloat(m[1]); distanceUnit = 'm'; strip(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)\b/); }

  // reps — "x20", "20 reps", or a bare leading number when no time/distance found
  const xr = s.match(/[x×]\s*(\d+)/);
  const rr = s.match(/(\d+)\s*reps?\b/);
  if (xr) { reps = xr[1]; strip(/[x×]\s*\d+/); }
  else if (rr) { reps = rr[1]; strip(/(\d+)\s*reps?\b/); }
  else if (durationSeconds == null && distance == null) {
    const lead = s.match(/^\s*(\d+)\s+(?=\D)/);
    if (lead) { reps = lead[1]; strip(/^\s*\d+\s+/); }
  }

  const name = s.replace(/[×x]/g, ' ').replace(/\s+/g, ' ').trim();
  const clean = name || seg.trim();
  if (!clean) return null;

  // Link to a seeded cardio exercise on an exact or whole-word match
  // (avoids false positives like "prune" → "run").
  const lower = clean.toLowerCase();
  const wb = (hay: string, needle: string) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay);
  const match = cardioExercises.find((e) => {
    const en = e.name.toLowerCase();
    return en === lower || wb(lower, en) || wb(en, lower);
  });

  return {
    name: match ? match.name : titleCase(clean),
    exerciseId: match ? match.id : null,
    rounds: 1,
    durationSeconds,
    distance,
    distanceUnit,
    reps,
    restSeconds: null,
  };
}

export function parseCardioSegments(text: string, cardioExercises: Ex[] = []): CardioSegment[] {
  const segs = splitSegments(text)
    .map((seg) => parseOne(seg, cardioExercises))
    .filter((x): x is CardioSegment => !!x);
  // Fallback: nothing parsed → a single free-text segment from the whole input.
  if (!segs.length && text.trim()) {
    return [{ name: titleCase(text.trim().slice(0, 40)), exerciseId: null, rounds: 1, durationSeconds: null, distance: null, distanceUnit: null, reps: null, restSeconds: null }];
  }
  return segs;
}

// Short display label for a segment ("Rower · 5:00", "Run · 400 m", "Burpees · ×20").
export function segmentLabel(s: { durationSeconds: number | null; distance: number | null; distanceUnit: string | null; reps: string | null }): string {
  if (s.durationSeconds != null) {
    const m = Math.floor(s.durationSeconds / 60);
    const sec = s.durationSeconds % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }
  if (s.distance != null) return `${s.distance} ${s.distanceUnit ?? 'm'}`;
  if (s.reps != null) return `×${s.reps}`;
  return '';
}
