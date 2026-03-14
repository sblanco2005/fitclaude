'use client';

import {
  BACK_PATHS,
  SELECTED_FILL,
  SELECTED_STROKE,
  UNSELECTED_FILL,
  UNSELECTED_STROKE,
} from './muscleData';

interface AnatomyBackProps {
  selectedMuscles: Set<string>;
  selectedSubgroups?: Map<string, Set<string>>;
  onMuscleClick: (muscle: string) => void;
}

export default function AnatomyBack({ selectedMuscles, selectedSubgroups, onMuscleClick }: AnatomyBackProps) {
  return (
    <svg
      viewBox="0 0 200 420"
      className="w-full h-full max-h-[340px] sm:max-h-[380px]"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Physique photo background */}
      <image
        href="/images/anatomy-back.png"
        x="-10"
        y="10"
        width="220"
        height="680"
        preserveAspectRatio="xMidYMin meet"
        style={{ opacity: 0.85 }}
      />

      {/* Clickable muscle regions */}
      {BACK_PATHS.filter((mp) => ['triceps', 'back', 'shoulders', 'glutes', 'hamstrings', 'calves'].includes(mp.muscle)).map((mp) => {
        const muscleSelected = selectedMuscles.has(mp.muscle);
        // Check subgroup: if path has a subgroup, verify it's active
        let isSelected = muscleSelected;
        if (muscleSelected && mp.subgroup && selectedSubgroups) {
          const subs = selectedSubgroups.get(mp.muscle);
          isSelected = subs ? subs.has(mp.subgroup) : true;
        }
        return (
          <path
            key={mp.id}
            d={mp.d}
            style={{
              fill: isSelected ? SELECTED_FILL : UNSELECTED_FILL,
              stroke: isSelected ? SELECTED_STROKE : UNSELECTED_STROKE,
              strokeWidth: isSelected ? 1.5 : 1.0,
              transition: 'fill 200ms ease, stroke 200ms ease',
              cursor: 'pointer',
            }}
            onClick={() => onMuscleClick(mp.muscle)}
          />
        );
      })}

      {/* Label: BACK */}
      <text x="100" y="412" textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="10" fontWeight="500">
        BACK
      </text>
    </svg>
  );
}
