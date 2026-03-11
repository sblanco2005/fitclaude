'use client';

import {
  FRONT_PATHS,
  BODY_OUTLINE_FRONT,
  HEAD_PATH,
  SELECTED_FILL,
  SELECTED_STROKE,
  UNSELECTED_FILL,
  UNSELECTED_STROKE,
  HOVER_FILL,
  OUTLINE_STROKE,
} from './muscleData';

interface AnatomyFrontProps {
  selectedMuscles: Set<string>;
  onMuscleClick: (muscle: string) => void;
}

export default function AnatomyFront({ selectedMuscles, onMuscleClick }: AnatomyFrontProps) {
  return (
    <svg
      viewBox="0 0 200 420"
      className="w-full h-full max-h-[340px] sm:max-h-[380px]"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Body outline */}
      <path
        d={BODY_OUTLINE_FRONT}
        fill="rgba(15, 23, 42, 0.3)"
        stroke={OUTLINE_STROKE}
        strokeWidth="1"
      />
      {/* Head */}
      <path
        d={HEAD_PATH}
        fill="rgba(15, 23, 42, 0.3)"
        stroke={OUTLINE_STROKE}
        strokeWidth="1"
      />

      {/* Clickable muscle regions */}
      {FRONT_PATHS.map((mp) => {
        const isSelected = selectedMuscles.has(mp.muscle);
        return (
          <path
            key={mp.id}
            d={mp.d}
            fill={isSelected ? SELECTED_FILL : UNSELECTED_FILL}
            stroke={isSelected ? SELECTED_STROKE : UNSELECTED_STROKE}
            strokeWidth={isSelected ? 1.2 : 0.6}
            className="cursor-pointer transition-all duration-200 hover:brightness-125"
            style={{
              transition: 'fill 200ms ease, stroke 200ms ease',
            }}
            onClick={() => onMuscleClick(mp.muscle)}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.fill = HOVER_FILL;
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.fill = UNSELECTED_FILL;
              }
            }}
          />
        );
      })}

      {/* Label: FRONT */}
      <text x="100" y="412" textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="10" fontWeight="500">
        FRONT
      </text>
    </svg>
  );
}
