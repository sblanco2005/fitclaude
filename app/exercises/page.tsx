'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Exercise, ExerciseVideoWithExercise } from '@/types';

type PageTab = 'exercises' | 'videos';

const muscleGroups = [
  'all', 'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quadriceps', 'hamstrings', 'glutes', 'core', 'calves', 'full_body',
];

const exerciseTypes = [
  'compound', 'isolation', 'cardio', 'stretch', 'plyometric',
];

const difficultyOptions = ['beginner', 'intermediate', 'advanced'];

const difficultyBadge: Record<string, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

function formatViews(n: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K views`;
  return `${n} views`;
}

const emptyForm = {
  name: '',
  muscleGroup: '',
  exerciseType: '',
  difficulty: 'intermediate',
  equipmentRequired: '',
  secondaryMuscles: '',
  instructions: '',
};

export default function ExercisesPage() {
  const { data: session } = useSession();

  // Tab state
  const [tab, setTab] = useState<PageTab>('exercises');

  // Exercises tab
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Videos tab
  const [videos, setVideos] = useState<ExerciseVideoWithExercise[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoMuscleFilter, setVideoMuscleFilter] = useState('all');

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Create exercise modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Fetch exercises
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (muscleFilter !== 'all') params.set('muscleGroup', muscleFilter);

    fetch(`/api/exercises?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setExercises(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, muscleFilter]);

  // Fetch reference videos
  useEffect(() => {
    if (tab !== 'videos') return;
    setVideosLoading(true);
    const params = new URLSearchParams();
    if (videoMuscleFilter !== 'all') params.set('muscleGroup', videoMuscleFilter);

    fetch(`/api/exercises/videos?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setVideos(Array.isArray(data) ? data : []);
        setVideosLoading(false);
      })
      .catch(() => {
        setVideos([]);
        setVideosLoading(false);
      });
  }, [tab, videoMuscleFilter]);

  // Group videos by muscle group
  const groupedVideos = useMemo(() => {
    const map: Record<string, ExerciseVideoWithExercise[]> = {};
    for (const v of videos) {
      const group = v.exercise?.muscleGroup ?? 'other';
      if (!map[group]) map[group] = [];
      map[group].push(v);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [videos]);

  const handleDismissVideo = async (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    await fetch(`/api/exercises/videos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
  };

  const startRename = (exercise: Exercise) => {
    setEditingId(exercise.id);
    setEditName(exercise.name);
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/exercises/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updated } : e))
      );
    }
    setEditingId(null);
  };

  const handleCreateExercise = async () => {
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });

    if (res.status === 409) {
      setCreateError('An exercise with this name already exists.');
      setCreateLoading(false);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error || 'Failed to create exercise.');
      setCreateLoading(false);
      return;
    }

    const newExercise = await res.json();

    // Add to list
    setExercises((prev) =>
      [...prev, newExercise].sort((a, b) => a.name.localeCompare(b.name))
    );

    // Trigger video search
    setCreateSuccess(`Created "${newExercise.name}". Searching for videos...`);
    try {
      const videoRes = await fetch(`/api/exercises/${newExercise.id}/search-videos`, {
        method: 'POST',
      });
      const videoData = await videoRes.json();
      if (videoData.added > 0) {
        setCreateSuccess(`Created "${newExercise.name}" and found ${videoData.added} videos. Check admin to approve them.`);
      } else {
        setCreateSuccess(`Created "${newExercise.name}". No videos found — you can search later.`);
      }
    } catch {
      setCreateSuccess(`Created "${newExercise.name}". Video search failed — you can retry later.`);
    }

    setCreateForm({ ...emptyForm });
    setCreateLoading(false);
  };

  const activeFilter = tab === 'exercises' ? muscleFilter : videoMuscleFilter;
  const setActiveFilter = tab === 'exercises' ? setMuscleFilter : setVideoMuscleFilter;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Exercise Library</h2>
        {session && (
          <Button size="sm" onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateSuccess(null); }}>
            + Add
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['exercises', 'videos'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-primary text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'exercises' ? 'Exercises' : 'Videos'}
          </button>
        ))}
      </div>

      {/* Search (exercises tab only) */}
      {tab === 'exercises' && (
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {/* Muscle Group Filter (shared) */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {muscleGroups.map((group) => (
          <button
            key={group}
            onClick={() => setActiveFilter(group)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === group
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {group === 'all' ? 'All' : group.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* === EXERCISES TAB === */}
      {tab === 'exercises' && (
        <>
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
                  <div onClick={() => { if (editingId !== exercise.id) setExpandedId(expandedId === exercise.id ? null : exercise.id); }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingId === exercise.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(exercise.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="bg-slate-800 text-white border border-primary rounded px-2 py-1 text-sm font-semibold w-full focus:outline-none"
                            />
                            <button
                              onClick={() => handleRename(exercise.id)}
                              className="text-xs text-primary font-bold hover:text-primary/80 shrink-0"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-slate-500 hover:text-white shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{exercise.name}</h3>
                            {session && (
                              <button
                                onClick={(e) => { e.stopPropagation(); startRename(exercise); }}
                                className="text-slate-600 hover:text-slate-300 transition-colors"
                                title="Rename exercise"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
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
                          {'🌶️'} {exercise.variations.length}
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

                      {/* Tutorial Video */}
                      {exercise.videos && exercise.videos.length > 0 && (() => {
                        const primary = exercise.videos.find((v) => v.isPrimary) || exercise.videos[0];
                        return (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-400">Tutorial Video</h4>
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
                              <iframe
                                src={`https://www.youtube.com/embed/${primary.youtubeVideoId}`}
                                className="w-full h-full"
                                allowFullScreen
                                loading="lazy"
                              />
                            </div>
                            {primary.channelName && (
                              <p className="text-[10px] text-slate-500">{primary.channelName}</p>
                            )}
                            {exercise.videos.length > 1 && (
                              <p className="text-[10px] text-muted">
                                + {exercise.videos.length - 1} more video{exercise.videos.length > 2 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        );
                      })()}

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
        </>
      )}

      {/* === VIDEOS TAB === */}
      {tab === 'videos' && (
        <>
          {videosLoading ? (
            <div className="text-center text-muted py-8">Loading videos...</div>
          ) : videos.length === 0 ? (
            <Card>
              <p className="text-muted text-sm text-center">
                No reference videos yet. Run Video Discovery from the admin page to import them.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedVideos.map(([group, groupVids]) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    {group.replace('_', ' ')}
                  </h3>
                  <div className="space-y-3">
                    {groupVids.map((video) => (
                      <Card key={video.id} className="p-0 overflow-hidden">
                        {/* Thumbnail */}
                        {video.thumbnailUrl && (
                          <a
                            href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block relative aspect-video bg-slate-900"
                          >
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
                              <svg className="w-12 h-12 text-white/80" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </a>
                        )}
                        {/* Meta */}
                        <div className="p-3 space-y-2">
                          <p className="text-sm font-semibold text-white line-clamp-2">{video.title}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {video.channelName && (
                              <Badge size="sm" variant="default">{video.channelName}</Badge>
                            )}
                            {video.viewCount != null && video.viewCount > 0 && (
                              <span className="text-[10px] text-slate-500">{formatViews(video.viewCount)}</span>
                            )}
                          </div>
                          {session && (
                            <button
                              onClick={() => handleDismissVideo(video.id)}
                              className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === ADD EXERCISE MODAL === */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Exercise" size="lg">
        <div className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {createError}
            </div>
          )}
          {createSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
              {createSuccess}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <Input
              placeholder="e.g. Bulgarian Split Squat"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Muscle Group *</label>
            <select
              value={createForm.muscleGroup}
              onChange={(e) => setCreateForm((f) => ({ ...f, muscleGroup: e.target.value }))}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select...</option>
              {muscleGroups.filter((g) => g !== 'all').map((g) => (
                <option key={g} value={g}>{g.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Exercise Type *</label>
            <select
              value={createForm.exerciseType}
              onChange={(e) => setCreateForm((f) => ({ ...f, exerciseType: e.target.value }))}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select...</option>
              {exerciseTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Difficulty</label>
            <select
              value={createForm.difficulty}
              onChange={(e) => setCreateForm((f) => ({ ...f, difficulty: e.target.value }))}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {difficultyOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Equipment Required</label>
            <Input
              placeholder="e.g. barbell, bench"
              value={createForm.equipmentRequired}
              onChange={(e) => setCreateForm((f) => ({ ...f, equipmentRequired: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Secondary Muscles</label>
            <Input
              placeholder="e.g. core, glutes"
              value={createForm.secondaryMuscles}
              onChange={(e) => setCreateForm((f) => ({ ...f, secondaryMuscles: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Instructions</label>
            <textarea
              placeholder="How to perform the exercise..."
              value={createForm.instructions}
              onChange={(e) => setCreateForm((f) => ({ ...f, instructions: e.target.value }))}
              rows={3}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateExercise}
              disabled={createLoading || !createForm.name || !createForm.muscleGroup || !createForm.exerciseType}
            >
              {createLoading ? 'Creating...' : 'Create & Search Videos'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
