'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface NumericStepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  inputWidth?: string;
}

export default function NumericStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  label,
  inputWidth = 'w-12',
}: NumericStepperProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Track whether the input is focused and what the user is typing
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max]
  );

  const stopRepeat = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const startRepeat = useCallback(
    (delta: number) => {
      onChange(clamp(valueRef.current + delta));
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          const next = clamp(valueRef.current + delta);
          onChange(next);
        }, 100);
      }, 400);
    },
    [onChange, clamp]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setDraft(raw);
    if (raw === '') return; // keep draft empty, commit on blur
    const num = parseFloat(raw);
    if (!isNaN(num)) onChange(clamp(num));
  };

  const handleFocus = () => {
    setFocused(true);
    setDraft(''); // clear so user starts fresh
  };

  const handleBlur = () => {
    setFocused(false);
    // If user left it empty, keep the original value
    if (draft === '') return;
    const num = parseFloat(draft);
    if (!isNaN(num)) onChange(clamp(num));
  };

  // Display: when focused show draft (empty until user types), otherwise show value
  const displayValue = focused ? draft : (value || '');

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onPointerDown={() => startRepeat(-step)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white active:bg-slate-600 transition-colors select-none touch-none"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*\.?[0-9]*"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`${inputWidth} h-8 text-center bg-slate-900 border border-slate-700 rounded-md text-[16px] text-white tabular-nums font-bold focus:outline-none focus:ring-1 focus:ring-primary`}
      />

      <button
        type="button"
        onPointerDown={() => startRepeat(step)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white active:bg-slate-600 transition-colors select-none touch-none"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {label && (
        <span className="text-[10px] text-slate-500 font-medium ml-0.5">{label}</span>
      )}
    </div>
  );
}
