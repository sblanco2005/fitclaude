'use client';

import { useState, useEffect, useRef } from 'react';
import NumericStepper from './NumericStepper';

const LB_PER_KG = 2.20462;
const KG_PER_LB = 1 / LB_PER_KG;

export function lbToKg(lb: number): number { return Math.round(lb * KG_PER_LB * 10) / 10; }
export function kgToLb(kg: number): number { return Math.round(kg * LB_PER_KG); }

export type WeightUnit = 'lb' | 'kg';

interface SetRowProps {
  setNumber: number;
  weight: number;       // always in lbs (storage unit)
  reps: number;
  isLogged: boolean;
  onLog: (weight: number, reps: number) => void; // weight in lbs
  onUnlog: () => void;
  onValueChange?: (setNumber: number, weightLbs: number, reps: number) => void;
  weightStep?: number;
  plateMode?: boolean;
  barWeight?: number;   // always in lbs
  unit?: WeightUnit;    // controlled from parent (exercise-level)
}

export default function SetRow({
  setNumber,
  weight: initialWeight,
  reps: initialReps,
  isLogged,
  onLog,
  onUnlog,
  onValueChange,
  weightStep = 5,
  plateMode = false,
  barWeight = 45,
  unit = 'lb',
}: SetRowProps) {
  const [editing, setEditing] = useState(false);

  // Internal weight is always in the DISPLAY unit
  // initialWeight comes in as lbs — convert to display unit
  const toDisplay = (lbs: number) => unit === 'kg' ? lbToKg(lbs) : lbs;
  const toLbs = (val: number) => unit === 'kg' ? kgToLb(val) : val;

  const [weight, setWeight] = useState(() => toDisplay(initialWeight));
  const [reps, setReps] = useState(initialReps);

  const [perSide, setPerSide] = useState(() => {
    const totalDisplay = toDisplay(initialWeight);
    const barDisplay = toDisplay(barWeight);
    const calc = (totalDisplay - barDisplay) / 2;
    return calc > 0 ? Math.round(calc * 10) / 10 : 0;
  });

  // Sync when parent changes defaults (e.g. carry-forward from previous set)
  const [lastInitWeight, setLastInitWeight] = useState(initialWeight);
  const [lastInitReps, setLastInitReps] = useState(initialReps);
  if (!isLogged && !editing && (initialWeight !== lastInitWeight || initialReps !== lastInitReps)) {
    const disp = toDisplay(initialWeight);
    setWeight(disp);
    setReps(initialReps);
    setLastInitWeight(initialWeight);
    setLastInitReps(initialReps);
    const barDisplay = toDisplay(barWeight);
    const calc = (disp - barDisplay) / 2;
    setPerSide(calc > 0 ? Math.round(calc * 10) / 10 : 0);
  }

  // When unit changes from parent, convert current weight value
  const [lastUnit, setLastUnit] = useState(unit);
  if (unit !== lastUnit) {
    if (unit === 'kg') {
      setWeight(lbToKg(weight));
      const barKg = lbToKg(barWeight);
      const calc = (lbToKg(weight) - barKg) / 2;
      setPerSide(calc > 0 ? Math.round(calc * 10) / 10 : 0);
    } else {
      setWeight(kgToLb(weight));
      const calc = (kgToLb(weight) - barWeight) / 2;
      setPerSide(calc > 0 ? calc : 0);
    }
    setLastUnit(unit);
  }

  // Report current draft values to parent (for auto-save on navigate)
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  useEffect(() => {
    if (!isLogged && onValueChangeRef.current) {
      onValueChangeRef.current(setNumber, toLbs(weight), reps);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weight, reps, isLogged, setNumber]);

  const handlePerSideChange = (v: number) => {
    setPerSide(v);
    const barDisplay = toDisplay(barWeight);
    setWeight(Math.round((v * 2 + barDisplay) * 10) / 10);
  };

  const handleConfirm = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Always send lbs to parent
    onLog(toLbs(weight), reps);
    setEditing(false);
  };

  const handleEdit = () => {
    setEditing(true);
  };

  // When plateMode changes externally, recalc perSide
  const [lastPlateMode, setLastPlateMode] = useState(plateMode);
  if (plateMode !== lastPlateMode) {
    setLastPlateMode(plateMode);
    if (plateMode) {
      const barDisplay = toDisplay(barWeight);
      const calc = (weight - barDisplay) / 2;
      setPerSide(calc > 0 ? Math.round(calc * 10) / 10 : 0);
    }
  }

  const otherUnit = unit === 'lb' ? 'kg' : 'lb';
  const converted = unit === 'lb' ? lbToKg(weight) : kgToLb(weight);
  const convertedLabel = `${Math.round(converted * 10) / 10}${otherUnit}`;

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
            {toDisplay(initialWeight)}{unit} × {initialReps}
          </span>
          {unit !== 'lb' && (
            <span className="text-[9px] tabular-nums text-slate-500">
              ({initialWeight}lb)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleEdit}
            className="p-2.5 text-slate-600 hover:text-slate-400 active:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnlog(); }}
            className="p-2.5 text-slate-700 hover:text-red-400 active:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Editable state
  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] tabular-nums font-bold text-slate-500 w-5 shrink-0">
          S{setNumber}
        </span>

        {plateMode ? (
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
              {weight}{unit}
            </span>
          </div>
        ) : (
          <NumericStepper
            value={weight}
            onChange={setWeight}
            step={unit === 'kg' ? 2.5 : weightStep}
            min={0}
            max={999}
            label={unit}
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

      {/* Conversion preview */}
      {weight > 0 && (
        <p className="text-[9px] text-slate-500 ml-6 mt-0.5 tabular-nums">
          = {convertedLabel}
        </p>
      )}
    </div>
  );
}
