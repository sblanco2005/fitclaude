'use client';

import {
  FRONT_PATHS,
  BACK_PATHS,
  BODY_OUTLINE_FRONT,
  BODY_OUTLINE_BACK,
  HEAD_PATH,
} from '@/components/workout/anatomy/muscleData';

const WORKED_FILL = 'rgba(16, 185, 129, 0.4)';
const WORKED_STROKE = 'rgba(52, 211, 153, 0.7)';
const MISSED_FILL = 'rgba(239, 68, 68, 0.35)';
const MISSED_STROKE = 'rgba(248, 113, 113, 0.6)';

const ALL_ANATOMY_MUSCLES = [
  'chest', 'shoulders', 'biceps', 'core', 'quadriceps',
  'back', 'triceps', 'glutes', 'hamstrings', 'calves', 'forearms',
];

// Which muscles to render on each view (filter paths by these)
const FRONT_MUSCLES = ['chest', 'shoulders', 'biceps', 'core', 'quadriceps', 'forearms'];
const BACK_MUSCLES = ['back', 'shoulders', 'triceps', 'glutes', 'hamstrings', 'calves'];

interface MusclesWorkedCardProps {
  musclesWorked: string[];
}

export function MusclesWorkedCard({ musclesWorked }: MusclesWorkedCardProps) {
  const workedSet = new Set(musclesWorked);
  const workedCount = ALL_ANATOMY_MUSCLES.filter((m) => workedSet.has(m)).length;
  const missedCount = ALL_ANATOMY_MUSCLES.length - workedCount;

  return (
    <div className="bg-card border border-border-dark rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Muscles Worked
        </h3>
        <span className="text-[10px] text-slate-500">
          {workedCount}/{ALL_ANATOMY_MUSCLES.length} groups
        </span>
      </div>

      <div className="flex gap-1 justify-center">
        {/* Front view */}
        <div className="flex-1 max-w-[160px]">
          <svg viewBox="0 0 200 420" className="w-full" preserveAspectRatio="xMidYMid meet">
            <image
              href="/images/anatomy-front.png"
              x="-10"
              y="10"
              width="220"
              height="680"
              preserveAspectRatio="xMidYMin meet"
              style={{ opacity: 0.7 }}
            />
            <path d={HEAD_PATH} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={0.8} />
            <path d={BODY_OUTLINE_FRONT} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={0.8} />
            {FRONT_PATHS.filter((mp) => FRONT_MUSCLES.includes(mp.muscle)).map((mp) => {
              const worked = workedSet.has(mp.muscle);
              return (
                <path
                  key={mp.id}
                  d={mp.d}
                  fill={worked ? WORKED_FILL : MISSED_FILL}
                  stroke={worked ? WORKED_STROKE : MISSED_STROKE}
                  strokeWidth={1.2}
                />
              );
            })}
            <text x="100" y="412" textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="10" fontWeight="500">
              FRONT
            </text>
          </svg>
        </div>

        {/* Back view */}
        <div className="flex-1 max-w-[160px]">
          <svg viewBox="0 0 200 420" className="w-full" preserveAspectRatio="xMidYMid meet">
            <image
              href="/images/anatomy-back.png"
              x="-10"
              y="10"
              width="220"
              height="680"
              preserveAspectRatio="xMidYMin meet"
              style={{ opacity: 0.7 }}
            />
            <path d={HEAD_PATH} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={0.8} />
            <path d={BODY_OUTLINE_BACK} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={0.8} />
            {BACK_PATHS.filter((mp) => BACK_MUSCLES.includes(mp.muscle)).map((mp) => {
              const worked = workedSet.has(mp.muscle);
              return (
                <path
                  key={mp.id}
                  d={mp.d}
                  fill={worked ? WORKED_FILL : MISSED_FILL}
                  stroke={worked ? WORKED_STROKE : MISSED_STROKE}
                  strokeWidth={1.2}
                />
              );
            })}
            <text x="100" y="412" textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="10" fontWeight="500">
              BACK
            </text>
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 border border-emerald-400/50" />
          <span className="text-[10px] text-slate-400">Worked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/50 border border-red-400/50" />
          <span className="text-[10px] text-slate-400">Missed</span>
        </div>
      </div>
    </div>
  );
}
