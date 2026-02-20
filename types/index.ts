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
  sex: string | null;
  trainingFrequency: number | null;
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
  durationMinutes: number | null;
  notes: string | null;
  fatigueRating: number | null;
  completed: boolean;
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
  exercise?: { name: string; muscleGroup: string; videos?: { youtubeVideoId: string; title: string }[] } | null;
  variation?: { name: string; spicyLevel: number } | null;
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
}

// Chat
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}
