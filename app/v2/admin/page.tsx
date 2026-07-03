'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ExerciseVideoLink } from '@/types';
import { ScreenHeader } from '@/components/redesign/ui';
import { CheckIcon, CloseIcon, SpinIcon } from '@/components/redesign/icons';

// Screen 16 · Admin — accent: violet
export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
  const [videos, setVideos] = useState<ExerciseVideoLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [job, setJob] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch('/api/admin/exercise-videos?status=pending').then((x) => (x.ok ? x.json() : [])).catch(() => []);
    setVideos(Array.isArray(r) ? r : []);
    setLoading(false);
  };
  useEffect(() => {
    if (isAdmin) load();
    else if (status !== 'loading') setLoading(false);
  }, [isAdmin, status]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      const r = await fetch(`/api/exercises/videos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (r.ok) setVideos((v) => v.filter((x) => x.id !== id));
    } finally {
      setActing(null);
    }
  };

  const runJob = async (name: string) => {
    setJob(name);
    try {
      await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: name }),
      });
    } finally {
      setJob(null);
    }
  };

  const goBack = () => router.push('/v2/settings');

  if (!isAdmin && status !== 'loading') {
    return (
      <div className="animate-fadeup space-y-5">
        <ScreenHeader title="Admin" back onBack={goBack} />
        <div className="rd-card p-6 text-center text-[13px] text-[var(--rd-text-muted)]">Admins only.</div>
      </div>
    );
  }

  return (
    <div className="animate-fadeup space-y-5">
      <ScreenHeader eyebrow="INTERNAL" title="Admin" back onBack={goBack} />

      {/* Job triggers */}
      <section>
        <p className="font-label mb-2 text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">JOBS</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'video-discovery', label: 'Discover videos' },
            { name: 'video-linking', label: 'Link videos' },
          ].map((j) => (
            <button
              key={j.name}
              onClick={() => runJob(j.name)}
              disabled={job === j.name}
              className="rd-card flex items-center justify-center gap-2 p-3.5 text-[13px] font-semibold text-[var(--rd-text-secondary)]"
            >
              <SpinIcon size={15} className={job === j.name ? 'animate-spinslow' : ''} />
              {job === j.name ? 'Running…' : j.label}
            </button>
          ))}
        </div>
      </section>

      {/* Pending videos */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">PENDING VIDEOS</p>
          <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{videos.length}</span>
        </div>
        {loading ? (
          <div className="space-y-2.5">{[0, 1].map((i) => <div key={i} className="rd-card h-[76px] animate-pulse-soft" />)}</div>
        ) : videos.length === 0 ? (
          <div className="rd-card p-6 text-center text-[13px] text-[var(--rd-text-muted)]">Queue is clear. 🎉</div>
        ) : (
          <div className="space-y-2.5">
            {videos.map((v) => (
              <div key={v.id} className="rd-card flex items-center gap-3 p-3">
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-[10px]" style={{ background: 'linear-gradient(135deg,#26282f,#15171c)' }}>
                  {v.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--rd-ink)]">{v.title}</p>
                  <p className="font-label mt-0.5 truncate text-[11px] text-[var(--rd-text-faint)]">
                    {[v.exerciseName, v.channelName, v.duration].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => review(v.id, 'reject')}
                    disabled={acting === v.id}
                    aria-label="Reject"
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--rd-border)] text-[var(--rd-ember)]"
                  >
                    <CloseIcon size={16} />
                  </button>
                  <button
                    onClick={() => review(v.id, 'approve')}
                    disabled={acting === v.id}
                    aria-label="Approve"
                    className="grad-lime flex h-9 w-9 items-center justify-center rounded-[10px] text-[#0A0C10]"
                  >
                    <CheckIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
