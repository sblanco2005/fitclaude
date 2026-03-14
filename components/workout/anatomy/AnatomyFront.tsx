'use client';

import {
  FRONT_PATHS,
  SELECTED_FILL,
  SELECTED_STROKE,
  UNSELECTED_FILL,
  UNSELECTED_STROKE,
  HOVER_FILL,
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
      {/* Physique photo background */}
      <image
        href="/images/anatomy-front.png"
        x="25"
        y="-10"
        width="150"
        height="420"
        preserveAspectRatio="xMidYMin meet"
        style={{ opacity: 0.85 }}
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
            strokeWidth={isSelected ? 1.5 : 1.0}
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
