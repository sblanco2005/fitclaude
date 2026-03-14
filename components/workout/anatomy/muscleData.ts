// ─── types ───────────────────────────────────────────────────────────────────

export type MuscleView = 'front' | 'back';

export interface Subgroup {
  key: string;
  label: string;
}

export interface MuscleRegion {
  key: string;
  label: string;
  view: MuscleView;
  subgroups: Subgroup[];
}

// ─── muscle hierarchy ────────────────────────────────────────────────────────

export const MUSCLE_REGIONS: MuscleRegion[] = [
  {
    key: 'chest',
    label: 'Chest',
    view: 'front',
    subgroups: [
      { key: 'upper_chest', label: 'Upper Chest' },
      { key: 'mid_chest', label: 'Mid Chest' },
      { key: 'lower_chest', label: 'Lower Chest' },
    ],
  },
  {
    key: 'shoulders',
    label: 'Shoulders',
    view: 'front',
    subgroups: [
      { key: 'front_delts', label: 'Front Delts' },
      { key: 'side_delts', label: 'Side Delts' },
      { key: 'rear_delts', label: 'Rear Delts' },
    ],
  },
  {
    key: 'biceps',
    label: 'Biceps',
    view: 'front',
    subgroups: [
      { key: 'biceps_long', label: 'Long Head' },
      { key: 'biceps_short', label: 'Short Head' },
    ],
  },
  {
    key: 'core',
    label: 'Core',
    view: 'front',
    subgroups: [
      { key: 'upper_abs', label: 'Upper Abs' },
      { key: 'lower_abs', label: 'Lower Abs' },
      { key: 'obliques', label: 'Obliques' },
    ],
  },
  {
    key: 'quadriceps',
    label: 'Quads',
    view: 'front',
    subgroups: [
      { key: 'quads_inner', label: 'Inner' },
      { key: 'quads_outer', label: 'Outer' },
      { key: 'quads_rectus', label: 'Rectus' },
    ],
  },
  {
    key: 'back',
    label: 'Back',
    view: 'back',
    subgroups: [
      { key: 'upper_back', label: 'Upper Back' },
      { key: 'lats', label: 'Lats' },
      { key: 'lower_back', label: 'Lower Back' },
    ],
  },
  {
    key: 'triceps',
    label: 'Triceps',
    view: 'back',
    subgroups: [
      { key: 'triceps_long', label: 'Long Head' },
      { key: 'triceps_lateral', label: 'Lateral Head' },
      { key: 'triceps_medial', label: 'Medial Head' },
    ],
  },
  {
    key: 'glutes',
    label: 'Glutes',
    view: 'back',
    subgroups: [
      { key: 'glutes_upper', label: 'Upper Glutes' },
      { key: 'glutes_lower', label: 'Lower Glutes' },
    ],
  },
  {
    key: 'hamstrings',
    label: 'Hamstrings',
    view: 'back',
    subgroups: [],
  },
  {
    key: 'calves',
    label: 'Calves',
    view: 'back',
    subgroups: [],
  },
];

export const MUSCLE_MAP = Object.fromEntries(
  MUSCLE_REGIONS.map((r) => [r.key, r])
) as Record<string, MuscleRegion>;

// ─── presets ─────────────────────────────────────────────────────────────────

export const PRESETS = [
  { label: 'Push', keys: ['chest', 'shoulders', 'triceps'] },
  { label: 'Pull', keys: ['back', 'biceps'] },
  { label: 'Legs', keys: ['quadriceps', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Upper', keys: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
  { label: 'Full Body', keys: MUSCLE_REGIONS.map((r) => r.key) },
];

// ─── SVG path data ───────────────────────────────────────────────────────────
// Each muscle region maps to one or more SVG path `d` strings for front/back views.
// Paths are designed for a 200x440 viewBox.

export interface MusclePath {
  id: string;
  muscle: string;
  d: string;
}

// FRONT VIEW paths
export const FRONT_PATHS: MusclePath[] = [
  // ── Chest (single combined path) ──
  { id: 'chest', muscle: 'chest', d: 'M54,124 C54,114 62,104 80,101 L120,101 C138,104 146,114 146,124 C146,132 140,135 132,139 C122,143 108,143 100,141 C92,143 78,143 68,139 C60,135 54,132 54,124Z' },

  // ── Shoulders / Front Delts (left) ──
  { id: 'shoulder-front-l', muscle: 'shoulders', d: 'M60,88 C58,82 62,76 68,74 C74,72 80,76 82,82 L82,92 C76,90 68,88 60,88Z' },
  // ── Shoulders / Front Delts (right) ──
  { id: 'shoulder-front-r', muscle: 'shoulders', d: 'M140,88 C142,82 138,76 132,74 C126,72 120,76 118,82 L118,92 C124,90 132,88 140,88Z' },

  // ── Biceps (left) ──
  { id: 'biceps-l', muscle: 'biceps', d: 'M32,128 C30,124 32,120 36,118 C40,116 42,118 42,124 L34,166 C32,174 28,180 24,182 C20,182 18,178 18,172Z' },
  // ── Biceps (right) ──
  { id: 'biceps-r', muscle: 'biceps', d: 'M168,128 C170,124 168,120 164,118 C160,116 158,118 158,124 L166,166 C168,174 172,180 176,182 C180,182 182,178 182,172Z' },

  // ── Forearms (left) ──
  { id: 'forearm-front-l', muscle: 'forearms', d: 'M56,142 C54,148 52,158 50,170 C48,180 48,190 50,196 L60,196 C62,190 64,178 64,168 C64,158 62,148 60,142Z' },
  // ── Forearms (right) ──
  { id: 'forearm-front-r', muscle: 'forearms', d: 'M144,142 C146,148 148,158 150,170 C152,180 152,190 150,196 L140,196 C138,190 136,178 136,168 C136,158 138,148 140,142Z' },

  // ── Core / Abs (single combined path) ──
  { id: 'core', muscle: 'core', d: 'M68,145 L132,145 L132,202 C128,206 118,209 100,209 C82,209 72,206 68,202Z' },

  // ── Quadriceps (left) ──
  { id: 'quads-l', muscle: 'quadriceps', d: 'M78,186 C80,184 84,182 90,182 L100,182 L100,270 L92,272 C86,270 82,264 80,256 C78,246 76,230 76,216 C76,204 77,194 78,186Z' },
  // ── Quadriceps (right) ──
  { id: 'quads-r', muscle: 'quadriceps', d: 'M100,182 L110,182 C116,182 120,184 122,186 C123,194 124,204 124,216 C124,230 122,246 120,256 C118,264 114,270 108,272 L100,270Z' },

  // ── Calves front (left) ──
  { id: 'calves-front-l', muscle: 'calves', d: 'M82,290 C84,282 88,276 92,274 L100,274 L100,340 L94,342 C90,340 86,332 84,320 C82,310 82,300 82,290Z' },
  // ── Calves front (right) ──
  { id: 'calves-front-r', muscle: 'calves', d: 'M100,274 L108,274 C112,276 116,282 118,290 C118,300 118,310 116,320 C114,332 110,340 106,342 L100,340Z' },

  // ── Neck ──
  { id: 'neck-front', muscle: 'neck', d: 'M92,68 L108,68 L108,78 C106,80 104,82 100,82 C96,82 94,80 92,78Z' },

  // ── Traps front ──
  { id: 'traps-front-l', muscle: 'traps', d: 'M82,78 L92,78 C90,82 88,86 88,90 L72,90 C72,86 76,80 82,78Z' },
  { id: 'traps-front-r', muscle: 'traps', d: 'M108,78 L118,78 C124,80 128,86 128,90 L112,90 C112,86 110,82 108,78Z' },
];

// BACK VIEW paths
export const BACK_PATHS: MusclePath[] = [
  // ── Traps ──
  { id: 'traps-back-l', muscle: 'back', d: 'M82,78 L100,78 L100,100 L88,98 C84,96 82,90 82,78Z' },
  { id: 'traps-back-r', muscle: 'back', d: 'M100,78 L118,78 C118,90 116,96 112,98 L100,100Z' },

  // ── Upper Back / Rhomboids ──
  { id: 'upper-back-l', muscle: 'back', d: 'M76,92 L88,98 L100,100 L100,120 L82,118 C78,114 76,106 76,92Z' },
  { id: 'upper-back-r', muscle: 'back', d: 'M124,92 L112,98 L100,100 L100,120 L118,118 C122,114 124,106 124,92Z' },

  // ── Lats (left) ──
  { id: 'lats-l', muscle: 'back', d: 'M72,110 L82,118 L100,120 L100,160 L84,156 C78,150 74,138 72,124 C72,118 72,114 72,110Z' },
  // ── Lats (right) ──
  { id: 'lats-r', muscle: 'back', d: 'M128,110 L118,118 L100,120 L100,160 L116,156 C122,150 126,138 128,124 C128,118 128,114 128,110Z' },

  // ── Lower Back / Erectors ──
  { id: 'lower-back-l', muscle: 'back', d: 'M84,156 L100,160 L100,184 L88,182 C86,178 84,168 84,156Z' },
  { id: 'lower-back-r', muscle: 'back', d: 'M116,156 L100,160 L100,184 L112,182 C114,178 116,168 116,156Z' },

  // ── Rear Delts (left) ──
  { id: 'rear-delt-l', muscle: 'shoulders', d: 'M60,88 C58,82 62,76 68,74 C74,72 80,78 82,84 L82,94 C76,92 68,90 60,88Z' },
  // ── Rear Delts (right) ──
  { id: 'rear-delt-r', muscle: 'shoulders', d: 'M140,88 C142,82 138,76 132,74 C126,72 120,78 118,84 L118,94 C124,92 132,90 140,88Z' },

  // ── Triceps (left) ──
  { id: 'triceps-l', muscle: 'triceps', d: 'M58,100 C56,96 54,92 56,88 L62,88 C64,92 66,100 66,108 L66,140 C64,140 60,138 58,134 C56,128 56,116 58,100Z' },
  // ── Triceps (right) ──
  { id: 'triceps-r', muscle: 'triceps', d: 'M142,100 C144,96 146,92 144,88 L138,88 C136,92 134,100 134,108 L134,140 C136,140 140,138 142,134 C144,128 144,116 142,100Z' },

  // ── Forearms back (left) ──
  { id: 'forearm-back-l', muscle: 'forearms', d: 'M56,142 C54,148 52,158 50,170 C48,180 48,190 50,196 L60,196 C62,190 64,178 64,168 C64,158 62,148 60,142Z' },
  // ── Forearms back (right) ──
  { id: 'forearm-back-r', muscle: 'forearms', d: 'M144,142 C146,148 148,158 150,170 C152,180 152,190 150,196 L140,196 C138,190 136,178 136,168 C136,158 138,148 140,142Z' },

  // ── Glutes (left) ──
  { id: 'glutes-l', muscle: 'glutes', d: 'M78,184 C80,182 86,180 92,180 L100,180 L100,214 C94,218 88,218 84,214 C80,210 78,200 78,192 C78,188 78,186 78,184Z' },
  // ── Glutes (right) ──
  { id: 'glutes-r', muscle: 'glutes', d: 'M100,180 L108,180 C114,180 120,182 122,184 C122,186 122,188 122,192 C122,200 120,210 116,214 C112,218 106,218 100,214Z' },

  // ── Hamstrings (left) ──
  { id: 'hamstrings-l', muscle: 'hamstrings', d: 'M80,220 C82,218 88,218 94,220 L100,220 L100,286 L92,288 C86,286 82,278 80,268 C78,256 78,240 80,220Z' },
  // ── Hamstrings (right) ──
  { id: 'hamstrings-r', muscle: 'hamstrings', d: 'M100,220 L106,220 C112,218 118,218 120,220 C122,240 122,256 120,268 C118,278 114,286 108,288 L100,286Z' },

  // ── Calves back (left) ──
  { id: 'calves-back-l', muscle: 'calves', d: 'M82,290 C84,288 88,286 92,286 L100,286 L100,350 L94,352 C88,350 84,340 82,328 C80,316 80,302 82,290Z' },
  // ── Calves back (right) ──
  { id: 'calves-back-r', muscle: 'calves', d: 'M100,286 L108,286 C112,286 116,288 118,290 C120,302 120,316 118,328 C116,340 112,350 106,352 L100,350Z' },
];

// ── Body outline for visual context (not clickable) ──

export const BODY_OUTLINE_FRONT = 'M100,18 C90,18 84,24 84,34 C84,44 88,52 92,58 L92,68 C86,70 78,74 72,80 C66,86 60,90 56,88 C50,86 46,90 44,96 C42,102 44,106 48,108 L54,108 C54,112 56,118 58,124 L58,130 C58,140 56,148 54,158 C52,168 50,178 48,188 C46,194 46,198 48,200 L54,204 C52,198 54,192 56,188 L64,170 C66,164 68,156 70,148 C70,156 72,168 74,178 L78,186 C76,200 76,218 76,236 C76,254 78,268 82,278 L86,286 C84,294 82,306 82,318 C82,332 84,344 88,352 L88,360 C86,366 84,372 84,380 L84,394 C84,400 88,404 92,404 L100,404 L108,404 C112,404 116,400 116,394 L116,380 C116,372 114,366 112,360 L112,352 C116,344 118,332 118,318 C118,306 116,294 114,286 L118,278 C122,268 124,254 124,236 C124,218 124,200 122,186 L126,178 C128,168 130,156 130,148 C132,156 134,164 136,170 L144,188 C146,192 148,198 146,204 L152,200 C154,198 154,194 152,188 C150,178 148,168 146,158 C144,148 142,140 142,130 L142,124 C144,118 146,112 146,108 L152,108 C156,106 158,102 156,96 C154,90 150,86 144,88 C140,90 134,86 128,80 C122,74 114,70 108,68 L108,58 C112,52 116,44 116,34 C116,24 110,18 100,18Z';

export const BODY_OUTLINE_BACK = 'M100,18 C90,18 84,24 84,34 C84,44 88,52 92,58 L92,68 C86,70 78,74 72,80 C66,86 60,90 56,88 C50,86 46,90 44,96 C42,102 44,106 48,108 L54,108 C54,112 56,118 58,124 L58,130 C58,140 56,148 54,158 C52,168 50,178 48,188 C46,194 46,198 48,200 L54,204 C52,198 54,192 56,188 L64,170 C66,164 68,156 70,148 C70,156 72,168 74,178 L78,184 C76,198 76,214 78,220 C76,240 76,256 78,268 L82,278 C80,286 80,296 80,308 C80,320 82,338 86,350 L88,360 C86,366 84,372 84,380 L84,394 C84,400 88,404 92,404 L100,404 L108,404 C112,404 116,400 116,394 L116,380 C116,372 114,366 112,360 L114,350 C118,338 120,320 120,308 C120,296 120,286 118,278 L122,268 C124,256 124,240 122,220 C124,214 124,198 122,184 L126,178 C128,168 130,156 130,148 C132,156 134,164 136,170 L144,188 C146,192 148,198 146,204 L152,200 C154,198 154,194 152,188 C150,178 148,168 146,158 C144,148 142,140 142,130 L142,124 C144,118 146,112 146,108 L152,108 C156,106 158,102 156,96 C154,90 150,86 144,88 C140,90 134,86 128,80 C122,74 114,70 108,68 L108,58 C112,52 116,44 116,34 C116,24 110,18 100,18Z';

// ── Head outline ──
export const HEAD_PATH = 'M100,8 C88,8 80,16 80,28 C80,40 84,48 88,54 C92,58 96,60 100,60 C104,60 108,58 112,54 C116,48 120,40 120,28 C120,16 112,8 100,8Z';

// ─── colors ──────────────────────────────────────────────────────────────────

export const SELECTED_FILL = 'rgba(59, 130, 246, 1.0)';
export const SELECTED_STROKE = 'rgba(96, 165, 250, 0.70)';
export const UNSELECTED_FILL = 'rgba(0, 0, 0, 0.05)';
export const UNSELECTED_STROKE = 'rgba(148, 163, 184, 0.15)';
export const HOVER_FILL = 'rgba(59, 130, 246, 0.15)';
export const OUTLINE_STROKE = 'rgba(148, 163, 184, 0.15)';
