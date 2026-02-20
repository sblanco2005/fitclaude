'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import type { PendingExercise, ExerciseVideoLink } from '@/types';

type Tab = 'exercises' | 'videos';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('exercises');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  // Pending exercises state
  const [exercises, setExercises] = useState<PendingExercise[]>([]);
  const [selectedExIds, setSelectedExIds] = useState<Set<string>>(new Set());
  const [expandedExId, setExpandedExId] = useState<string | null>(null);
  const [loadingEx, setLoadingEx] = useState(true);

  // Videos state
  const [videos, setVideos] = useState<ExerciseVideoLink[]>([]);
  const [selectedVidIds, setSelectedVidIds] = useState<Set<string>>(new Set());
  const [expandedVidId, setExpandedVidId] = useState<string | null>(null);
  const [loadingVid, setLoadingVid] = useState(true);

  // Jobs state
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  // Fetch data
  const fetchExercises = useCallback(async () => {
    setLoadingEx(true);
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    const res = await fetch(`/api/admin/pending-exercises${params}`);
    if (res.ok) setExercises(await res.json());
    setLoadingEx(false);
  }, [statusFilter]);

  const fetchVideos = useCallback(async () => {
    setLoadingVid(true);
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    const res = await fetch(`/api/admin/exercise-videos${params}`);
    if (res.ok) setVideos(await res.json());
    setLoadingVid(false);
  }, [statusFilter]);

  useEffect(() => {
    if (tab === 'exercises') fetchExercises();
    else fetchVideos();
  }, [tab, statusFilter, fetchExercises, fetchVideos]);

  // Actions
  const handleExerciseAction = async (id: string, action: 'approve' | 'reject') => {
    await fetch(`/api/admin/pending-exercises/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    fetchExercises();
    setSelectedExIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleVideoAction = async (id: string, action: 'approve' | 'reject', videoType?: string) => {
    await fetch(`/api/admin/exercise-videos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(videoType && { videoType }) }),
    });
    fetchVideos();
    setSelectedVidIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleBulkExercise = async (action: 'approve' | 'reject') => {
    if (selectedExIds.size === 0) return;
    await fetch('/api/admin/pending-exercises/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedExIds), action }),
    });
    setSelectedExIds(new Set());
    fetchExercises();
  };

  const handleBulkVideo = async (action: 'approve' | 'reject') => {
    if (selectedVidIds.size === 0) return;
    await fetch('/api/admin/exercise-videos/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedVidIds), action }),
    });
    setSelectedVidIds(new Set());
    fetchVideos();
  };

  const handleDeleteExercise = async (id: string) => {
    await fetch(`/api/admin/pending-exercises/${id}`, { method: 'DELETE' });
    fetchExercises();
  };

  const handleDeleteVideo = async (id: string) => {
    await fetch(`/api/admin/exercise-videos/${id}`, { method: 'DELETE' });
    fetchVideos();
    setSelectedVidIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleDeleteAllExercises = async () => {
    if (!confirm('Delete ALL pending exercises? This cannot be undone.')) return;
    await fetch('/api/admin/pending-exercises/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [], action: 'delete-all' }),
    });
    setSelectedExIds(new Set());
    fetchExercises();
  };

  const handleDeleteAllVideos = async () => {
    if (!confirm('Delete ALL exercise videos? This cannot be undone.')) return;
    await fetch('/api/admin/exercise-videos/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [], action: 'delete-all' }),
    });
    setSelectedVidIds(new Set());
    fetchVideos();
  };

  const runJob = async (job: 'video-linking' | 'video-discovery' | 'exercise-discovery') => {
    setRunningJob(job);
    setJobResult(null);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      setJobResult(JSON.stringify(data, null, 2));
      // Refresh data
      if (job === 'video-linking' || job === 'video-discovery') fetchVideos();
      else fetchExercises();
    } catch (e) {
      setJobResult(`Error: ${e}`);
    } finally {
      setRunningJob(null);
    }
  };

  const toggleSelectEx = (id: string) => {
    setSelectedExIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVid = (id: string) => {
    setSelectedVidIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllEx = () => {
    if (selectedExIds.size === exercises.length) setSelectedExIds(new Set());
    else setSelectedExIds(new Set(exercises.map((e) => e.id)));
  };

  const toggleSelectAllVid = () => {
    if (selectedVidIds.size === videos.length) setSelectedVidIds(new Set());
    else setSelectedVidIds(new Set(videos.map((v) => v.id)));
  };

  const difficultyVariant = (d: string) => {
    if (d === 'beginner') return 'success' as const;
    if (d === 'advanced') return 'danger' as const;
    return 'warning' as const;
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Admin Review</h1>
            <p className="text-xs text-muted mt-0.5">YouTube Subagent submissions</p>
          </div>
          <button
            onClick={() => router.push('/settings')}
            className="text-xs text-muted hover:text-white transition-colors"
          >
            Back to Settings
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-4">
          {([
            { key: 'exercises' as Tab, label: 'Exercises', count: exercises.length },
            { key: 'videos' as Tab, label: 'Videos', count: videos.length },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSelectedExIds(new Set()); setSelectedVidIds(new Set()); }}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                tab === key
                  ? 'bg-primary/15 text-primary'
                  : 'bg-card text-muted hover:text-white'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 mb-4">
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                statusFilter === s
                  ? 'bg-white/10 text-white'
                  : 'bg-card text-muted hover:text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Run Job buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => runJob('video-linking')}
            disabled={!!runningJob}
            className="flex-1 py-2 rounded-xl bg-card hover:bg-card-hover text-xs font-bold text-slate-300 transition-all disabled:opacity-50"
          >
            {runningJob === 'video-linking' ? 'Running...' : 'Video Linker'}
          </button>
          <button
            onClick={() => runJob('video-discovery')}
            disabled={!!runningJob}
            className="flex-1 py-2 rounded-xl bg-card hover:bg-card-hover text-xs font-bold text-slate-300 transition-all disabled:opacity-50"
          >
            {runningJob === 'video-discovery' ? 'Running...' : 'Video Discovery'}
          </button>
          <button
            onClick={() => runJob('exercise-discovery')}
            disabled={!!runningJob}
            className="flex-1 py-2 rounded-xl bg-card hover:bg-card-hover text-xs font-bold text-slate-300 transition-all disabled:opacity-50"
          >
            {runningJob === 'exercise-discovery' ? 'Running...' : 'Exercise Discovery'}
          </button>
        </div>
        {/* Delete All buttons */}
        <div className="flex gap-2 mb-5">
          {tab === 'exercises' && exercises.length > 0 && (
            <button
              onClick={handleDeleteAllExercises}
              className="flex-1 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest transition-all"
            >
              Delete All Exercises
            </button>
          )}
          {tab === 'videos' && videos.length > 0 && (
            <button
              onClick={handleDeleteAllVideos}
              className="flex-1 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-widest transition-all"
            >
              Delete All Videos
            </button>
          )}
        </div>

        {/* Job result banner */}
        {jobResult && (
          <div className="mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Job Result</span>
              <button onClick={() => setJobResult(null)} className="text-slate-500 hover:text-white text-xs">dismiss</button>
            </div>
            <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap">{jobResult}</pre>
          </div>
        )}

        {/* Bulk action bar */}
        {tab === 'exercises' && selectedExIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-xs text-primary font-bold">{selectedExIds.size} selected</span>
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => handleBulkExercise('approve')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBulkExercise('reject')}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
              >
                Reject All
              </button>
            </div>
          </div>
        )}
        {tab === 'videos' && selectedVidIds.size > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-xs text-primary font-bold">{selectedVidIds.size} selected</span>
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => handleBulkVideo('approve')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBulkVideo('reject')}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
              >
                Reject All
              </button>
            </div>
          </div>
        )}

        {/* Exercises tab */}
        {tab === 'exercises' && (
          <div className="space-y-3">
            {loadingEx ? (
              <p className="text-center text-muted text-sm py-12">Loading...</p>
            ) : exercises.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted text-sm font-medium">No {statusFilter === 'all' ? '' : statusFilter} exercises</p>
                <p className="text-slate-600 text-xs mt-1">Run the discovery job to find new exercises</p>
              </div>
            ) : (
              <>
                {/* Select all */}
                <button
                  onClick={toggleSelectAllEx}
                  className="text-[10px] text-muted hover:text-white font-medium transition-colors"
                >
                  {selectedExIds.size === exercises.length ? 'Deselect all' : 'Select all'}
                </button>

                {exercises.map((ex) => {
                  const isExpanded = expandedExId === ex.id;
                  const isSelected = selectedExIds.has(ex.id);

                  return (
                    <div
                      key={ex.id}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isSelected ? 'border-primary/40 bg-primary/5' : 'border-border-dark bg-card'
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-start gap-3 p-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelectEx(ex.id)}
                          className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-slate-600 hover:border-slate-400'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setExpandedExId(isExpanded ? null : ex.id)}
                            className="text-left w-full"
                          >
                            <h3 className="text-sm font-bold text-white">{ex.name}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <Badge variant="info" size="sm">{ex.muscleGroup}</Badge>
                              <Badge variant={difficultyVariant(ex.difficulty)} size="sm">{ex.difficulty}</Badge>
                              <Badge size="sm">{ex.exerciseType}</Badge>
                              {ex.channelName && (
                                <Badge variant="default" size="sm">{ex.channelName}</Badge>
                              )}
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="mt-3 space-y-2">
                              {ex.equipmentRequired && (
                                <p className="text-[10px] text-slate-400">
                                  <span className="text-slate-500 uppercase tracking-widest font-bold">Equipment: </span>
                                  {ex.equipmentRequired}
                                </p>
                              )}
                              {ex.instructions && (
                                <p className="text-xs text-slate-300 leading-relaxed">{ex.instructions}</p>
                              )}
                              {ex.pendingVariations.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">
                                    Variations ({ex.pendingVariations.length})
                                  </p>
                                  {ex.pendingVariations.map((v) => (
                                    <div key={v.id} className="ml-2 mb-1">
                                      <p className="text-xs text-white font-medium">{v.name}</p>
                                      <p className="text-[10px] text-slate-400">{v.description}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* YouTube thumbnail */}
                              {ex.youtubeVideoId && (
                                <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mt-2">
                                  <iframe
                                    src={`https://www.youtube.com/embed/${ex.youtubeVideoId}`}
                                    className="w-full h-full"
                                    allowFullScreen
                                    loading="lazy"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card actions */}
                      {ex.status === 'pending' && (
                        <div className="flex gap-1.5 px-4 pb-3">
                          <button
                            onClick={() => handleExerciseAction(ex.id, 'approve')}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/25 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleExerciseAction(ex.id, 'reject')}
                            className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(ex.id)}
                            className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-500 text-[10px] font-bold hover:bg-slate-700 hover:text-slate-300 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {ex.status !== 'pending' && (
                        <div className="px-4 pb-3">
                          <Badge variant={ex.status === 'approved' ? 'success' : 'danger'} size="sm">
                            {ex.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Videos tab */}
        {tab === 'videos' && (
          <div className="space-y-3">
            {loadingVid ? (
              <p className="text-center text-muted text-sm py-12">Loading...</p>
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted text-sm font-medium">No {statusFilter === 'all' ? '' : statusFilter} video links</p>
                <p className="text-slate-600 text-xs mt-1">Run the video linker job to find tutorials</p>
              </div>
            ) : (
              <>
                <button
                  onClick={toggleSelectAllVid}
                  className="text-[10px] text-muted hover:text-white font-medium transition-colors"
                >
                  {selectedVidIds.size === videos.length ? 'Deselect all' : 'Select all'}
                </button>

                {videos.map((vid) => {
                  const isExpanded = expandedVidId === vid.id;
                  const isSelected = selectedVidIds.has(vid.id);

                  return (
                    <div
                      key={vid.id}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isSelected ? 'border-primary/40 bg-primary/5' : 'border-border-dark bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelectVid(vid.id)}
                          className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-slate-600 hover:border-slate-400'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setExpandedVidId(isExpanded ? null : vid.id)}
                            className="text-left w-full"
                          >
                            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{vid.exerciseName}</p>
                            <h3 className="text-sm font-bold text-white mt-0.5 line-clamp-2">{vid.title}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {vid.channelName && <Badge size="sm">{vid.channelName}</Badge>}
                              {vid.viewCount && (
                                <Badge variant="info" size="sm">
                                  {vid.viewCount > 1000000
                                    ? `${(vid.viewCount / 1000000).toFixed(1)}M views`
                                    : vid.viewCount > 1000
                                    ? `${(vid.viewCount / 1000).toFixed(0)}K views`
                                    : `${vid.viewCount} views`}
                                </Badge>
                              )}
                              {vid.isPrimary && <Badge variant="success" size="sm">Primary</Badge>}
                              {vid.videoType === 'reference' && <Badge variant="info" size="sm">Reference</Badge>}
                            </div>
                          </button>

                          {/* Watch link */}
                          {vid.youtubeVideoId && (
                            <a
                              href={`https://www.youtube.com/watch?v=${vid.youtubeVideoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                              </svg>
                              Watch on YouTube
                            </a>
                          )}

                          {/* Expanded: YouTube embed */}
                          {isExpanded && (
                            <div className="mt-3">
                              {vid.thumbnailUrl && !isExpanded ? (
                                <img
                                  src={vid.thumbnailUrl}
                                  alt={vid.title}
                                  className="w-full rounded-lg"
                                />
                              ) : (
                                <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
                                  <iframe
                                    src={`https://www.youtube.com/embed/${vid.youtubeVideoId}`}
                                    className="w-full h-full"
                                    allowFullScreen
                                    loading="lazy"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {vid.status === 'pending' && (
                        <div className="flex gap-1.5 px-4 pb-3">
                          <button
                            onClick={() => handleVideoAction(vid.id, 'approve', 'tutorial')}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/25 transition-colors"
                          >
                            Tutorial
                          </button>
                          <button
                            onClick={() => handleVideoAction(vid.id, 'approve', 'reference')}
                            className="flex-1 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/25 transition-colors"
                          >
                            Reference
                          </button>
                          <button
                            onClick={() => handleVideoAction(vid.id, 'reject')}
                            className="py-1.5 px-3 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleDeleteVideo(vid.id)}
                            className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-500 text-[10px] font-bold hover:bg-slate-700 hover:text-slate-300 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {vid.status !== 'pending' && (
                        <div className="px-4 pb-3">
                          <Badge variant={vid.status === 'approved' ? 'success' : 'danger'} size="sm">
                            {vid.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
