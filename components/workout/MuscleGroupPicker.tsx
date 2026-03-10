'use client';

import { useState } from 'react';
import NumericStepper from './NumericStepper';

// ─── muscle data ──────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  { key: 'chest',      label: 'Chest',      icon: 'M4 12c1-4 4-7 8-7s7 3 8 7c1-4 4-7 8-7s7 3 8 7' },
  { key: 'back',       label: 'Back',       icon: 'M6 4v16M18 4v16M6 8h12M6 16h12' },
  { key: 'shoulders',  label: 'Shoulders',  icon: 'M4 14c0-4 3-8 8-8s8 4 8 8M8 10l4-4 4 4' },
  { key: 'biceps',     label: 'Biceps',     icon: 'M7 20c0-6 3-10 5-12s4 0 5 2c1-2 3-4 5-2s5 6 5 12' },
  { key: 'triceps',    label: 'Triceps',    icon: 'M8 4v12c0 2 2 4 4 4s4-2 4-4V4M8 10h8' },
  { key: 'quadriceps', label: 'Quads',      icon: 'M8 4v16M16 4v16M8 4c2 3 6 3 8 0M8 20c2-3 6-3 8 0' },
  { key: 'hamstrings', label: 'Hamstrings', icon: 'M8 4v16M16 4v16M8 12h8' },
  { key: 'glutes',     label: 'Glutes',     icon: 'M4 12c0-4 4-8 8-8s8 4 8 8M6 14c2-1 4-1 6 0M12 14c2-1 4-1 6 0' },
  { key: 'core',       label: 'Core',       icon: 'M8 4h8v16H8zM8 8h8M8 12h8M8 16h8' },
  { key: 'calves',     label: 'Calves',     icon: 'M9 4c-1 5-2 8-1 12s2 4 3 4 2-1 3-4 0-7-1-12' },
  { key: 'full_body',  label: 'Full Body',  icon: 'M12 2v6M8 8l4 4 4-4M8 12v4l-2 4M16 12v4l2 4M12 8v8' },
] as const;

const MUSCLE_BG: Record<string, string> = {
  chest:      'bg-blue-500/30 border-blue-400/50 text-blue-200',
  back:       'bg-green-500/30 border-green-400/50 text-green-200',
  shoulders:  'bg-purple-500/30 border-purple-400/50 text-purple-200',
  biceps:     'bg-pink-500/30 border-pink-400/50 text-pink-200',
  triceps:    'bg-pink-500/30 border-pink-400/50 text-pink-200',
  quadriceps: 'bg-yellow-500/30 border-yellow-400/50 text-yellow-200',
  hamstrings: 'bg-yellow-500/30 border-yellow-400/50 text-yellow-200',
  glutes:     'bg-amber-500/30 border-amber-400/50 text-amber-200',
  core:       'bg-orange-500/30 border-orange-400/50 text-orange-200',
  calves:     'bg-yellow-500/30 border-yellow-400/50 text-yellow-200',
  full_body:  'bg-emerald-500/30 border-emerald-400/50 text-emerald-200',
};

const PRESETS = [
  { label: 'Push', keys: ['chest', 'shoulders', 'triceps'] },
  { label: 'Pull', keys: ['back', 'biceps'] },
  { label: 'Legs', keys: ['quadriceps', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Upper', keys: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
];

const CATEGORIES = ['lifting', 'hiit', 'cardio', 'calisthenics'] as const;
const SPICY_LABELS = ['None', '1', '2', '3'] as const;

// ─── component ────────────────────────────────────────────────────────────────

interface MuscleGroupPickerProps {
  onGenerate: (prompt: string) => void;
  onClose: () => void;
}

export default function MuscleGroupPicker({ onGenerate, onClose }: MuscleGroupPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [numExercises, setNumExercises] = useState(5);
  const [spicyLevel, setSpicyLevel] = useState(0);
  const [category, setCategory] = useState<string>('lifting');
  const [showOptions, setShowOptions] = useState(false);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (key === 'full_body') {
        // Full body clears individuals, or deselects itself
        if (next.has('full_body')) { next.delete('full_body'); } else { next.clear(); next.add('full_body'); }
      } else {
        next.delete('full_body');
        if (next.has(key)) next.delete(key); else next.add(key);
      }
      return next;
    });
  };

  const applyPreset = (keys: string[]) => {
    setSelected(prev => {
      const allSelected = keys.every(k => prev.has(k));
      if (allSelected) return new Set(); // deselect if already matching
      return new Set(keys);
    });
  };

  const handleGenerate = () => {
    if (selected.size === 0) return;
    const muscles = Array.from(selected)
      .map(k => MUSCLE_GROUPS.find(m => m.key === k)?.label ?? k)
      .join(', ');
    let prompt = `Create a ${category} workout focusing on ${muscles} with ${numExercises} exercises`;
    if (spicyLevel > 0) prompt += ` at spicy level ${spicyLevel}`;
    prompt += '.';
    onGenerate(prompt);
  };

  return (
    <div className="space-y-4">
      {/* Quick presets */}
      <div className="flex gap-2">
        {PRESETS.map(p => {
          const active = p.keys.every(k => selected.has(k)) && selected.size === p.keys.length;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.keys)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Muscle group grid */}
      <div className="grid grid-cols-3 gap-2">
        {MUSCLE_GROUPS.map(m => {
          const isSelected = selected.has(m.key);
          const colorCls = MUSCLE_BG[m.key] ?? 'bg-slate-500/30 border-slate-400/50 text-slate-200';
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[72px] rounded-xl border transition-all ${
                isSelected
                  ? `${colorCls} scale-[1.02]`
                  : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                <path d={m.icon} />
              </svg>
              <span className="text-[11px] font-semibold">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Options toggle */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Options
      </button>

      {showOptions && (
        <div className="space-y-3 p-3 bg-slate-800/30 rounded-xl">
          {/* Number of exercises */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Exercises</span>
            <NumericStepper
              value={numExercises}
              onChange={setNumExercises}
              step={1}
              min={3}
              max={10}
              inputWidth="w-10"
            />
          </div>

          {/* Category */}
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1.5">Category</span>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    category === c
                      ? 'bg-primary text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Spicy level */}
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1.5">Spicy Level</span>
            <div className="flex gap-1.5">
              {SPICY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setSpicyLevel(i)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    spicyLevel === i
                      ? 'bg-primary text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {i === 0 ? label : '🌶️'.repeat(i)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={selected.size === 0}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
          selected.size > 0
            ? 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98]'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
        }`}
      >
        {selected.size === 0
          ? 'Select muscles to start'
          : `Generate ${category} workout`}
      </button>
    </div>
  );
}
