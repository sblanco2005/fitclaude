import React from 'react';

// Chat message bubbles + tool-call cards. Source: handoff screen 02.

export function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div
        className="grad-ember max-w-[80%] px-4 py-2.5 text-[14px] font-medium text-[#0A0C10]"
        style={{ borderRadius: '18px 18px 5px 18px' }}
      >
        {children}
      </div>
    </div>
  );
}

export function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 py-2.5 text-[14px] leading-relaxed text-[var(--rd-text-secondary)]"
        style={{ borderRadius: '18px 18px 18px 5px' }}
      >
        {children}
      </div>
    </div>
  );
}

export type LoggedMeal = {
  mealType?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function LoggedMealCard({ meal }: { meal: LoggedMeal }) {
  const tiles = [
    { g: meal.proteinG, label: 'PROTEIN', color: 'var(--rd-macro-protein)' },
    { g: meal.carbsG, label: 'CARBS', color: 'var(--rd-macro-carbs)' },
    { g: meal.fatG, label: 'FAT', color: 'var(--rd-macro-fat)' },
  ];
  return (
    <div
      className="max-w-[88%] rounded-[16px] border p-3.5"
      style={{ borderColor: 'rgba(200,255,77,.3)', background: 'rgba(200,255,77,.05)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[.14em] text-[var(--rd-lime)]">
          LOGGED{meal.mealType ? ` · ${meal.mealType.toUpperCase()}` : ''}
        </span>
        <span className="font-num text-[18px] font-bold text-[var(--rd-ink)]">
          {Math.round(meal.calories)} <span className="font-label text-[10px] text-[var(--rd-text-faint)]">kcal</span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] py-2 text-center">
            <div className="font-num text-[16px] font-bold" style={{ color: t.color }}>{Math.round(t.g)}g</div>
            <div className="font-label mt-0.5 text-[8px] tracking-[.12em] text-[var(--rd-text-faint)]">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type LoggedActivity = {
  name: string;
  durationMinutes?: number | null;
};

// Flat activity log (opaque class — "Alpha Fit 60 min", "Yoga"). Mirrors LoggedMealCard.
export function LoggedActivityCard({ activity }: { activity: LoggedActivity }) {
  return (
    <div
      className="max-w-[88%] rounded-[16px] border p-3.5"
      style={{ borderColor: 'rgba(34,211,238,.3)', background: 'rgba(34,211,238,.06)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[.14em]" style={{ color: '#22D3EE' }}>ACTIVITY LOGGED</span>
        {activity.durationMinutes ? (
          <span className="font-num text-[18px] font-bold text-[var(--rd-ink)]">
            {activity.durationMinutes} <span className="font-label text-[10px] text-[var(--rd-text-faint)]">min</span>
          </span>
        ) : null}
      </div>
      <h3 className="font-display mt-1.5 text-[16px] font-bold text-[var(--rd-ink)]">{activity.name}</h3>
    </div>
  );
}

export type RoutineMove = {
  name: string;
  sets?: number;
  reps?: string | number;
  durationSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: string | null;
};

export type GeneratedRoutine = {
  id?: string; // saved workout id — the routine is already persisted server-side
  name: string;
  spicyLevel?: number;
  category?: string; // 'cardio' → render segment labels instead of sets×reps
  moves: RoutineMove[];
};

// Short metric label for a routine move ("5:00", "400 m", "×20", or "3×8-10").
function moveLabel(m: RoutineMove, cardio: boolean): string {
  if (cardio) {
    if (m.durationSeconds != null) {
      const mm = Math.floor(m.durationSeconds / 60);
      const ss = m.durationSeconds % 60;
      return `${mm}:${String(ss).padStart(2, '0')}`;
    }
    if (m.distance != null) return `${m.distance} ${m.distanceUnit ?? 'm'}`;
    if (m.reps) return `×${m.reps}`;
    return '';
  }
  if (!m.sets && !m.reps) return '';
  return `${m.sets ?? ''}${m.sets && m.reps ? '×' : ''}${m.reps ?? ''}`;
}

export function GeneratedRoutineCard({
  routine,
  onOpen,
  onSave,
  onSpin,
  saving,
}: {
  routine: GeneratedRoutine;
  onOpen?: () => void;
  onSave?: () => void;
  onSpin?: () => void;
  saving?: boolean;
}) {
  const shown = routine.moves.slice(0, 3);
  const extra = routine.moves.length - shown.length;
  const cardio = routine.category === 'cardio';
  const accent = cardio ? '34,211,238' : '155,123,255';
  const accentColor = cardio ? '#22D3EE' : 'var(--rd-violet)';
  const unit = cardio ? 'segments' : 'moves';
  return (
    <div
      className="max-w-[88%] rounded-[16px] border p-3.5"
      style={{ borderColor: `rgba(${accent},.32)`, background: `rgba(${accent},.06)` }}
    >
      <div className="flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[.14em]" style={{ color: accentColor }}>{cardio ? 'CARDIO WORKOUT' : 'GENERATED ROUTINE'}</span>
        {routine.spicyLevel ? (
          <span
            className="font-label rounded-[7px] px-1.5 py-0.5 text-[9px] font-bold text-[#0A0C10]"
            style={{ background: 'var(--rd-ember)' }}
          >
            🌶 LVL {routine.spicyLevel}
          </span>
        ) : null}
      </div>
      <h3 className="font-display mt-1.5 text-[16px] font-bold text-[var(--rd-ink)]">
        {routine.name} <span className="font-body text-[13px] font-normal text-[var(--rd-text-faint)]">· {routine.moves.length} {unit}</span>
      </h3>
      <div className="mt-2.5 space-y-1.5">
        {shown.map((m, i) => {
          const label = moveLabel(m, cardio);
          return (
            <div key={i} className="flex items-center justify-between rounded-[10px] bg-[var(--rd-card)] px-3 py-2">
              <span className="text-[13px] text-[var(--rd-text-secondary)]">{m.name}</span>
              {label && <span className="font-label text-[11px] text-[var(--rd-text-faint)]">{label}</span>}
            </div>
          );
        })}
      </div>
      {extra > 0 && <p className="mt-2 text-[12px] text-[var(--rd-text-faint)]">+{extra} more</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onOpen ?? onSave}
          disabled={saving}
          className="grad-coach flex-1 rounded-[11px] py-2 text-[13px] font-semibold text-[#0A0C10] disabled:opacity-60"
        >
          {onOpen ? 'View routine' : saving ? 'Saving…' : 'Save routine'}
        </button>
        {onSpin && (
          <button
            onClick={onSpin}
            className="rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 py-2 text-[13px] font-semibold text-[var(--rd-text-secondary)]"
          >
            Spin
          </button>
        )}
      </div>
    </div>
  );
}
