// Deterministic exercise selection shared by the program builder and the
// per-day "change routine" flow. Parses a free-text focus ("Push & Pull",
// "Deadlifts & Back") into muscle groups + named lifts and picks exercises.

export type Ex = { id: string; name: string; muscleGroup: string; exerciseType: string; equipmentRequired: string | null };
export type TemplateItem = { name: string; muscle_group: string; sets: number; reps: string; is_primary: boolean; notes: string; _id: string | null };

// Category / synonym → target muscle groups.
export const WT_MUSCLES: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  full_body: ['full_body', 'chest', 'back', 'quadriceps', 'shoulders'],
};

const MUSCLE_KEYWORDS: [RegExp, string][] = [
  [/chest|pec/, 'chest'],
  [/\bback\b|lat|row/, 'back'],
  [/shoulder|delt|press|ohp/, 'shoulders'],
  [/bicep|curl/, 'biceps'],
  [/tricep/, 'triceps'],
  [/quad|squat/, 'quadriceps'],
  [/hamstring|\bham\b|rdl/, 'hamstrings'],
  [/glute/, 'glutes'],
  [/calf|calv/, 'calves'],
  [/core|\bab\b|abs/, 'core'],
  [/deadlift/, 'back'],
  [/bench/, 'chest'],
];

const TARGET_COUNT = 6;
export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const singular = (w: string) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);

export function musclesForFocus(focus: string): string[] {
  const t = focus.toLowerCase();
  const set = new Set<string>();
  if (/\bpush\b/.test(t)) WT_MUSCLES.push.forEach((m) => set.add(m));
  if (/\bpull\b/.test(t)) WT_MUSCLES.pull.forEach((m) => set.add(m));
  if (/\blegs?\b|lower/.test(t)) WT_MUSCLES.legs.forEach((m) => set.add(m));
  if (/\bupper\b/.test(t)) WT_MUSCLES.upper.forEach((m) => set.add(m));
  if (/full.?body/.test(t)) WT_MUSCLES.full_body.forEach((m) => set.add(m));
  if (/\barms?\b/.test(t)) { set.add('biceps'); set.add('triceps'); }
  for (const [re, m] of MUSCLE_KEYWORDS) if (re.test(t)) set.add(m);
  return set.size ? Array.from(set) : WT_MUSCLES.full_body;
}

export function typeForFocus(focus: string): string {
  const t = focus.toLowerCase();
  for (const k of ['push', 'pull', 'legs', 'upper', 'lower']) if (new RegExp(`\\b${k}\\b`).test(t)) return k;
  if (/full.?body/.test(t)) return 'full_body';
  return 'custom';
}

function explicitMatches(focus: string, src: Ex[]): Ex[] {
  const words = new Set(focus.toLowerCase().split(/[^a-z]+/).filter((x) => x.length >= 4).map(singular));
  if (!words.size) return [];
  return src.filter((e) => e.name.toLowerCase().split(/[^a-z]+/).some((w) => w.length >= 4 && words.has(singular(w))));
}

// `pool` is equipment-filtered; `all` is the fallback so filtering never empties a group.
export function pickForFocus(focus: string, pool: Ex[], all: Ex[]): TemplateItem[] {
  const muscles = musclesForFocus(focus);
  const chosen: { e: Ex; primary: boolean }[] = [];
  const used = new Set<string>();
  const forMuscle = (m: string, src: Ex[]) => src.filter((e) => e.muscleGroup === m && !used.has(e.id));

  explicitMatches(focus, pool.length ? pool : all).slice(0, 3).forEach((e) => {
    if (!used.has(e.id)) { chosen.push({ e, primary: e.exerciseType === 'compound' }); used.add(e.id); }
  });

  for (const m of muscles) {
    if (chosen.length >= TARGET_COUNT) break;
    let c = forMuscle(m, pool).filter((e) => e.exerciseType === 'compound');
    if (!c.length) c = forMuscle(m, all).filter((e) => e.exerciseType === 'compound');
    if (!c.length) c = forMuscle(m, pool);
    if (!c.length) c = forMuscle(m, all);
    if (c.length) { chosen.push({ e: c[0], primary: true }); used.add(c[0].id); }
  }

  let guard = 0;
  while (chosen.length < TARGET_COUNT && guard < muscles.length * 5) {
    const m = muscles[guard % muscles.length];
    guard++;
    let rest = forMuscle(m, pool);
    if (!rest.length) rest = forMuscle(m, all);
    if (rest.length) { chosen.push({ e: rest[0], primary: rest[0].exerciseType === 'compound' }); used.add(rest[0].id); }
  }

  return chosen.map(({ e, primary }) => {
    const isCore = e.muscleGroup === 'core';
    return {
      name: e.name,
      muscle_group: e.muscleGroup,
      sets: primary ? 4 : 3,
      reps: isCore ? '12-15' : primary ? '6-8' : '10-12',
      is_primary: primary,
      notes: '',
      _id: e.id,
    };
  });
}
