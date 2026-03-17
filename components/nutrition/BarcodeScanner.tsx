'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FoodData {
  id: string;
  name: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  barcode: string;
}

interface LogResult {
  logged: boolean;
  food: { name: string; calories: number; proteinG: number; carbsG: number; fatG: number };
  quantity: number;
  dailyTotals: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

interface BarcodeScannerProps {
  onLogged: () => void;
  onClose: () => void;
}

// ─── Scanner States ─────────────────────────────────────────────────────────

type ScanState =
  | { step: 'scanning' }
  | { step: 'found'; food: FoodData; logging: boolean }
  | { step: 'logged'; result: LogResult }
  | { step: 'not_found'; barcode: string }
  | { step: 'register'; barcode: string; saving: boolean }
  | { step: 'error'; message: string };

export function BarcodeScanner({ onLogged, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(true);
  const [state, setState] = useState<ScanState>({ step: 'scanning' });

  // Register form
  const [regName, setRegName] = useState('');
  const [regCal, setRegCal] = useState('');
  const [regPro, setRegPro] = useState('');
  const [regCarbs, setRegCarbs] = useState('');
  const [regFat, setRegFat] = useState('');
  const [regUnit, setRegUnit] = useState('serving');

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Stop camera
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Start camera and scan loop
  useEffect(() => {
    if (state.step !== 'scanning') return;

    let cancelled = false;
    scanningRef.current = true;

    const startScanning = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Dynamic import to avoid SSR issues
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();

        // ZXing uses a callback-based continuous scanning API
        const controls = await reader.decodeFromVideoElement(
          videoRef.current!,
          (result, _error, _controls) => {
            if (result && scanningRef.current && !cancelled) {
              scanningRef.current = false;
              _controls?.stop();
              handleBarcode(result.getText());
            }
          }
        );

        // Store controls for cleanup
        if (cancelled) {
          controls.stop();
        }
      } catch (err) {
        if (!cancelled) {
          setState({ step: 'error', message: 'Camera access denied. Please allow camera permissions.' });
        }
      }
    };

    startScanning();

    return () => {
      cancelled = true;
      scanningRef.current = false;
    };
  }, [state.step]);

  // Handle detected barcode
  const handleBarcode = async (code: string) => {
    try {
      const res = await fetch(`/api/nutrition/barcode?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          // Auto-log immediately — no enter key needed
          setState({ step: 'found', food: data.food, logging: true });
          await autoLog(code, 1);
        }
      } else if (res.status === 404) {
        // New barcode — ask for macro info
        stopCamera();
        setState({ step: 'not_found', barcode: code });
      }
    } catch {
      setState({ step: 'error', message: 'Failed to look up barcode' });
    }
  };

  // Auto-log a known food
  const autoLog = async (barcode: string, qty: number) => {
    try {
      const res = await fetch('/api/nutrition/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, quantity: qty, timezone }),
      });
      if (res.ok) {
        const result: LogResult = await res.json();
        stopCamera();
        setState({ step: 'logged', result });
        onLogged();
      }
    } catch {
      setState({ step: 'error', message: 'Failed to log food' });
    }
  };

  // Register new food with barcode
  const handleRegister = async (barcode: string) => {
    if (!regName.trim() || !regCal || !regPro) return;
    setState({ step: 'register', barcode, saving: true });

    try {
      const res = await fetch('/api/nutrition/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          name: regName.trim(),
          calories: parseFloat(regCal),
          proteinG: parseFloat(regPro),
          carbsG: parseFloat(regCarbs || '0'),
          fatG: parseFloat(regFat || '0'),
          servingUnit: regUnit,
          timezone,
        }),
      });
      if (res.ok) {
        const result: LogResult = await res.json();
        setState({ step: 'logged', result });
        onLogged();
      } else {
        setState({ step: 'error', message: 'Failed to save food' });
      }
    } catch {
      setState({ step: 'error', message: 'Failed to save food' });
    }
  };

  const handleScanAgain = () => {
    setState({ step: 'scanning' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60">
        <h3 className="text-white font-semibold text-sm">Scan Barcode</h3>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="text-slate-400 hover:text-white p-1"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Camera view (only show when scanning) */}
      {state.step === 'scanning' && (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Scanning overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 border-2 border-primary rounded-lg relative">
              {/* Animated scan line */}
              <div className="absolute inset-x-0 h-0.5 bg-primary/80 animate-scan" />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br" />
            </div>
          </div>
          <p className="absolute bottom-8 inset-x-0 text-center text-sm text-white/70">
            Point camera at barcode
          </p>
        </div>
      )}

      {/* Auto-logged result */}
      {state.step === 'logged' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-sm text-center !p-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Logged!</h3>
            <p className="text-sm text-slate-300 mb-4">
              {state.result.quantity > 1 ? `${state.result.quantity}x ` : ''}
              {state.result.food.name}
            </p>
            <div className="grid grid-cols-4 gap-2 text-center mb-5">
              <div>
                <div className="text-sm font-bold text-primary">{Math.round(state.result.food.calories)}</div>
                <div className="text-xs text-muted">cal</div>
              </div>
              <div>
                <div className="text-sm font-bold text-blue-400">{Math.round(state.result.food.proteinG)}g</div>
                <div className="text-xs text-muted">protein</div>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-400">{Math.round(state.result.food.carbsG)}g</div>
                <div className="text-xs text-muted">carbs</div>
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">{Math.round(state.result.food.fatG)}g</div>
                <div className="text-xs text-muted">fat</div>
              </div>
            </div>
            <div className="text-xs text-muted mb-5">
              Daily: {Math.round(state.result.dailyTotals.calories)} cal, {Math.round(state.result.dailyTotals.proteinG)}g protein
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleScanAgain}
                className="flex-1 py-3 rounded-xl bg-primary/20 text-primary font-medium text-sm"
              >
                Scan Another
              </button>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="flex-1 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm"
              >
                Done
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Not found — register new food */}
      {(state.step === 'not_found' || (state.step === 'register' && !state.saving)) && (
        <div className="flex-1 overflow-y-auto p-4">
          <Card className="w-full max-w-sm mx-auto !p-5">
            <h3 className="text-base font-bold text-white mb-1">New Product</h3>
            <p className="text-xs text-muted mb-4">
              Barcode <span className="text-slate-400 font-mono">{state.step === 'not_found' ? state.barcode : state.barcode}</span> not in your database.
              Enter the nutrition info from the label.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold">Product Name</label>
                <input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                  placeholder="e.g. Quest Protein Bar"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold">Serving Unit</label>
                <div className="flex gap-1.5 mt-1">
                  {['serving', 'bar', 'can', 'bottle', 'cup', 'piece'].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setRegUnit(u)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        regUnit === u
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-slate-800 text-slate-500 border border-transparent'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted uppercase tracking-widest font-bold">Calories</label>
                  <input
                    value={regCal}
                    onChange={(e) => setRegCal(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-400 uppercase tracking-widest font-bold">Protein (g)</label>
                  <input
                    value={regPro}
                    onChange={(e) => setRegPro(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-400 uppercase tracking-widest font-bold">Carbs (g)</label>
                  <input
                    value={regCarbs}
                    onChange={(e) => setRegCarbs(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-red-400 uppercase tracking-widest font-bold">Fat (g)</label>
                  <input
                    value={regFat}
                    onChange={(e) => setRegFat(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                    placeholder="0"
                  />
                </div>
              </div>

              <button
                onClick={() => handleRegister(state.step === 'not_found' ? state.barcode : (state as { barcode: string }).barcode)}
                disabled={!regName.trim() || !regCal || !regPro}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-medium text-sm transition-colors mt-2"
              >
                Save & Log
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Saving spinner */}
      {state.step === 'register' && state.saving && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted">Saving...</div>
        </div>
      )}

      {/* Error */}
      {state.step === 'error' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-sm text-center !p-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm text-slate-300 mb-4">{state.message}</p>
            <div className="flex gap-2">
              <button
                onClick={handleScanAgain}
                className="flex-1 py-3 rounded-xl bg-primary/20 text-primary font-medium text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="flex-1 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Found + auto-logging */}
      {state.step === 'found' && state.logging && (
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center !p-6">
            <p className="text-sm text-white mb-2">Logging {state.food.name}...</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-sm font-bold text-primary">{Math.round(state.food.calories)}</div>
                <div className="text-xs text-muted">cal</div>
              </div>
              <div>
                <div className="text-sm font-bold text-blue-400">{Math.round(state.food.proteinG)}g</div>
                <div className="text-xs text-muted">protein</div>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-400">{Math.round(state.food.carbsG)}g</div>
                <div className="text-xs text-muted">carbs</div>
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">{Math.round(state.food.fatG)}g</div>
                <div className="text-xs text-muted">fat</div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
