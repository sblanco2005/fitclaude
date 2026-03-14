// User / Profile
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  fitnessGoal: string | null;
  experienceLevel: string | null;
  gymType: string | null;
  injuriesNotes: string | null;
  equipmentText: string | null;
  dailyCalorieTarget: number | null;
  dailyProteinTarget: number | null;
  carbsPercent: number | null;
  fatPercent: number | null;
  sex: string | null;
  trainingFrequency: number | null;
  weightUnit: string; // "lb" or "kg"
  isOnboarded: boolean;
  isAdmin: boolean;
}

// Exercise
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string | null;
  equipmentRequired: string | null;
  difficulty: string;
  exerciseType: string;
  instructions: string | null;
  gifUrl: string | null;
  variations: ExerciseVariation[];
  videos?: ExerciseVideoLink[];
}

export interface ExerciseVariation {
  id: string;
  baseExerciseId: string;
  name: string;
  spicyLevel: number;
  modificationType: string;
  description: string;
  additionalEquipment: string | null;
}

// Exercise Video (YouTube tutorial linked to exercise)
export interface ExerciseVideoLink {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  viewCount: number | null;
  status: string;
  videoType: string; // "tutorial" or "reference"
  isPrimary: boolean;
  createdAt: string;
}

// Reference video with exercise relation (for Videos tab)
export interface ExerciseVideoWithExercise extends ExerciseVideoLink {
  exercise?: { id: string; muscleGroup: string; name: string } | null;
}

// Pending Exercise (admin review)
export interface PendingExercise {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string | null;
  equipmentRequired: string | null;
  difficulty: string;
  exerciseType: string;
  instructions: string | null;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
  pendingVariations: PendingVariation[];
}

export interface PendingVariation {
  id: string;
  name: string;
  spicyLevel: number;
  modificationType: string;
  description: string;
  additionalEquipment: string | null;
}

// Workout
export interface Workout {
  id: string;
  userId: string;
  displayId: number | null;
  date: string;
  name: string | null;
  workoutType: string;
  category: string;
  source: string; // "coach" | "manual"
  durationMinutes: number | null;
  notes: string | null;
  fatigueRating: number | null;
  completed: boolean;
  isFavorite: boolean;
  createdAt: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string | null;
  variationId: string | null;
  order: number;
  sets: number;
  reps: string | null;
  weightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
  setLogs: string | null; // JSON: [{"set":1,"weight":195,"reps":4},...]
  wasSpicy: boolean;
  supersetGroup?: string | null;
  exercise?: { name: string; muscleGroup: string; equipmentRequired?: string | null; gifUrl?: string | null; videos?: { youtubeVideoId: string; title: string; status?: string }[] } | null;
  variation?: { name: string; spicyLevel: number } | null;
}

// Exercise Group (for superset grouping)
export interface ExerciseGroup {
  supersetGroup: string | null;
  exercises: WorkoutExercise[];
}

// Activity (external classes / generic logs)
export interface Activity {
  id: string;
  userId: string;
  name: string;
  durationMinutes: number | null;
  date: string;
  notes: string | null;
  createdAt: string;
}

// Workout Collections
export interface WorkoutCollection {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  routineNames: string[];
}

// Nutrition
export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
  mealType: string | null;
  rawInput: string;
  parsedItems: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface DailyNutrition {
  logs: NutritionLog[];
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
  };
  closed?: boolean;
}

export interface DailyNutritionSummary {
  id: string;
  userId: string;
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  mealCount: number;
  createdAt: string;
}

// Personal Food Database
export interface UserFood {
  id: string;
  userId: string;
  name: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

// Analytics
export interface AnalyticsData {
  period: string;
  totalWorkouts: number;
  totalVolume: number;
  avgVolumePerSession: number;
  volumeBySession: VolumeDataPoint[];
  volumeByWeek: WeeklyVolume[];
  progressiveOverload: ProgressiveOverloadSeries[];
  personalRecords: PersonalRecord[];
  plateaus: PlateauAlert[];
  repRangeAnalysis: RepRangeData[];
  nutrition: NutritionAnalytics;
}

export interface VolumeDataPoint {
  date: string;
  volume: number;
  name: string;
}

export interface WeeklyVolume {
  week: string;
  weekStart: string;
  volume: number;
}

export interface ProgressiveOverloadSeries {
  exerciseName: string;
  data: { date: string; maxWeight: number }[];
}

export interface PersonalRecord {
  exerciseName: string;
  muscleGroup: string;
  prWeight: number;
  prReps: number;
  prDate: string;
}

export interface PlateauAlert {
  exerciseName: string;
  stuckAtWeight: number;
  sessionCount: number;
  lastDate: string;
}

export interface RepRangeData {
  range: string;
  totalSets: number;
  avgWeight: number;
  percentage: number;
}

export interface WeeklyInsights {
  insights: string;
  generatedAt: string;
}

// Nutrition Analytics
export interface NutritionAnalytics {
  daysLogged: number;
  avgCalories: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  caloriesByDay: CalorieDayPoint[];
  macrosByDay: MacroDayPoint[];
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  compliance: {
    calorie: number;
    protein: number;
  };
  avgMealsPerDay: number;
  mealTypeDistribution: MealTypeCount[];
  topFoods: TopFood[];
}

export interface CalorieDayPoint {
  date: string;
  calories: number;
  target: number;
}

export interface MacroDayPoint {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealTypeCount {
  type: string;
  count: number;
  percentage: number;
}

export interface TopFood {
  name: string;
  count: number;
  avgCalories: number;
  avgProtein: number;
}

// Chat
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  modelUsed?: string | null;
}

// Admin — Token Usage
export interface UserUsageLimitData {
  id: string;
  userId: string;
  maxCallsPerDay: number | null;
  maxCallsPerWeek: number | null;
  maxCallsPerMonth: number | null;
  maxCostPerMonth: number | null;
  isThrottled: boolean;
  updatedAt: string;
}

export type UserTier = 'free' | 'pro' | 'unlimited';

export interface UserUsageSummary {
  userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null; tier: UserTier } | null;
  limits: UserUsageLimitData | null;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCostUsd: number;
}

export interface UsageResponse {
  users: UserUsageSummary[];
  totals: {
    totalCalls: number;
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  period: string;
  since: string;
}

export interface DailyUsageBreakdown {
  date: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface UserUsageDetail {
  user: { id: string; name: string | null; email: string | null; image: string | null; tier: UserTier } | null;
  limits: UserUsageLimitData | null;
  dailyBreakdown: DailyUsageBreakdown[];
  byEndpoint: Record<string, { calls: number; costUsd: number }>;
  totalRecords: number;
}

// Tier configuration (mirrors backend TIER_CONFIGS)
export const TIER_CONFIGS: Record<UserTier, { maxMessagesPerDay: number | null; models: string; label: string; color: string }> = {
  free: { maxMessagesPerDay: 20, models: 'Haiku', label: 'Free', color: 'slate' },
  pro: { maxMessagesPerDay: 100, models: 'Haiku + Sonnet', label: 'Pro', color: 'blue' },
  unlimited: { maxMessagesPerDay: null, models: 'Full access', label: 'Unlimited', color: 'amber' },
};
