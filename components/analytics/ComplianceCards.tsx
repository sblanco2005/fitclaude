'use client';

interface Props {
  calorieCompliance: number;
  proteinCompliance: number;
  calorieTarget: number;
  proteinTarget: number;
}

function ComplianceRing({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#1C1C26" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-sm font-bold">{value}%</span>
        </div>
      </div>
      <span className="text-muted text-xs mt-1 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function ComplianceCards({ calorieCompliance, proteinCompliance, calorieTarget, proteinTarget }: Props) {
  if (calorieTarget === 0 && proteinTarget === 0) {
    return (
      <div className="bg-card border border-border-dark rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Target Compliance</h3>
        <div className="text-muted text-sm text-center py-4">
          Set calorie & protein targets in Settings to track compliance
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border-dark rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Target Compliance</h3>
      <div className="flex justify-center gap-8">
        {calorieTarget > 0 && (
          <ComplianceRing value={calorieCompliance} label="Calories" color="#10b981" />
        )}
        {proteinTarget > 0 && (
          <ComplianceRing value={proteinCompliance} label="Protein" color="#3b82f6" />
        )}
      </div>
      <p className="text-muted text-xs text-center mt-2">Days within 10% of target</p>
    </div>
  );
}
