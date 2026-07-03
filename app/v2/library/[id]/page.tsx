'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Exercise } from '@/types';
import { primaryVideo } from '@/components/redesign/library/useExercises';
import { VideoThumb } from '@/components/redesign/ui';
import { ChevronLeftIcon, BookmarkIcon, PlayIcon } from '@/components/redesign/icons';

// Screen 10 · Exercise Detail (+ spicy) — accent: violet
const LVL_COLOR = ['var(--rd-ember-light)', 'var(--rd-ember)', 'var(--rd-ember-lvl3)'];

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ex, setEx] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/exercises/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEx)
      .catch(() => setEx(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rd-card mt-6 h-[420px] animate-pulse-soft" />;
  if (!ex) {
    return (
      <div className="rd-card mt-10 p-6 text-center">
        <p className="text-[14px] text-[var(--rd-text-muted)]">Exercise not found.</p>
        <button onClick={() => router.push('/v2/library')} className="mt-3 text-[13px] font-semibold text-[var(--rd-violet)]">Back to Library</button>
      </div>
    );
  }

  const video = primaryVideo(ex);
  const tags = [ex.muscleGroup, ...(ex.secondaryMuscles ? ex.secondaryMuscles.split(/[,;]/) : [])]
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="animate-fadeup space-y-4">
      {/* Top */}
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => router.push('/v2/library')} aria-label="Back" className="text-[var(--rd-text-muted)]">
          <ChevronLeftIcon size={22} />
        </button>
        <button onClick={() => setSaved((v) => !v)} aria-label="Bookmark" style={{ color: saved ? 'var(--rd-violet)' : 'var(--rd-text-muted)' }}>
          <BookmarkIcon size={20} />
        </button>
      </div>

      {/* Video hero */}
      <VideoThumb className="h-[180px] w-full">
        {video?.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        {video && (
          <span className="font-label absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 text-[9px] tracking-[.12em] text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--rd-youtube)' }} />
            TUTORIAL{video.duration ? ` · ${video.duration}` : ''}
          </span>
        )}
        <button
          onClick={() => video?.youtubeUrl && window.open(video.youtubeUrl, '_blank')}
          disabled={!video}
          aria-label="Play"
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black disabled:opacity-40"
        >
          <PlayIcon size={22} />
        </button>
      </VideoThumb>

      {/* Title */}
      <div>
        <h1 className="font-display text-[23px] font-bold text-[var(--rd-ink)]">{ex.name}</h1>
        <p className="font-label mt-1 text-[12px] capitalize text-[var(--rd-text-faint)]">
          {[ex.equipmentRequired, ex.exerciseType, ex.difficulty].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Muscle tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span
              key={i}
              className="font-label rounded-[8px] px-2.5 py-1 text-[10px] capitalize"
              style={{ background: 'rgba(155,123,255,.14)', color: 'var(--rd-violet)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Instructions */}
      {ex.instructions && (
        <p className="text-[13px] leading-relaxed text-[var(--rd-text-muted)]">{ex.instructions}</p>
      )}

      {/* Spicy variations */}
      {ex.variations?.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <p className="text-[14px] font-semibold text-[var(--rd-ink)]">Spicy variations</p>
            <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{ex.variations.length} levels harder</span>
          </div>
          <div className="space-y-2.5">
            {ex.variations.map((v, i) => (
              <div key={v.id} className="rd-card flex items-center gap-3 p-3">
                <VideoThumb className="h-11 w-14 shrink-0" rounded="rounded-[10px]">
                  <PlayIcon size={13} className="text-white/80" />
                </VideoThumb>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--rd-ink)]">{v.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--rd-text-faint)]">{v.description}</p>
                </div>
                <span
                  className="font-label shrink-0 rounded-[7px] px-1.5 py-1 text-[9px] font-bold text-[#0A0C10]"
                  style={{ background: LVL_COLOR[Math.min(2, (v.spicyLevel || 1) - 1)] }}
                >
                  LVL {v.spicyLevel}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
