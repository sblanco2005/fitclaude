'use client';

import { MUSCLE_MAP } from './muscleData';

interface SubgroupChipsProps {
  selectedMuscles: Set<string>;
  selectedSubgroups: Map<string, Set<string>>;
  onToggleSubgroup: (muscle: string, subgroup: string) => void;
}

export default function SubgroupChips({
  selectedMuscles,
  selectedSubgroups,
  onToggleSubgroup,
}: SubgroupChipsProps) {
  // Get all selected muscles that have subgroups
  const musclesWithSubs = Array.from(selectedMuscles)
    .map((key) => MUSCLE_MAP[key])
    .filter((r) => r && r.subgroups.length > 0);

  if (musclesWithSubs.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Focus Areas</span>
      {musclesWithSubs.map((region) => {
        const activeSubs = selectedSubgroups.get(region.key);
        return (
          <div key={region.key} className="space-y-1">
            <span className="text-xs text-slate-400 font-medium">{region.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {region.subgroups.map((sub) => {
                const isActive = activeSubs ? activeSubs.has(sub.key) : true;
                return (
                  <button
                    key={sub.key}
                    onClick={() => onToggleSubgroup(region.key, sub.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      isActive
                        ? 'bg-blue-500/30 border border-blue-400/50 text-blue-200'
                        : 'bg-slate-800/50 border border-slate-700/40 text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
