'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloseIcon, CheckIcon, PlusIcon, MinusIcon, BarcodeIcon } from '@/components/redesign/icons';

// Redesigned barcode scanner — full parity with the V1 flow:
// camera scan → OFF lookup → quantity → log; not-found manual entry;
// snap-a-label vision extraction. Source of logic: components/nutrition/BarcodeScanner.tsx

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
  food: { name: string; calories: number; proteinG: number; carbsG: number; fatG: number };
  quantity: number;
  dailyTotals: { calories: number; proteinG: number; carbsG: number; fatG: number };
}
type ScanState =
  | { step: 'scanning' }
  | { step: 'found'; food: FoodData; logging: boolean }
  | { step: 'logged'; result: LogResult }
  | { step: 'not_found'; barcode: string }
  | { step: 'photo_capture'; barcode: string }
  | { step: 'photo_analyzing'; barcode: string }
  | { step: 'error'; message: string };

const field = 'font-body w-full rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3.5 py-2.5 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none';

export function BarcodeScanner({ onLogged, onClose }: { onLogged: () => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const labelVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const labelStreamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(true);
  const barcodeRef = useRef('');
  const [state, setState] = useState<ScanState>({ step: 'scanning' });
  const [quantity, setQuantity] = useState(1);
  const [reg, setReg] = useState({ name: '', cal: '', pro: '', carbs: '', fat: '', unit: 'serving' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  const stopLabel = useCallback(() => {
    labelStreamRef.current?.getTracks().forEach((t) => t.stop());
    labelStreamRef.current = null;
  }, []);

  useEffect(() => () => { stopCamera(); stopLabel(); }, [stopCamera, stopLabel]);

  const lookup = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/nutrition/barcode?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          stopCamera();
          setQuantity(1);
          setState({ step: 'found', food: data.food, logging: false });
          return;
        }
      }
      stopCamera();
      barcodeRef.current = code;
      setState({ step: 'not_found', barcode: code });
    } catch {
      setState({ step: 'error', message: 'Failed to look up barcode.' });
    }
  }, [stopCamera]);

  // camera scan loop
  useEffect(() => {
    if (state.step !== 'scanning') return;
    let cancelled = false;
    scanningRef.current = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(videoRef.current!, (result, _e, ctrls) => {
          if (result && scanningRef.current && !cancelled) {
            scanningRef.current = false;
            ctrls?.stop();
            lookup(result.getText());
          }
        });
        if (cancelled) controls.stop();
      } catch {
        if (!cancelled) setState({ step: 'error', message: 'Camera access denied. Allow camera permission, or enter macros manually.' });
      }
    })();
    return () => { cancelled = true; scanningRef.current = false; };
  }, [state.step, lookup]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/nutrition/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, timezone: tz }) });
    if (res.ok) { setState({ step: 'logged', result: await res.json() }); onLogged(); }
    else setState({ step: 'error', message: 'Failed to log food.' });
  };

  const logFound = (food: FoodData, qty: number) => {
    setState({ step: 'found', food, logging: true });
    post({ name: food.name, calories: food.calories, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, servingUnit: food.servingUnit, quantity: qty });
  };
  const logManual = () => {
    if (!reg.name.trim() || !reg.cal || !reg.pro) return;
    post({ name: reg.name.trim(), calories: parseFloat(reg.cal), proteinG: parseFloat(reg.pro), carbsG: parseFloat(reg.carbs || '0'), fatG: parseFloat(reg.fat || '0'), servingUnit: reg.unit, quantity: 1 });
  };

  const captureFrame = (video: HTMLVideoElement, maxW = 800) => {
    const canvas = document.createElement('canvas');
    let w = video.videoWidth, h = video.videoHeight;
    if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
    return (canvas.toDataURL('image/jpeg', 0.85).split(',')[1]) || '';
  };

  const snapLabel = async (barcode: string) => {
    setState({ step: 'photo_capture', barcode });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      labelStreamRef.current = stream;
      await new Promise((r) => setTimeout(r, 100));
      if (labelVideoRef.current) { labelVideoRef.current.srcObject = stream; await labelVideoRef.current.play(); }
    } catch {
      setState({ step: 'error', message: 'Camera access denied.' });
    }
  };
  const takeLabelPhoto = async () => {
    if (!labelVideoRef.current) return;
    const barcode = barcodeRef.current;
    const b64 = captureFrame(labelVideoRef.current);
    stopLabel();
    setState({ step: 'photo_analyzing', barcode });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Read the nutrition label and extract the macros.', topic: 'nutrition', image_base64: b64, image_media_type: 'image/jpeg', timezone: tz, use_vision: true }),
      });
      if (res.ok) {
        const clean = String((await res.json()).response || '').replace(/\*\*/g, '');
        const m = (re: RegExp) => clean.match(re)?.[1];
        const cal = m(/calorie[s]?\s*[:=]?\s*(\d+(?:\.\d+)?)/i) || m(/(\d+(?:\.\d+)?)\s*(?:cal|kcal)/i);
        const pro = m(/protein\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
        const carb = m(/(?:total\s+)?carb[s]?\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
        const fat = m(/(?:total\s+)?fat\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
        const name = m(/[Ll]ogged\s+(?:\d+x?\s+)?(.+?)\s*[—–\-]/);
        setReg((r) => ({ ...r, cal: cal ?? r.cal, pro: pro ?? r.pro, carbs: carb ?? r.carbs, fat: fat ?? r.fat, name: name?.trim() || r.name }));
      }
      setState({ step: 'not_found', barcode });
    } catch {
      setState({ step: 'error', message: 'Couldn’t read the label. Enter macros manually.' });
    }
  };

  const close = () => { stopCamera(); stopLabel(); onClose(); };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'var(--rd-bg)' }}>
      {/* header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <p className="font-display text-[17px] font-bold text-[var(--rd-ink)]">Scan a barcode</p>
        <button onClick={close} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]">
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-8">
        {state.step === 'scanning' && (
          <div>
            <div className="relative overflow-hidden rounded-[20px] bg-black" style={{ aspectRatio: '3/4' }}>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-[78%] rounded-[14px] border-2" style={{ borderColor: 'var(--rd-lime)', boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
              </div>
            </div>
            <p className="mt-4 text-center text-[13px] text-[var(--rd-text-muted)]">Point at the barcode</p>
            <button onClick={() => { stopCamera(); barcodeRef.current = ''; setState({ step: 'not_found', barcode: '' }); }} className="mt-3 w-full py-2 text-[13px] font-semibold text-[var(--rd-lime)]">
              Enter manually instead
            </button>
          </div>
        )}

        {state.step === 'found' && (
          <div className="animate-fadeup">
            <div className="rd-card p-5">
              <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-lime)]">FOUND</p>
              <h3 className="font-display mt-1 text-[19px] font-bold text-[var(--rd-ink)]">{state.food.name}</h3>
              <p className="font-label mt-1 text-[11px] text-[var(--rd-text-faint)]">per {state.food.servingUnit || 'serving'}</p>
              <MacroTiles cal={state.food.calories} p={state.food.proteinG} c={state.food.carbsG} f={state.food.fatG} mult={quantity} />
              <div className="mt-4 flex items-center justify-between">
                <span className="font-label text-[11px] text-[var(--rd-text-muted)]">QUANTITY</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--rd-card)] text-[var(--rd-ink)]"><MinusIcon size={15} /></button>
                  <span className="font-num w-8 text-center text-[18px] font-bold text-[var(--rd-ink)]">{quantity}</span>
                  <button onClick={() => setQuantity((q) => Math.min(50, q + 1))} className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--rd-card)] text-[var(--rd-ink)]"><PlusIcon size={15} /></button>
                </div>
              </div>
            </div>
            <button onClick={() => logFound(state.food, quantity)} disabled={state.logging} className="grad-lime mt-4 flex h-12 w-full items-center justify-center rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-60">
              {state.logging ? 'Logging…' : 'Log it'}
            </button>
          </div>
        )}

        {state.step === 'logged' && (
          <div className="animate-fadeup flex flex-col items-center pt-8 text-center">
            <span className="grad-lime animate-floaty flex h-16 w-16 items-center justify-center rounded-full text-[#0A0C10]" style={{ boxShadow: 'var(--rd-glow-lime)' }}><CheckIcon size={30} /></span>
            <h3 className="font-display mt-4 text-[20px] font-bold text-[var(--rd-ink)]">Logged {state.result.food.name}</h3>
            <p className="mt-1 text-[13px] text-[var(--rd-text-muted)]">
              Daily: {Math.round(state.result.dailyTotals.calories)} cal · {Math.round(state.result.dailyTotals.proteinG)}g protein
            </p>
            <div className="mt-6 flex w-full gap-2">
              <button onClick={() => { setReg({ name: '', cal: '', pro: '', carbs: '', fat: '', unit: 'serving' }); setState({ step: 'scanning' }); }} className="flex-1 rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[14px] font-semibold text-[var(--rd-text-secondary)]">Scan another</button>
              <button onClick={close} className="grad-lime flex-1 rounded-[13px] py-3 text-[14px] font-semibold text-[#0A0C10]">Done</button>
            </div>
          </div>
        )}

        {state.step === 'not_found' && (
          <div className="animate-fadeup space-y-3">
            <div className="flex items-center gap-2 rounded-[12px] border p-3" style={{ borderColor: 'rgba(255,178,62,.28)', background: 'rgba(255,178,62,.08)' }}>
              <BarcodeIcon size={18} className="text-[var(--rd-amber)]" />
              <p className="text-[12px] text-[var(--rd-text-secondary)]">{state.barcode ? 'Not in the database — add it manually.' : 'Enter the food manually.'}</p>
            </div>
            <button onClick={() => snapLabel(state.barcode)} className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[13px] font-semibold text-[var(--rd-lime)]">
              📸 Snap nutrition label
            </button>
            <input className={field} placeholder="Product name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
            <input className={field} placeholder="Serving size (e.g. 100g)" value={reg.unit} onChange={(e) => setReg({ ...reg, unit: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={field} inputMode="decimal" placeholder="Calories" value={reg.cal} onChange={(e) => setReg({ ...reg, cal: e.target.value })} />
              <input className={field} inputMode="decimal" placeholder="Protein (g)" value={reg.pro} onChange={(e) => setReg({ ...reg, pro: e.target.value })} />
              <input className={field} inputMode="decimal" placeholder="Carbs (g)" value={reg.carbs} onChange={(e) => setReg({ ...reg, carbs: e.target.value })} />
              <input className={field} inputMode="decimal" placeholder="Fat (g)" value={reg.fat} onChange={(e) => setReg({ ...reg, fat: e.target.value })} />
            </div>
            <button onClick={logManual} disabled={!reg.name.trim() || !reg.cal || !reg.pro} className="grad-lime flex h-12 w-full items-center justify-center rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-40">Log it</button>
          </div>
        )}

        {state.step === 'photo_capture' && (
          <div>
            <div className="relative overflow-hidden rounded-[20px] bg-black" style={{ aspectRatio: '3/4' }}>
              <video ref={labelVideoRef} playsInline muted className="h-full w-full object-cover" />
            </div>
            <p className="mt-4 text-center text-[13px] text-[var(--rd-text-muted)]">Frame the nutrition label</p>
            <button onClick={takeLabelPhoto} className="grad-lime mt-3 flex h-12 w-full items-center justify-center rounded-[13px] text-[15px] font-semibold text-[#0A0C10]">Capture</button>
          </div>
        )}

        {state.step === 'photo_analyzing' && (
          <div className="flex flex-col items-center pt-16 text-center">
            <span className="h-10 w-10 animate-spinslow rounded-full border-2 border-[var(--rd-border)] border-t-[var(--rd-lime)]" />
            <p className="mt-4 text-[14px] font-semibold text-[var(--rd-ink)]">Reading the label…</p>
          </div>
        )}

        {state.step === 'error' && (
          <div className="flex flex-col items-center pt-16 text-center">
            <p className="text-[14px] font-semibold text-[var(--rd-ember)]">{state.message}</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setState({ step: 'not_found', barcode: barcodeRef.current })} className="rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-4 py-2.5 text-[13px] font-semibold text-[var(--rd-text-secondary)]">Enter manually</button>
              <button onClick={close} className="grad-lime rounded-[12px] px-4 py-2.5 text-[13px] font-semibold text-[#0A0C10]">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MacroTiles({ cal, p, c, f, mult = 1 }: { cal: number; p: number; c: number; f: number; mult?: number }) {
  const tiles = [
    { v: p, label: 'PROTEIN', color: 'var(--rd-macro-protein)' },
    { v: c, label: 'CARBS', color: 'var(--rd-macro-carbs)' },
    { v: f, label: 'FAT', color: 'var(--rd-macro-fat)' },
  ];
  return (
    <>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-num text-[28px] font-bold text-[var(--rd-ink)]">{Math.round(cal * mult)}</span>
        <span className="font-label text-[12px] text-[var(--rd-text-faint)]">kcal{mult > 1 ? ` · ${mult}×` : ''}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] py-2 text-center">
            <div className="font-num text-[15px] font-bold" style={{ color: t.color }}>{Math.round(t.v * mult)}g</div>
            <div className="font-label mt-0.5 text-[8px] tracking-[.12em] text-[var(--rd-text-faint)]">{t.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}
