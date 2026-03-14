'use client';

import { useState, useCallback } from 'react';
import AnatomyFront from './anatomy/AnatomyFront';
import AnatomyBack from './anatomy/AnatomyBack';
import SubgroupChips from './anatomy/SubgroupChips';
import { MUSCLE_MAP, MUSCLE_REGIONS, PRESETS, type MuscleView } from './anatomy/muscleData';
import NumericStepper from './NumericStepper';

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['lifting', 'hiit', 'cardio', 'calisthenics'] as const;
const SPICY_LABELS = ['None', '1', '2', '3'] as const;

// ─── component ───────────────────────────────────────────────────────────────

interface MuscleGroupPickerProps {
  onGenerate: (prompt: string) => void;
  onClose: () => void;
}

export default function MuscleGroupPicker({ onGenerate }: MuscleGroupPickerProps) {
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(new Set());
  const [selectedSubgroups, setSelectedSubgroups] = useState<Map<string, Set<string>>>(new Map());
  const [activeView, setActiveView] = useState<MuscleView>('front');
  const [numExercises, setNumExercises] = useState(5);
  const [spicyLevel, setSpicyLevel] = useState(0);
  const [category, setCategory] = useState<string>('lifting');
  const [supersets, setSupersets] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Toggle a muscle group on/off
  const handleMuscleClick = useCallback((muscle: string) => {
    setSelectedMuscles((prev) => {
      const next = new Set(prev);
      if (next.has(muscle)) {
        next.delete(muscle);
        // Clean up subgroups
        setSelectedSubgroups((sp) => {
          const ns = new Map(sp);
          ns.delete(muscle);
          return ns;
        });
      } else {
        next.add(muscle);
        // Initialize all subgroups as selected
        const region = MUSCLE_MAP[muscle];
        if (region && region.subgroups.length > 0) {
          setSelectedSubgroups((sp) => {
            const ns = new Map(sp);
            ns.set(muscle, new Set(region.subgroups.map((s) => s.key)));
            return ns;
          });
        }
      }
      return next;
    });
  }, []);

  // Toggle a specific subgroup
  const handleToggleSubgroup = useCallback((muscle: string, subgroup: string) => {
    setSelectedSubgroups((prev) => {
      const ns = new Map(prev);
      const current = ns.get(muscle);
      if (!current) return prev;
      const next = new Set(current);
      if (next.has(subgroup)) {
        next.delete(subgroup);
        // If all subgroups removed, deselect the muscle entirely
        if (next.size === 0) {
          ns.delete(muscle);
          setSelectedMuscles((sm) => {
            const n = new Set(sm);
            n.delete(muscle);
            return n;
          });
          return ns;
        }
      } else {
        next.add(subgroup);
      }
      ns.set(muscle, next);
      return ns;
    });
  }, []);

  // Apply a preset
  const applyPreset = useCallback((keys: string[]) => {
    setSelectedMuscles((prev) => {
      const allSelected = keys.every((k) => prev.has(k)) && prev.size === keys.length;
      if (allSelected) {
        setSelectedSubgroups(new Map());
        return new Set();
      }
      // Set new selection with all subgroups
      const newSubs = new Map<string, Set<string>>();
      for (const key of keys) {
        const region = MUSCLE_MAP[key];
        if (region && region.subgroups.length > 0) {
          newSubs.set(key, new Set(region.subgroups.map((s) => s.key)));
        }
      }
      setSelectedSubgroups(newSubs);
      return new Set(keys);
    });
  }, []);

  // Build prompt with sub-group detail
  const handleGenerate = () => {
    if (selectedMuscles.size === 0) return;

    const parts: string[] = [];
    for (const muscle of selectedMuscles) {
      const region = MUSCLE_MAP[muscle];
      if (!region) {
        parts.push(muscle);
        continue;
      }

      const subs = selectedSubgroups.get(muscle);
      const allSubKeys = region.subgroups.map((s) => s.key);

      // If no subgroups, or all selected, just use the group name
      if (allSubKeys.length === 0 || !subs || subs.size === allSubKeys.length) {
        parts.push(region.label);
      } else {
        // Specific sub-regions
        const subLabels = Array.from(subs)
          .map((sk) => region.subgroups.find((s) => s.key === sk)?.label)
          .filter(Boolean);
        parts.push(subLabels.join(', '));
      }
    }

    let prompt = `Create a ${category} workout focusing on ${parts.join(', ')} with ${numExercises} exercises`;
    if (spicyLevel > 0) prompt += ` at spicy level ${spicyLevel}`;
    if (supersets)
      prompt += '. Use supersets — pair antagonist or complementary exercises to do back-to-back with no rest between paired exercises';
    prompt += '.';
    onGenerate(prompt);
  };

  return (
    <div className="space-y-4">
      {/* Front/Back view toggle (mobile: tabs, desktop: both shown) */}
      <div className="flex gap-1 sm:hidden bg-slate-800/60 rounded-lg p-0.5 backdrop-blur-sm">
        {(['front', 'back'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
              activeView === view
                ? 'bg-blue-500/25 text-blue-100 shadow-sm shadow-blue-500/10'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      {/* Body map */}
      <div className="relative bg-slate-950/50 rounded-2xl p-3 border border-slate-700/30 overflow-hidden">
        {/* Mobile: single view */}
        <div className="sm:hidden flex justify-center">
          {activeView === 'front' ? (
            <AnatomyFront selectedMuscles={selectedMuscles} onMuscleClick={handleMuscleClick} />
          ) : (
            <AnatomyBack selectedMuscles={selectedMuscles} selectedSubgroups={selectedSubgroups} onMuscleClick={handleMuscleClick} />
          )}
        </div>
        {/* Desktop: side by side */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-2">
          <AnatomyFront selectedMuscles={selectedMuscles} onMuscleClick={handleMuscleClick} />
          <AnatomyBack selectedMuscles={selectedMuscles} selectedSubgroups={selectedSubgroups} onMuscleClick={handleMuscleClick} />
        </div>
      </div>

      {/* Sub-group chips (focus areas) */}
      <SubgroupChips
        selectedMuscles={selectedMuscles}
        selectedSubgroups={selectedSubgroups}
        onToggleSubgroup={handleToggleSubgroup}
      />

      {/* Selected muscles summary chips */}
      {selectedMuscles.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(selectedMuscles).map((key) => {
            const region = MUSCLE_MAP[key];
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-400/25 text-blue-200 backdrop-blur-sm"
              >
                {region?.label ?? key}
                <button
                  onClick={() => handleMuscleClick(key)}
                  className="ml-0.5 hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Quick presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => {
          const active =
            p.keys.every((k) => selectedMuscles.has(k)) && selectedMuscles.size === p.keys.length;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.keys)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'bg-blue-500/25 text-blue-200 border border-blue-400/30'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/30 hover:text-slate-300 hover:border-slate-600/40'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Always-visible: exercise count */}
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

      {/* Options toggle */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Options
      </button>

      {showOptions && (
        <div className="space-y-3 p-3 bg-slate-800/30 rounded-xl">
          {/* Category */}
          <div>
            <span className="text-xs text-slate-400 font-medium block mb-1.5">Category</span>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    spicyLevel === i
                      ? 'bg-primary text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {i === 0 ? label : '\u{1F336}\uFE0F'.repeat(i)}
                </button>
              ))}
            </div>
          </div>

          {/* Supersets toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Supersets</span>
              <p className="text-xs text-slate-500 mt-0.5">Pair exercises back-to-back</p>
            </div>
            <button
              onClick={() => setSupersets(!supersets)}
              className={`relative w-10 h-[22px] rounded-full transition-colors ${
                supersets ? 'bg-primary' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform ${
                  supersets ? 'translate-x-[18px]' : ''
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={selectedMuscles.size === 0}
        className={`w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 ${
          selectedMuscles.size > 0
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:from-blue-500 hover:to-blue-400 active:scale-[0.98]'
            : 'bg-slate-800/60 text-slate-600 cursor-not-allowed'
        }`}
      >
        {selectedMuscles.size === 0
          ? 'Tap muscles to start'
          : `Generate ${category} workout`}
      </button>
    </div>
  );
}
