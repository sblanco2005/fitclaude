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
  subgroup?: string;
  d: string;
}

// FRONT VIEW paths
export const FRONT_PATHS: MusclePath[] = [
  // ── Chest (single combined path) ──
  { id: 'chest', muscle: 'chest', d: 'M54,124 C54,114 62,104 80,101 L120,101 C138,104 146,114 146,124 C146,132 140,135 132,139 C122,143 108,143 100,141 C92,143 78,143 68,139 C60,135 54,132 54,124Z' },

  // ── Shoulders / Delts (left) ──
  { id: 'shoulder-l', muscle: 'shoulders', d: 'M30,110 C28,102 32,94 40,90 C48,86 54,90 56,98 L52,116 C46,118 38,118 30,114Z' },
  // ── Shoulders / Delts (right) ──
  { id: 'shoulder-r', muscle: 'shoulders', d: 'M170,110 C172,102 168,94 160,90 C152,86 146,90 144,98 L148,116 C154,118 162,118 170,114Z' },

  // ── Biceps (left) ──
  { id: 'biceps-l', muscle: 'biceps', d: 'M26,128 C24,124 26,120 32,116 C38,114 44,118 44,124 L36,166 C34,174 28,182 22,184 C16,184 12,178 12,172Z' },
  // ── Biceps (right) ──
  { id: 'biceps-r', muscle: 'biceps', d: 'M178,128 C180,124 178,120 172,116 C166,114 160,118 160,124 L168,166 C170,174 176,182 182,184 C188,184 192,178 192,172Z' },

  // ── Forearms (left) — continues below biceps, angling outward ──
  { id: 'forearm-front-l', muscle: 'forearms', d: 'M18,182 C16,178 14,174 12,180 L4,220 C2,228 2,236 4,240 C8,242 12,240 14,234 L20,194 C20,188 18,184 18,182Z' },
  // ── Forearms (right) ──
  { id: 'forearm-front-r', muscle: 'forearms', d: 'M188,182 C190,178 192,174 194,180 L202,220 C204,228 204,236 202,240 C198,242 194,240 192,234 L186,194 C186,188 188,184 188,182Z' },

  // ── Core / Abs (single combined path) ──
  { id: 'core', muscle: 'core', d: 'M68,145 L132,145 L132,202 C128,206 118,209 100,209 C82,209 72,206 68,202Z' },

  // ── Quadriceps (left) ──
  { id: 'quads-l', muscle: 'quadriceps', d: 'M54,231 L100,231 L100,332 L74,334 C66,330 60,318 58,302 C56,286 54,262 54,231Z' },
  // ── Quadriceps (right) ──
  { id: 'quads-r', muscle: 'quadriceps', d: 'M100,231 L146,231 C146,262 144,286 142,302 C140,318 134,330 126,334 L100,332Z' },

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
  // ── Upper Back (traps, rhomboids, lats) ──
  { id: 'upper-back', muscle: 'back', subgroup: 'upper_back', d: 'M72,68 L124,68 C130,80 132,95 126,110 L70,110 C64,95 66,80 72,68Z' },

  // ── Lats (left — vertical pill shape on side of torso) ──
  { id: 'lats-l', muscle: 'back', subgroup: 'lats', d: 'M57,94 C55,94 53,98 53,104 L63,132 C63,138 64,142 65,142 L77,142 C78,142 79,138 79,132 L83,104 C83,98 81,94 79,94Z' },
  // ── Lats (right) ──
  { id: 'lats-r', muscle: 'back', subgroup: 'lats', d: 'M112,94 C110,94 108,98 108,104 L109,132 C109,138 110,142 111,142 L127,142 C128,142 129,138 129,132 L136,104 C136,98 134,94 132,94Z' },

  // ── Lower Back ──
  { id: 'lower-back', muscle: 'back', subgroup: 'lower_back', d: 'M76,126 L112,126 C116,141 114,156 110,171 L78,171 C74,156 72,141 76,126Z' },

  // ── Rear Delts (left) ──
  { id: 'rear-delt-l', muscle: 'shoulders', d: 'M43,76 C39,70 41,62 49,58 C55,54 63,56 67,62 L67,76 C63,80 51,80 43,76Z' },
  // ── Rear Delts (right) ──
  { id: 'rear-delt-r', muscle: 'shoulders', d: 'M150,76 C154,70 152,62 144,58 C138,54 130,56 126,62 L126,76 C130,80 140,80 150,76Z' },

  // ── Triceps (left — horizontal, arm raised) ──
  { id: 'triceps-l', muscle: 'triceps', d: 'M6,86 C6,82 12,79 20,79 L56,85 C62,85 66,88 66,92 C66,96 62,99 56,99 L20,93 C12,93 6,90 6,86Z' },
  // ── Triceps (right — horizontal, arm raised) ──
  { id: 'triceps-r', muscle: 'triceps', d: 'M134,92 C134,88 138,85 144,85 L180,79 C188,79 194,82 194,86 C194,90 188,93 180,93 L144,99 C138,99 134,96 134,92Z' },

  // ── Forearms back (left) ──
  { id: 'forearm-back-l', muscle: 'forearms', d: 'M56,142 C54,148 52,158 50,170 C48,180 48,190 50,196 L60,196 C62,190 64,178 64,168 C64,158 62,148 60,142Z' },
  // ── Forearms back (right) ──
  { id: 'forearm-back-r', muscle: 'forearms', d: 'M144,142 C146,148 148,158 150,170 C152,180 152,190 150,196 L140,196 C138,190 136,178 136,168 C136,158 138,148 140,142Z' },

  // ── Glutes (left) ──
  { id: 'glutes-l', muscle: 'glutes', d: 'M64,201 C60,195 62,187 70,183 C76,179 84,181 88,187 L88,201 C84,205 72,205 64,201Z' },
  // ── Glutes (right) ──
  { id: 'glutes-r', muscle: 'glutes', d: 'M124,201 C128,195 126,187 118,183 C112,179 104,181 100,187 L100,201 C104,205 116,205 124,201Z' },

  // ── Hamstrings (left) ──
  { id: 'hamstrings-l', muscle: 'hamstrings', d: 'M60,207 L86,207 L86,270 L72,272 C68,268 64,260 62,248 C60,236 60,224 60,207Z' },
  // ── Hamstrings (right) ──
  { id: 'hamstrings-r', muscle: 'hamstrings', d: 'M96,207 L122,207 C122,224 122,236 120,248 C118,260 114,268 110,272 L96,270Z' },

  // ── Calves back (left) ──
  { id: 'calves-back-l', muscle: 'calves', d: 'M56,290 L74,290 L74,353 L66,355 C64,351 60,343 58,331 C56,319 56,307 56,290Z' },
  // ── Calves back (right) ──
  { id: 'calves-back-r', muscle: 'calves', d: 'M100,290 L118,290 C118,307 118,319 116,331 C114,343 110,351 108,355 L100,353Z' },
];

// ── Body outline for visual context (not clickable) ──

export const BODY_OUTLINE_FRONT = 'M100,18 C90,18 84,24 84,34 C84,44 88,52 92,58 L92,68 C86,70 78,74 72,80 C66,86 60,90 56,88 C50,86 46,90 44,96 C42,102 44,106 48,108 L54,108 C54,112 56,118 58,124 L58,130 C58,140 56,148 54,158 C52,168 50,178 48,188 C46,194 46,198 48,200 L54,204 C52,198 54,192 56,188 L64,170 C66,164 68,156 70,148 C70,156 72,168 74,178 L78,186 C76,200 76,218 76,236 C76,254 78,268 82,278 L86,286 C84,294 82,306 82,318 C82,332 84,344 88,352 L88,360 C86,366 84,372 84,380 L84,394 C84,400 88,404 92,404 L100,404 L108,404 C112,404 116,400 116,394 L116,380 C116,372 114,366 112,360 L112,352 C116,344 118,332 118,318 C118,306 116,294 114,286 L118,278 C122,268 124,254 124,236 C124,218 124,200 122,186 L126,178 C128,168 130,156 130,148 C132,156 134,164 136,170 L144,188 C146,192 148,198 146,204 L152,200 C154,198 154,194 152,188 C150,178 148,168 146,158 C144,148 142,140 142,130 L142,124 C144,118 146,112 146,108 L152,108 C156,106 158,102 156,96 C154,90 150,86 144,88 C140,90 134,86 128,80 C122,74 114,70 108,68 L108,58 C112,52 116,44 116,34 C116,24 110,18 100,18Z';

export const BODY_OUTLINE_BACK = 'M100,18 C90,18 84,24 84,34 C84,44 88,52 92,58 L92,68 C86,70 78,74 72,80 C66,86 60,90 56,88 C50,86 46,90 44,96 C42,102 44,106 48,108 L54,108 C54,112 56,118 58,124 L58,130 C58,140 56,148 54,158 C52,168 50,178 48,188 C46,194 46,198 48,200 L54,204 C52,198 54,192 56,188 L64,170 C66,164 68,156 70,148 C70,156 72,168 74,178 L78,184 C76,198 76,214 78,220 C76,240 76,256 78,268 L82,278 C80,286 80,296 80,308 C80,320 82,338 86,350 L88,360 C86,366 84,372 84,380 L84,394 C84,400 88,404 92,404 L100,404 L108,404 C112,404 116,400 116,394 L116,380 C116,372 114,366 112,360 L114,350 C118,338 120,320 120,308 C120,296 120,286 118,278 L122,268 C124,256 124,240 122,220 C124,214 124,198 122,184 L126,178 C128,168 130,156 130,148 C132,156 134,164 136,170 L144,188 C146,192 148,198 146,204 L152,200 C154,198 154,194 152,188 C150,178 148,168 146,158 C144,148 142,140 142,130 L142,124 C144,118 146,112 146,108 L152,108 C156,106 158,102 156,96 C154,90 150,86 144,88 C140,90 134,86 128,80 C122,74 114,70 108,68 L108,58 C112,52 116,44 116,34 C116,24 110,18 100,18Z';

// ── Head outline ──
export const HEAD_PATH = 'M100,8 C88,8 80,16 80,28 C80,40 84,48 88,54 C92,58 96,60 100,60 C104,60 108,58 112,54 C116,48 120,40 120,28 C120,16 112,8 100,8Z';

// ─── colors ──────────────────────────────────────────────────────────────────

export const SELECTED_FILL = 'rgba(59, 130, 246, 0.35)';
export const SELECTED_STROKE = 'rgba(96, 165, 250, 0.70)';
export const UNSELECTED_FILL = 'rgba(0, 0, 0, 0.05)';
export const UNSELECTED_STROKE = 'rgba(148, 163, 184, 0.15)';
export const HOVER_FILL = 'rgba(59, 130, 246, 0.15)';
export const OUTLINE_STROKE = 'rgba(148, 163, 184, 0.15)';
