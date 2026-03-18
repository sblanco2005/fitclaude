'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FoodData {
  name: string;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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
  | { step: 'photo_capture'; barcode: string }
  | { step: 'photo_analyzing'; barcode: string }
  | { step: 'error'; message: string };

export function BarcodeScanner({ onLogged, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(true);
  const [state, setState] = useState<ScanState>({ step: 'scanning' });
  const [quantity, setQuantity] = useState(1);

  // Manual entry form
  const [regName, setRegName] = useState('');
  const [regCal, setRegCal] = useState('');
  const [regPro, setRegPro] = useState('');
  const [regCarbs, setRegCarbs] = useState('');
  const [regFat, setRegFat] = useState('');
  const [regUnit, setRegUnit] = useState('serving');

  const currentBarcodeRef = useRef<string>('');
  const labelVideoRef = useRef<HTMLVideoElement>(null);
  const labelStreamRef = useRef<MediaStream | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Stop cameras
  const stopLabelCamera = useCallback(() => {
    if (labelStreamRef.current) {
      labelStreamRef.current.getTracks().forEach((t) => t.stop());
      labelStreamRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopCamera(); stopLabelCamera(); };
  }, [stopCamera, stopLabelCamera]);

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

        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();

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
          stopCamera();
          setQuantity(1);
          setState({ step: 'found', food: data.food, logging: false });
        }
      } else if (res.status === 404) {
        stopCamera();
        currentBarcodeRef.current = code;
        setState({ step: 'not_found', barcode: code });
      }
    } catch {
      setState({ step: 'error', message: 'Failed to look up barcode' });
    }
  };

  // Log food with quantity
  const logFood = async (food: FoodData, qty: number) => {
    setState({ step: 'found', food, logging: true });
    try {
      const res = await fetch('/api/nutrition/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: food.name,
          calories: food.calories,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
          servingUnit: food.servingUnit,
          quantity: qty,
          timezone,
        }),
      });
      if (res.ok) {
        const result: LogResult = await res.json();
        setState({ step: 'logged', result });
        onLogged();
      } else {
        setState({ step: 'error', message: 'Failed to log food' });
      }
    } catch {
      setState({ step: 'error', message: 'Failed to log food' });
    }
  };

  // Log manually entered food
  const handleManualLog = async (barcode: string) => {
    if (!regName.trim() || !regCal || !regPro) return;

    try {
      const res = await fetch('/api/nutrition/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          calories: parseFloat(regCal),
          proteinG: parseFloat(regPro),
          carbsG: parseFloat(regCarbs || '0'),
          fatG: parseFloat(regFat || '0'),
          servingUnit: regUnit,
          quantity: 1,
          timezone,
        }),
      });
      if (res.ok) {
        const result: LogResult = await res.json();
        setState({ step: 'logged', result });
        onLogged();
      } else {
        setState({ step: 'error', message: 'Failed to log food' });
      }
    } catch {
      setState({ step: 'error', message: 'Failed to log food' });
    }
  };

  // Capture a frame from video element as compressed JPEG base64
  const captureFrame = (video: HTMLVideoElement, maxWidth = 800): { base64: string; mediaType: string } => {
    const canvas = document.createElement('canvas');
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxWidth) {
      h = Math.round(h * (maxWidth / w));
      w = maxWidth;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { base64: dataUrl.split(',')[1] || '', mediaType: 'image/jpeg' };
  };

  // Open camera for label photo, capture a frame, then send to vision
  const handleSnapLabel = async (barcode: string) => {
    setState({ step: 'photo_capture', barcode });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      labelStreamRef.current = stream;
      await new Promise((r) => setTimeout(r, 100));
      if (labelVideoRef.current) {
        labelVideoRef.current.srcObject = stream;
        await labelVideoRef.current.play();
      }
    } catch {
      setState({ step: 'error', message: 'Camera access denied.' });
    }
  };

  const takeLabelPhoto = async () => {
    if (!labelVideoRef.current) return;
    const barcode = currentBarcodeRef.current;
    const { base64, mediaType } = captureFrame(labelVideoRef.current);
    stopLabelCamera();
    await handlePhotoCapture(barcode, base64, mediaType);
  };

  // Process captured photo through vision agent
  const handlePhotoCapture = async (barcode: string, base64: string, mediaType: string) => {
    setState({ step: 'photo_analyzing', barcode });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Read the nutrition label and extract the macros.',
          topic: 'nutrition',
          image_base64: base64,
          image_media_type: mediaType,
          timezone,
          use_vision: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const response: string = data.response || '';
        const clean = response.replace(/\*\*/g, '');

        const calMatch = clean.match(/calorie[s]?\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
          || clean.match(/(\d+(?:\.\d+)?)\s*(?:cal|kcal)/i);
        const proMatch = clean.match(/protein\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
          || clean.match(/(\d+(?:\.\d+)?)\s*g?\s*prot/i);
        const carbMatch = clean.match(/(?:total\s+)?carb[s]?\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
          || clean.match(/(\d+(?:\.\d+)?)\s*g?\s*carb/i);
        const fatMatch = clean.match(/(?:total\s+)?fat\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
          || clean.match(/(\d+(?:\.\d+)?)\s*g?\s*fat/i);
        const nameMatch = clean.match(/[Ll]ogged\s+(?:\d+x?\s+)?(.+?)\s*[\u2014\u2013\-—–]/)
          || clean.match(/[Ll]ogged\s+(?:\d+x?\s+)?(.+?)(?:\s*\d+\s*cal|\n)/i);
        const servingMatch = clean.match(/serving\s*size\s*[:=]?\s*(.+?)(?:\s*\(|$)/im);

        if (servingMatch) {
          const sv = servingMatch[1].trim();
          if (sv.length > 0) setRegUnit(sv);
        }
        if (calMatch) setRegCal(calMatch[1]);
        if (proMatch) setRegPro(proMatch[1]);
        if (carbMatch) setRegCarbs(carbMatch[1]);
        if (fatMatch) setRegFat(fatMatch[1]);
        if (nameMatch) {
          const extracted = nameMatch[1].trim();
          if (extracted.length > 1) setRegName(extracted);
        }
      }

      // Go to manual entry form with pre-filled values
      setState({ step: 'not_found', barcode });
    } catch (err) {
      console.error('[BarcodeScanner] Photo capture failed:', err);
      setState({ step: 'error', message: 'Failed to analyze photo. Try entering macros manually.' });
    }
  };

  const handleScanAgain = () => {
    setQuantity(1);
    setState({ step: 'scanning' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3 pt-[env(safe-area-inset-top,48px)] bg-black/60">
        <h3 className="text-white font-semibold text-sm">Scan Barcode</h3>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Camera view */}
      {state.step === 'scanning' && (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 border-2 border-primary rounded-lg relative">
              <div className="absolute inset-x-0 h-0.5 bg-primary/80 animate-scan" />
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

      {/* Found — show macros + quantity stepper */}
      {state.step === 'found' && !state.logging && (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-sm !p-6">
            <h3 className="text-lg font-bold text-white mb-1 text-center">{state.food.name}</h3>
            <p className="text-xs text-muted text-center mb-4">
              Per serving ({state.food.servingUnit})
            </p>

            {/* Per-serving macros */}
            <div className="grid grid-cols-4 gap-2 text-center mb-5">
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

            {/* Quantity stepper */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full bg-slate-700/60 text-white font-bold text-lg flex items-center justify-center active:bg-slate-600/60"
              >
                −
              </button>
              <div className="text-center min-w-[60px]">
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1 && v <= 50) setQuantity(v);
                  }}
                  className="w-14 text-center bg-transparent text-2xl font-bold text-white border-b-2 border-primary/50 focus:border-primary focus:outline-none"
                />
                <div className="text-xs text-muted mt-1">servings</div>
              </div>
              <button
                onClick={() => setQuantity(Math.min(50, quantity + 1))}
                className="w-10 h-10 rounded-full bg-slate-700/60 text-white font-bold text-lg flex items-center justify-center active:bg-slate-600/60"
              >
                +
              </button>
            </div>

            {/* Total preview (when qty > 1) */}
            {quantity > 1 && (
              <div className="bg-slate-800/50 rounded-lg px-3 py-2 mb-4 text-center">
                <span className="text-xs text-muted">Total: </span>
                <span className="text-sm font-semibold text-primary">
                  {Math.round(state.food.calories * quantity)} cal
                </span>
                <span className="text-xs text-muted"> · </span>
                <span className="text-sm font-semibold text-blue-400">
                  {Math.round(state.food.proteinG * quantity)}g P
                </span>
                <span className="text-xs text-muted"> · </span>
                <span className="text-sm font-semibold text-amber-400">
                  {Math.round(state.food.carbsG * quantity)}g C
                </span>
                <span className="text-xs text-muted"> · </span>
                <span className="text-sm font-semibold text-red-400">
                  {Math.round(state.food.fatG * quantity)}g F
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => logFood(state.food, quantity)}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium text-sm transition-colors"
              >
                Log It
              </button>
              <button
                onClick={handleScanAgain}
                className="flex-1 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm"
              >
                Scan Again
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Found + logging spinner */}
      {state.step === 'found' && state.logging && (
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-sm mx-4 text-center !p-6">
            <p className="text-sm text-white mb-2">
              Logging {quantity > 1 ? `${quantity}x ` : ''}{state.food.name}...
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-sm font-bold text-primary">{Math.round(state.food.calories * quantity)}</div>
                <div className="text-xs text-muted">cal</div>
              </div>
              <div>
                <div className="text-sm font-bold text-blue-400">{Math.round(state.food.proteinG * quantity)}g</div>
                <div className="text-xs text-muted">protein</div>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-400">{Math.round(state.food.carbsG * quantity)}g</div>
                <div className="text-xs text-muted">carbs</div>
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">{Math.round(state.food.fatG * quantity)}g</div>
                <div className="text-xs text-muted">fat</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Logged result */}
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

      {/* Photo capture camera view */}
      {state.step === 'photo_capture' && (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={labelVideoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-48 border-2 border-blue-400/60 rounded-lg" />
          </div>
          <p className="absolute top-6 inset-x-0 text-center text-sm text-white/70">
            Frame the nutrition label
          </p>
          <div className="absolute bottom-8 inset-x-0 flex justify-center">
            <button
              onClick={takeLabelPhoto}
              className="w-16 h-16 rounded-full bg-white/90 border-4 border-white shadow-lg active:scale-90 transition-transform"
            >
              <div className="w-full h-full rounded-full border-2 border-slate-300" />
            </button>
          </div>
        </div>
      )}

      {/* Not found — manual entry */}
      {state.step === 'not_found' && (
        <div className="flex-1 overflow-y-auto p-4">
          <Card className="w-full max-w-sm mx-auto !p-5">
            <h3 className="text-base font-bold text-white mb-1">Not Found</h3>
            <p className="text-xs text-muted mb-3">
              Barcode <span className="text-slate-400 font-mono">{state.barcode}</span> not found on Open Food Facts.
            </p>

            {/* Snap label button */}
            <button
              onClick={() => handleSnapLabel(state.barcode)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl bg-blue-500/15 text-blue-400 font-medium text-sm hover:bg-blue-500/25 active:scale-[0.98] transition-all border border-blue-500/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              Snap Nutrition Label
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-600 uppercase tracking-widest">or enter manually</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

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
                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold">Serving Size</label>
                <input
                  value={regUnit}
                  onChange={(e) => setRegUnit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-base text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                  placeholder="e.g. 1/2 cup, 1 bar, 2 pieces"
                />
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
                onClick={() => handleManualLog(state.barcode)}
                disabled={!regName.trim() || !regCal || !regPro}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-medium text-sm transition-colors mt-2"
              >
                Log It
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Photo analyzing */}
      {state.step === 'photo_analyzing' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-sm text-center !p-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Reading Label...</h3>
            <p className="text-xs text-slate-400">AI is extracting nutrition info from your photo</p>
          </Card>
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
    </div>
  );
}
