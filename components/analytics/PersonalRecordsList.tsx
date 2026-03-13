'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { PersonalRecord } from '@/types';

interface PersonalRecordsListProps {
  records: PersonalRecord[];
}

const MUSCLE_COLORS: Record<string, string> = {
  chest: 'bg-red-500/20 text-red-400',
  back: 'bg-blue-500/20 text-blue-400',
  shoulders: 'bg-purple-500/20 text-purple-400',
  legs: 'bg-amber-500/20 text-amber-400',
  quads: 'bg-amber-500/20 text-amber-400',
  hamstrings: 'bg-orange-500/20 text-orange-400',
  glutes: 'bg-pink-500/20 text-pink-400',
  biceps: 'bg-emerald-500/20 text-emerald-400',
  triceps: 'bg-teal-500/20 text-teal-400',
  core: 'bg-cyan-500/20 text-cyan-400',
  arms: 'bg-emerald-500/20 text-emerald-400',
  calves: 'bg-yellow-500/20 text-yellow-400',
};

function isRecent(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // 7 days
}

function formatPrDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PersonalRecordsList({ records }: PersonalRecordsListProps) {
  if (records.length === 0) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Personal Records</h3>
        <div className="py-6 text-center text-muted text-sm">No PRs recorded yet</div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Personal Records</h3>
      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
        {records.map((pr) => {
          const muscleClass = MUSCLE_COLORS[pr.muscleGroup.toLowerCase()] || 'bg-slate-500/20 text-slate-400';
          const recent = isRecent(pr.prDate);
          return (
            <div
              key={pr.exerciseName}
              className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-slate-800/40 transition-colors"
            >
              {recent && (
                <span className="text-amber-400 shrink-0" title="Recent PR!">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              )}
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${muscleClass}`}>
                {pr.muscleGroup}
              </span>
              <span className="text-sm text-white truncate flex-1">{pr.exerciseName}</span>
              <span className="text-sm font-semibold text-primary shrink-0">
                {pr.prWeight} lb
              </span>
              <span className="text-xs text-muted shrink-0">
                x{pr.prReps}
              </span>
              <span className="text-xs text-slate-500 shrink-0 w-12 text-right">
                {formatPrDate(pr.prDate)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
