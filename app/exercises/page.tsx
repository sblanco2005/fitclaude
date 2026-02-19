'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { Exercise } from '@/types';

const muscleGroups = [
  'all', 'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'core', 'calves', 'full_body',
];

const difficultyBadge: Record<string, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (muscleFilter !== 'all') params.set('muscleGroup', muscleFilter);

    fetch(`/api/exercises?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setExercises(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, muscleFilter]);

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Exercise Library</h2>

      {/* Search */}
      <Input
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Muscle Group Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {muscleGroups.map((group) => (
          <button
            key={group}
            onClick={() => setMuscleFilter(group)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              muscleFilter === group
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {group === 'all' ? 'All' : group.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Exercises */}
      {loading ? (
        <div className="text-center text-muted py-8">Loading exercises...</div>
      ) : exercises.length === 0 ? (
        <Card>
          <p className="text-muted text-sm text-center">No exercises found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <Card
              key={exercise.id}
              hover
              className="cursor-pointer"
            >
              <div onClick={() => setExpandedId(expandedId === exercise.id ? null : exercise.id)}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{exercise.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="info" size="sm">
                        {exercise.muscleGroup.replace('_', ' ')}
                      </Badge>
                      <Badge variant={difficultyBadge[exercise.difficulty] || 'default'} size="sm">
                        {exercise.difficulty}
                      </Badge>
                    </div>
                  </div>
                  {exercise.variations.length > 0 && (
                    <span className="text-xs text-muted">
                      🌶️ {exercise.variations.length}
                    </span>
                  )}
                </div>
                {exercise.equipmentRequired && (
                  <p className="text-xs text-muted mt-1">{exercise.equipmentRequired}</p>
                )}
              </div>

              {expandedId === exercise.id && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                  {exercise.instructions && (
                    <p className="text-sm text-slate-300">{exercise.instructions}</p>
                  )}

                  {exercise.variations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-400">Spicy Variations</h4>
                      {exercise.variations.map((v) => (
                        <div key={v.id} className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{v.name}</span>
                            <span className="text-xs">
                              {'🌶️'.repeat(v.spicyLevel)}
                            </span>
                          </div>
                          <p className="text-xs text-muted">{v.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
