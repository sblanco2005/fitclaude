'use client';

import { Card } from '@/components/ui/Card';
import type { PlateauAlert } from '@/types';

interface PlateauAlertsProps {
  plateaus: PlateauAlert[];
}

export function PlateauAlerts({ plateaus }: PlateauAlertsProps) {
  if (plateaus.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Plateaus Detected</h3>
      </div>
      <div className="space-y-2">
        {plateaus.map((p) => (
          <div
            key={p.exerciseName}
            className="flex items-center justify-between py-2 px-3 bg-amber-500/5 border border-amber-500/15 rounded-lg"
          >
            <div>
              <div className="text-sm font-medium text-white">{p.exerciseName}</div>
              <div className="text-[10px] text-amber-400/70">
                Stuck at {p.stuckAtWeight} lb for {p.sessionCount} sessions
              </div>
            </div>
            <span className="text-[10px] text-slate-500">
              {new Date(p.lastDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
