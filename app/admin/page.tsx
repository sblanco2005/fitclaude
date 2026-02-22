'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import type { ExerciseVideoLink } from '@/types';

type StatusFilter = 'pending' | 'approved' | 'rejected';
type VideoTab = 'tutorials' | 'reference';

interface UnlinkedExercise {
  id: string | null;
  name: string;
  muscleGroup: string;
  pendingCount: number;
  rejectedCount: number;
  source: 'library' | 'workout';
}

export default function AdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState<VideoTab>('tutorials');

  // Videos state
  const [videos, setVideos] = useState<ExerciseVideoLink[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedVidIds, setSelectedVidIds] = useState<Set<string>>(new Set());
  const [expandedVidId, setExpandedVidId] = useState<string | null>(null);
  const [loadingVid, setLoadingVid] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Unlinked exercises state
  const [unlinked, setUnlinked] = useState<UnlinkedExercise[]>([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(true);
  const [showUnlinked, setShowUnlinked] = useState(false);

  // Jobs state
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoadingVid(true);
    const res = await fetch(`/api/admin/exercise-videos?status=${statusFilter}`);
    if (res.ok) setVideos(await res.json());
    setLoadingVid(false);
  }, [statusFilter]);

  // Fetch unlinked exercises
  const fetchUnlinked = useCallback(async () => {
    setLoadingUnlinked(true);
    const res = await fetch('/api/admin/unlinked-exercises');
    if (res.ok) setUnlinked(await res.json());
    setLoadingUnlinked(false);
  }, []);

  useEffect(() => {
    fetchVideos();
    fetchUnlinked();
  }, [fetchVideos, fetchUnlinked]);

  // Filter videos by tab (tutorial vs reference) and search query
  const filteredVideos = useMemo(() => {
    let filtered = videos;
    if (activeTab === 'tutorials') {
      filtered = filtered.filter((v) => v.videoType === 'tutorial');
    } else {
      filtered = filtered.filter((v) => v.videoType === 'reference');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (v) =>
          v.exerciseName?.toLowerCase().includes(q) ||
          v.title?.toLowerCase().includes(q) ||
          v.channelName?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [videos, activeTab, searchQuery]);

  // Video actions
  const handleVideoAction = async (id: string, action: 'approve' | 'reject', videoType?: string) => {
    await fetch(`/api/admin/exercise-videos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(videoType && { videoType }) }),
    });
    fetchVideos();
    fetchUnlinked();
    setSelectedVidIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
    fetchUnlinked();
  };

  const handleDeleteVideo = async (id: string) => {
    await fetch(`/api/admin/exercise-videos/${id}`, { method: 'DELETE' });
    fetchVideos();
    fetchUnlinked();
    setSelectedVidIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const [refetchingExercise, setRefetchingExercise] = useState<string | null>(null);
  const handleRefetch = async (exerciseId: string) => {
    setRefetchingExercise(exerciseId);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/search-videos?force=true`, { method: 'POST' });
      if (res.ok) {
        fetchVideos();
        fetchUnlinked();
      }
    } finally {
      setRefetchingExercise(null);
    }
  };

  const runJob = async (job: 'video-linking' | 'video-discovery') => {
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
      fetchVideos();
      fetchUnlinked();
    } catch (e) {
      setJobResult(`Error: ${e}`);
    } finally {
      setRunningJob(null);
    }
  };

  const toggleSelectVid = (id: string) => {
    setSelectedVidIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVid = () => {
    const visibleIds = filteredVideos.map((v) => v.id);
    const allSelected = visibleIds.every((id) => selectedVidIds.has(id));
    if (allSelected) setSelectedVidIds(new Set());
    else setSelectedVidIds(new Set(visibleIds));
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
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Admin</h1>
            <p className="text-xs text-muted mt-0.5">Video review & exercise management</p>
          </div>
          <button
            onClick={() => router.push('/settings')}
            className="text-xs text-muted hover:text-white transition-colors"
          >
            Back to Settings
          </button>
        </div>

        {/* ─── Tab Switcher ─── */}
        <div className="flex rounded-xl bg-card border border-border-dark p-1 mb-4">
          <button
            onClick={() => { setActiveTab('tutorials'); setSelectedVidIds(new Set()); setSearchQuery(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'tutorials'
                ? 'bg-emerald-500/15 text-emerald-400 shadow-sm'
                : 'text-muted hover:text-slate-300'
            }`}
          >
            Tutorials
          </button>
          <button
            onClick={() => { setActiveTab('reference'); setSelectedVidIds(new Set()); setSearchQuery(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'reference'
                ? 'bg-blue-500/15 text-blue-400 shadow-sm'
                : 'text-muted hover:text-slate-300'
            }`}
          >
            Reference
          </button>
        </div>

        {/* ─── Job Button (contextual per tab) ─── */}
        <button
          onClick={() => runJob(activeTab === 'tutorials' ? 'video-linking' : 'video-discovery')}
          disabled={!!runningJob}
          className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 mb-4 ${
            activeTab === 'tutorials'
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
              : 'bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10'
          }`}
        >
          {runningJob ? (
            <span className="text-primary">Running...</span>
          ) : activeTab === 'tutorials' ? (
            <>Run Video Linker<span className="text-muted ml-1.5 font-normal">— find best tutorial per exercise</span></>
          ) : (
            <>Run Video Discovery<span className="text-muted ml-1.5 font-normal">— fetch reference videos from YouTube</span></>
          )}
        </button>

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

        {/* ─── Unlinked Exercises (tutorials tab only) ─── */}
        {activeTab === 'tutorials' && (
          <div className="mb-5">
            <button
              onClick={() => setShowUnlinked((v) => !v)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-card border border-border-dark hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Unlinked Exercises</span>
                {unlinked.length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                    {unlinked.length}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform ${showUnlinked ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUnlinked && (
              <div className="mt-2 rounded-xl border border-border-dark overflow-hidden">
                {loadingUnlinked ? (
                  <p className="text-center text-muted text-xs py-6">Loading...</p>
                ) : unlinked.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-primary font-bold">All exercises are linked!</p>
                    <p className="text-xs text-muted mt-0.5">Every exercise has at least one approved video.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    <div className="px-4 py-2 bg-slate-800/30">
                      <p className="text-[10px] text-muted uppercase tracking-widest font-bold">
                        Run Video Linker to search for tutorials
                      </p>
                    </div>
                    {unlinked.map((ex, i) => (
                      <div key={ex.id ?? `orphan-${i}`} className="flex items-center justify-between px-4 py-2.5 gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                            {ex.source === 'workout' && (
                              <span className="text-[9px] font-bold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                Not in library
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 capitalize">{ex.muscleGroup}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ex.pendingCount > 0 && (
                            <Badge variant="warning" size="sm">
                              {ex.pendingCount} pending
                            </Badge>
                          )}
                          {ex.rejectedCount > 0 && (
                            <Badge variant="danger" size="sm">
                              {ex.rejectedCount} rejected
                            </Badge>
                          )}
                          {ex.source === 'library' && ex.pendingCount === 0 && ex.rejectedCount === 0 && (
                            <span className="text-[10px] text-slate-600 font-medium">No videos</span>
                          )}
                          {ex.source === 'workout' && (
                            <button
                              onClick={async () => {
                                await fetch('/api/exercises', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    name: ex.name,
                                    muscleGroup: ex.muscleGroup,
                                    exerciseType: 'compound',
                                  }),
                                });
                                fetchUnlinked();
                              }}
                              className="text-[10px] font-bold text-primary bg-primary/15 hover:bg-primary/25 px-2 py-1 rounded-lg transition-colors"
                            >
                              + Add to Library
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Video Review ─── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">
            {activeTab === 'tutorials' ? 'Tutorial' : 'Reference'} Videos
          </h2>
          <span className="text-[10px] text-muted font-medium">{filteredVideos.length} {statusFilter}</span>
        </div>

        {/* Status filter pills + search bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1.5">
            {(['pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setSelectedVidIds(new Set()); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  statusFilter === s
                    ? s === 'pending'
                      ? 'bg-amber-500/15 text-amber-400'
                      : s === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                    : 'bg-card text-muted hover:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercise or video..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-card border border-border-dark text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedVidIds.size > 0 && (
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

        {/* Video list */}
        <div className="space-y-3">
          {loadingVid ? (
            <p className="text-center text-muted text-sm py-12">Loading...</p>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted text-sm font-medium">
                {searchQuery
                  ? `No ${statusFilter} ${activeTab} matching "${searchQuery}"`
                  : `No ${statusFilter} ${activeTab} videos`}
              </p>
              <p className="text-slate-600 text-xs mt-1">
                {statusFilter === 'pending'
                  ? `Run ${activeTab === 'tutorials' ? 'Video Linker' : 'Video Discovery'} to search for videos`
                  : searchQuery
                  ? 'Try a different search term'
                  : 'Change the filter to see other videos'}
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={toggleSelectAllVid}
                className="text-[10px] text-muted hover:text-white font-medium transition-colors"
              >
                {filteredVideos.every((v) => selectedVidIds.has(v.id)) ? 'Deselect all' : 'Select all'}
              </button>

              {filteredVideos.map((vid) => {
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
                          </div>
                        </button>

                        {/* Inline YouTube preview */}
                        {vid.youtubeVideoId && (
                          <div className="mt-3">
                            {isExpanded ? (
                              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900">
                                <iframe
                                  src={`https://www.youtube.com/embed/${vid.youtubeVideoId}?autoplay=1`}
                                  className="w-full h-full"
                                  allow="autoplay; encrypted-media"
                                  allowFullScreen
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => setExpandedVidId(vid.id)}
                                className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-900 group"
                              >
                                <img
                                  src={vid.thumbnailUrl || `https://img.youtube.com/vi/${vid.youtubeVideoId}/mqdefault.jpg`}
                                  alt={vid.title}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </div>
                                </div>
                              </button>
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
                          Approve
                        </button>
                        <button
                          onClick={() => handleVideoAction(vid.id, 'reject')}
                          className="py-1.5 px-3 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
                        >
                          Reject
                        </button>
                        {vid.exerciseId && (
                          <button
                            onClick={() => handleRefetch(vid.exerciseId!)}
                            disabled={refetchingExercise === vid.exerciseId}
                            className="py-1.5 px-3 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            {refetchingExercise === vid.exerciseId ? 'Searching...' : 'Re-fetch'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-500 text-[10px] font-bold hover:bg-slate-700 hover:text-slate-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {vid.status !== 'pending' && (
                      <div className="flex items-center justify-between px-4 pb-3">
                        <Badge variant={vid.status === 'approved' ? 'success' : 'danger'} size="sm">
                          {vid.status}
                        </Badge>
                        <button
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="text-[10px] text-slate-600 hover:text-red-400 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
