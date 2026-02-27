'use client';

import { useState } from 'react';
import NumericStepper from './NumericStepper';

interface SetRowProps {
  setNumber: number;
  weight: number;
  reps: number;
  isLogged: boolean;
  onLog: (weight: number, reps: number) => void;
  onUnlog: () => void;
  weightStep?: number;
  equipmentRequired?: string | null;
}

export default function SetRow({
  setNumber,
  weight: initialWeight,
  reps: initialReps,
  isLogged,
  onLog,
  onUnlog,
  weightStep = 5,
  equipmentRequired,
}: SetRowProps) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);

  const isBarbell = equipmentRequired?.toLowerCase().includes('barbell') ?? false;
  const [plateMode, setPlateMode] = useState(false);
  const [barWeight, setBarWeight] = useState(45);
  const [perSide, setPerSide] = useState(() => {
    const calc = (initialWeight - 45) / 2;
    return calc > 0 ? calc : 0;
  });

  // Sync when parent changes defaults (e.g. carry-forward from previous set)
  // Only update if not currently editing and not already logged
  const [lastInitWeight, setLastInitWeight] = useState(initialWeight);
  const [lastInitReps, setLastInitReps] = useState(initialReps);
  if (!isLogged && !editing && (initialWeight !== lastInitWeight || initialReps !== lastInitReps)) {
    setWeight(initialWeight);
    setReps(initialReps);
    setLastInitWeight(initialWeight);
    setLastInitReps(initialReps);
    // Also sync perSide
    const calc = (initialWeight - barWeight) / 2;
    setPerSide(calc > 0 ? calc : 0);
  }

  const handlePerSideChange = (v: number) => {
    setPerSide(v);
    setWeight(v * 2 + barWeight);
  };

  const handleBarWeightChange = (v: number) => {
    setBarWeight(v);
    setWeight(perSide * 2 + v);
  };

  const togglePlateMode = () => {
    if (!plateMode) {
      // Entering plate mode — back-calculate perSide from current weight
      const calc = (weight - barWeight) / 2;
      setPerSide(calc > 0 ? calc : 0);
    }
    setPlateMode(!plateMode);
  };

  const handleConfirm = () => {
    // Blur active input to dismiss keyboard & reset iOS zoom
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onLog(weight, reps);
    setEditing(false);
  };

  const handleEdit = () => {
    setEditing(true);
  };

  // Logged state — compact chip, tappable to edit
  if (isLogged && !editing) {
    return (
      <div className="flex items-center gap-2 py-1 group">
        <div
          onClick={handleEdit}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[11px] tabular-nums font-medium text-primary">
            S{setNumber}
          </span>
          <span className="text-[11px] tabular-nums font-medium text-slate-300">
            {weight}lb × {reps}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleEdit}
            className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnlog(); }}
            className="p-1.5 text-slate-700 hover:text-red-400 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Editable state
  return (
    <div className="py-1 space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] tabular-nums font-bold text-slate-500 w-5 shrink-0">
          S{setNumber}
        </span>

        {plateMode ? (
          /* Plate calc mode: per-side input + bar weight + total readout */
          <div className="flex items-center gap-1">
            <NumericStepper
              value={perSide}
              onChange={handlePerSideChange}
              step={weightStep}
              min={0}
              max={500}
              label="/side"
              inputWidth="w-14"
            />
            <span className="text-[10px] text-slate-500 font-medium">=</span>
            <span className="text-[11px] tabular-nums font-bold text-white">
              {weight}lb
            </span>
          </div>
        ) : (
          /* Standard total weight input */
          <NumericStepper
            value={weight}
            onChange={setWeight}
            step={weightStep}
            min={0}
            max={999}
            label="lb"
            inputWidth="w-14"
          />
        )}

        <NumericStepper
          value={reps}
          onChange={setReps}
          step={1}
          min={0}
          max={99}
          inputWidth="w-10"
        />

        <button
          type="button"
          onClick={handleConfirm}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30 active:bg-primary/40 transition-colors shrink-0 ml-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        {isLogged && editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Plate calc toggle + bar weight — only for barbell exercises */}
      {isBarbell && (
        <div className="flex items-center gap-2 ml-5">
          <button
            type="button"
            onClick={togglePlateMode}
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              plateMode
                ? 'text-amber-400'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {/* Barbell icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0">
              <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" />
              <rect x="4" y="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
              <rect x="17" y="8" width="3" height="8" rx="0.5" fill="currentColor" stroke="none" />
            </svg>
            {plateMode ? 'Per side' : 'Per side'}
          </button>

          {plateMode && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600">bar:</span>
              <input
                type="text"
                inputMode="numeric"
                value={barWeight}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  handleBarWeightChange(Math.max(0, Math.min(100, v)));
                }}
                onFocus={(e) => e.target.select()}
                className="w-8 h-5 text-center bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-400 tabular-nums font-medium focus:outline-none focus:ring-1 focus:ring-amber-400/50 focus:text-white"
              />
              <span className="text-[10px] text-slate-600">lb</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
