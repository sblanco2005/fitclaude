'use client';

import type { WorkoutExercise } from '@/types';
import { groupExercises } from '@/lib/workout-utils';

interface SetLog {
  set: number;
  weight: number;
  reps: number;
}

interface ExerciseListSheetProps {
  exercises: WorkoutExercise[];
  exerciseLogs: Map<string, SetLog[]>;
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  getExerciseName: (ex: WorkoutExercise) => string;
  getExerciseMuscle: (ex: WorkoutExercise) => string | null;
  skippedExercises?: Set<string>;
}

export default function ExerciseListSheet({
  exercises,
  exerciseLogs,
  currentIndex,
  onSelect,
  onClose,
  getExerciseName,
  getExerciseMuscle,
  skippedExercises,
}: ExerciseListSheetProps) {
  const groups = groupExercises(exercises);

  // Build a flat index lookup for each exercise
  const exerciseIndexMap = new Map<string, number>();
  exercises.forEach((ex, i) => exerciseIndexMap.set(ex.id, i));

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="absolute bottom-0 inset-x-0 bg-[#111118] rounded-t-2xl max-h-[70vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Exercises</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-2 pb-4">
          {groups.map((group, gi) => {
            const isSuperset = group.exercises.length > 1;

            return (
              <div key={gi}>
                {isSuperset && (
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/60">
                      Superset {group.supersetGroup}
                    </span>
                    <div className="flex-1 h-px bg-amber-400/10" />
                  </div>
                )}
                {group.exercises.map((ex, ei) => {
                  const flatIdx = exerciseIndexMap.get(ex.id) ?? 0;
                  const logs = exerciseLogs.get(ex.id) ?? [];
                  const numSets = ex.sets || 3;
                  const allDone = logs.length >= numSets;
                  const isCurrent = flatIdx === currentIndex;
                  const muscle = getExerciseMuscle(ex);
                  const isSkip = skippedExercises?.has(ex.id) ?? false;
                  const ssLabel = isSuperset ? `${group.supersetGroup}${ei + 1}` : null;

                  return (
                    <button
                      key={ex.id}
                      onClick={() => { onSelect(flatIdx); onClose(); }}
                      className={`w-full flex items-center gap-3 py-3 rounded-lg transition-colors ${
                        isSuperset ? 'pl-5 pr-3' : 'px-3'
                      } ${
                        isCurrent
                          ? 'bg-primary/10'
                          : 'hover:bg-slate-800/50 active:bg-slate-800/70'
                      }`}
                    >
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        {ssLabel ? (
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black">
                            {ssLabel}
                          </span>
                        ) : isSkip ? (
                          <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        ) : allDone ? (
                          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isCurrent ? (
                          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        ) : (
                          <span className="w-4 h-4 rounded-full border-2 border-slate-700" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <div className={`text-xs font-semibold truncate ${
                          isSkip ? 'text-slate-600 line-through' : allDone ? 'text-primary' : isCurrent ? 'text-white' : 'text-slate-400'
                        }`}>
                          {getExerciseName(ex)}
                        </div>
                        {muscle && (
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">
                            {muscle}
                          </div>
                        )}
                      </div>

                      {isSkip ? (
                        <span className="text-[10px] font-bold text-slate-600 shrink-0">Skip</span>
                      ) : (
                        <span className={`text-[10px] tabular-nums font-bold shrink-0 ${allDone ? 'text-primary' : 'text-slate-600'}`}>
                          {logs.length}/{numSets}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
