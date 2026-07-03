'use client';

import React, { useState } from 'react';
import type { Exercise } from '@/types';
import { useExercises, primaryVideo, FILTERS } from '@/components/redesign/library/useExercises';
import { ScreenHeader, FilterChips, VideoThumb } from '@/components/redesign/ui';
import { SearchIcon, PlayIcon } from '@/components/redesign/icons';

// Screen 06 · Exercise Library — accent: violet
export default function LibraryPage() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const { loading, exercises, total } = useExercises(filter, search);

  const [featured, ...rest] = exercises;

  return (
    <div className="animate-fadeup space-y-4 pb-2">
      <ScreenHeader title="Exercises" />

      {/* Search */}
      <div className="flex items-center gap-2 rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3.5 py-2.5">
        <SearchIcon size={17} className="text-[var(--rd-text-faint)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${total || '35+'} exercises…`}
          className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
        />
      </div>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} accent="var(--rd-violet)" />

      {loading ? (
        <div className="space-y-3">
          <div className="rd-card h-[220px] animate-pulse-soft" />
          <div className="rd-card h-[64px] animate-pulse-soft" />
          <div className="rd-card h-[64px] animate-pulse-soft" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="rd-card p-6 text-center">
          <p className="text-[13px] text-[var(--rd-text-muted)]">No exercises match.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {featured && <FeaturedExercise ex={featured} />}
          <div className="space-y-2.5">
            {rest.map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpicyMeter({ count }: { count: number }) {
  const colors = ['var(--rd-ember-light)', 'var(--rd-ember)', 'var(--rd-ember-lvl3)'];
  return (
    <div className="flex items-center gap-2">
      <span className="font-label text-[9px] tracking-[.14em] text-[var(--rd-text-faint)]">SPICY</span>
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < count ? colors[i] : 'var(--rd-border)' }}
          />
        ))}
      </div>
      <span className="font-label text-[10px] text-[var(--rd-text-faint)]">{count} variations</span>
    </div>
  );
}

function FeaturedExercise({ ex }: { ex: Exercise }) {
  const video = primaryVideo(ex);
  const open = () => video?.youtubeUrl && window.open(video.youtubeUrl, '_blank');
  return (
    <div className="rd-card overflow-hidden">
      <VideoThumb className="h-[150px] w-full" rounded="rounded-none">
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
          onClick={open}
          disabled={!video}
          aria-label="Play tutorial"
          className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-black disabled:opacity-40"
        >
          <PlayIcon size={20} />
        </button>
      </VideoThumb>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-[17px] font-bold text-[var(--rd-ink)]">{ex.name}</h3>
          <span className="font-label rounded-[7px] px-2 py-1 text-[9px] tracking-[.1em]" style={{ background: 'rgba(155,123,255,.16)', color: 'var(--rd-violet)' }}>
            {ex.muscleGroup.toUpperCase()}
          </span>
        </div>
        <p className="font-label mt-1 text-[11px] capitalize text-[var(--rd-text-faint)]">
          {[ex.equipmentRequired, ex.exerciseType, ex.difficulty].filter(Boolean).join(' · ')}
        </p>
        {ex.variations?.length > 0 && (
          <div className="mt-3">
            <SpicyMeter count={Math.min(3, ex.variations.length)} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseRow({ ex }: { ex: Exercise }) {
  const video = primaryVideo(ex);
  const open = () => video?.youtubeUrl && window.open(video.youtubeUrl, '_blank');
  return (
    <div className="rd-card flex items-center gap-3 p-3">
      <button
        onClick={open}
        disabled={!video}
        aria-label="Play"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] disabled:opacity-70"
        style={{ background: 'linear-gradient(135deg,#26282f,#15171c)' }}
      >
        {video?.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        )}
        <PlayIcon size={14} className="relative text-white/90" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--rd-ink)]">{ex.name}</p>
        <p className="font-label mt-0.5 truncate text-[11px] capitalize text-[var(--rd-text-faint)]">
          {[ex.equipmentRequired, ex.secondaryMuscles || ex.muscleGroup].filter(Boolean).join(' · ')}
        </p>
      </div>
      {ex.variations?.length > 0 && (
        <span className="font-label shrink-0 rounded-[8px] px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(255,107,69,.12)', color: 'var(--rd-ember)' }}>
          🌶×{ex.variations.length}
        </span>
      )}
    </div>
  );
}
