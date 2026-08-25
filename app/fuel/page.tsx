'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarcodeScanner } from '@/components/nutrition/BarcodeScanner';
import type { DailyNutrition, NutritionLog, UserProfile } from '@/types';

type EstimateItem = {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: string;
};

type PhotoEstimate = {
  description: string;
  items: EstimateItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  uncertainty_percent: number;
  uncertainty_reason: string;
};

const emptyTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

function MacroBar({ label, value, target, tone }: { label: string; value: number; target: number; tone: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className={`text-xs font-semibold ${tone}`}>{label}</span>
        <span className="text-xs text-slate-400 tabular-nums">{Math.round(value)} / {Math.round(target)}g</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${tone.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function mealLabel(type: string | null) {
  if (!type) return 'Meal';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

async function imageFileToPayload(file: File): Promise<{ base64: string; mediaType: string; preview: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = reject;
    node.src = dataUrl;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process photo');
  ctx.drawImage(img, 0, 0, width, height);
  const optimized = canvas.toDataURL('image/jpeg', 0.84);
  return { base64: optimized.split(',')[1], mediaType: 'image/jpeg', preview: optimized };
}

export default function FuelPage() {
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<PhotoEstimate | null>(null);
  const [mealType, setMealType] = useState<string>('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const load = useCallback(async () => {
    try {
      const [todayRes, profileRes] = await Promise.all([
        fetch(`/api/nutrition/today?tz=${encodeURIComponent(timezone)}`),
        fetch('/api/profile'),
      ]);
      if (todayRes.ok) setToday(await todayRes.json());
      if (profileRes.ok) setProfile(await profileRes.json());
    } finally {
      setLoading(false);
    }
  }, [timezone]);

  useEffect(() => { load(); }, [load]);

  const totals = today?.totals || emptyTotals;
  const calorieTarget = profile?.dailyCalorieTarget ?? 2000;
  const proteinTarget = profile?.dailyProteinTarget ?? 150;
  const carbsPct = profile?.carbsPercent ?? 40;
  const fatPct = profile?.fatPercent ?? 30;
  const carbsTarget = Math.max(0, Math.round((calorieTarget * carbsPct / 100) / 4));
  const fatTarget = Math.max(0, Math.round((calorieTarget * fatPct / 100) / 9));
  const remaining = Math.round(calorieTarget - totals.calories);
  const caloriePct = calorieTarget > 0 ? Math.min(100, (totals.calories / calorieTarget) * 100) : 0;

  const filteredLogs = useMemo(() => {
    const logs = today?.logs || [];
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) =>
      log.rawInput.toLowerCase().includes(q) || (log.mealType || '').toLowerCase().includes(q),
    );
  }, [today?.logs, search]);

  const filteredTotals = useMemo(() => filteredLogs.reduce(
    (sum, log) => ({
      calories: sum.calories + (log.calories || 0),
      proteinG: sum.proteinG + (log.proteinG || 0),
      carbsG: sum.carbsG + (log.carbsG || 0),
      fatG: sum.fatG + (log.fatG || 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  ), [filteredLogs]);

  const estimateTotals = useMemo(() => {
    if (!estimate) return null;
    return estimate.items.reduce(
      (sum, item) => ({
        calories: sum.calories + (Number(item.calories) || 0),
        proteinG: sum.proteinG + (Number(item.protein_g) || 0),
        carbsG: sum.carbsG + (Number(item.carbs_g) || 0),
        fatG: sum.fatG + (Number(item.fat_g) || 0),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  }, [estimate]);

  const analyzeFile = async (file?: File) => {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError('');
    setEstimate(null);
    try {
      const payload = await imageFileToPayload(file);
      setPreview(payload.preview);
      const res = await fetch('/api/nutrition/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: payload.base64,
          mediaType: payload.mediaType,
          weightUnit: profile?.weightUnit || 'lb',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Photo analysis failed');
      setEstimate(data as PhotoEstimate);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Photo analysis failed');
    } finally {
      setPhotoBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (libraryRef.current) libraryRef.current.value = '';
    }
  };

  const updateEstimateItem = (index: number, patch: Partial<EstimateItem>) => {
    setEstimate((current) => current ? {
      ...current,
      items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item),
    } : current);
  };

  const removeEstimateItem = (index: number) => {
    setEstimate((current) => current ? {
      ...current,
      items: current.items.filter((_, i) => i !== index),
    } : current);
  };

  const dismissEstimate = () => {
    setEstimate(null);
    setPreview(null);
    setPhotoError('');
    setMealType('');
  };

  const savePhotoEstimate = async () => {
    if (!estimate || !estimateTotals || !estimate.items.length) return;
    setSavingPhoto(true);
    try {
      const res = await fetch('/api/nutrition/log-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: estimate.description,
          mealType: mealType || null,
          items: estimate.items.map((item) => ({
            name: item.name,
            portion: item.portion,
            calories: Number(item.calories) || 0,
            proteinG: Number(item.protein_g) || 0,
            carbsG: Number(item.carbs_g) || 0,
            fatG: Number(item.fat_g) || 0,
            confidence: item.confidence,
          })),
        }),
      });
      if (!res.ok) throw new Error('Could not save meal');
      dismissEstimate();
      await load();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not save meal');
    } finally {
      setSavingPhoto(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4"><div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" /><div className="h-64 bg-slate-800/40 rounded-2xl animate-pulse" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-5">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => analyzeFile(e.target.files?.[0])} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => analyzeFile(e.target.files?.[0])} />

      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Today</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Fuel</h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Daily goal</p>
          <p className="text-sm font-semibold text-slate-200 tabular-nums">{Math.round(calorieTarget).toLocaleString()} cal</p>
        </div>
      </header>

      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-sm text-slate-400">Calories remaining</p>
              <p className={`mt-1 text-4xl md:text-5xl font-bold tabular-nums ${remaining >= 0 ? 'text-white' : 'text-amber-400'}`}>
                {Math.abs(remaining).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-slate-500">{remaining >= 0 ? 'left today' : 'over target'} · {Math.round(totals.calories).toLocaleString()} eaten</p>
            </div>
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(51,65,85,.75)" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - caloriePct} />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div><div className="text-lg font-bold text-white tabular-nums">{Math.round(caloriePct)}%</div><div className="text-[10px] text-slate-500">used</div></div>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            <MacroBar label="Protein" value={totals.proteinG} target={proteinTarget} tone="text-blue-400" />
            <MacroBar label="Carbs" value={totals.carbsG} target={carbsTarget} tone="text-amber-400" />
            <MacroBar label="Fat" value={totals.fatG} target={fatTarget} tone="text-rose-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
          <p className="text-sm font-semibold text-white mb-3">Log food</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={photoBusy} className="min-h-24 rounded-xl bg-primary/15 border border-primary/20 text-primary px-2 py-3 flex flex-col items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h2l1-2h8l1 2h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" strokeWidth={2} /></svg>
              <span className="text-xs font-semibold">Take Photo</span>
            </button>
            <button type="button" onClick={() => libraryRef.current?.click()} disabled={photoBusy} className="min-h-24 rounded-xl bg-slate-800/70 border border-slate-700 text-slate-200 px-2 py-3 flex flex-col items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a2 2 0 012.8 0l1.2 1.2 2.2-2.2a2 2 0 012.8 0l3 3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-xs font-semibold">Choose Photo</span>
            </button>
            <button type="button" onClick={() => setScannerOpen(true)} className="min-h-24 rounded-xl bg-slate-800/70 border border-slate-700 text-slate-200 px-2 py-3 flex flex-col items-center justify-center gap-2 active:scale-[0.98]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V5a1 1 0 011-1h2m10 0h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M8 8v8m3-8v8m2-8v8m3-8v8" /></svg>
              <span className="text-xs font-semibold">Scan</span>
            </button>
          </div>
          {photoBusy && <div className="mt-3 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary">Analyzing food photo…</div>}
          {photoError && !estimate && <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{photoError}</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Today&apos;s food</h2>
            <p className="text-xs text-slate-500 mt-0.5">{today?.logs?.length || 0} logged item{(today?.logs?.length || 0) === 1 ? '' : 's'}</p>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meals…" className="w-full md:w-64 rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2.5 text-base text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {search && (
          <div className="px-4 md:px-5 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums">
            <span className="text-white font-semibold">Filtered: {Math.round(filteredTotals.calories)} cal</span>
            <span className="text-blue-400">{Math.round(filteredTotals.proteinG)}P</span>
            <span className="text-amber-400">{Math.round(filteredTotals.carbsG)}C</span>
            <span className="text-rose-400">{Math.round(filteredTotals.fatG)}F</span>
          </div>
        )}

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center"><p className="text-sm text-slate-400">{search ? 'No meals match that search.' : 'Nothing logged yet today.'}</p>{!search && <p className="text-xs text-slate-600 mt-1">Take a photo and Fuel will estimate the meal before saving it.</p>}</div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {filteredLogs.map((log: NutritionLog) => (
              <div key={log.id} className="p-4 md:px-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-800 grid place-items-center text-xs font-bold text-slate-400 shrink-0">{mealLabel(log.mealType).slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0"><p className="text-sm font-medium text-white truncate">{log.rawInput}</p><span className="text-[10px] uppercase tracking-wide text-slate-600 shrink-0">{mealLabel(log.mealType)}</span></div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs tabular-nums"><span className="text-slate-300 font-semibold">{Math.round(log.calories || 0)} cal</span><span className="text-blue-400">{Math.round(log.proteinG || 0)}P</span><span className="text-amber-400">{Math.round(log.carbsG || 0)}C</span><span className="text-rose-400">{Math.round(log.fatG || 0)}F</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {scannerOpen && <BarcodeScanner onLogged={() => { setScannerOpen(false); load(); }} onClose={() => setScannerOpen(false)} />}

      {(estimate || (photoBusy && preview)) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6">
          <div className="max-w-2xl mx-auto bg-[#0b1018] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div><p className="text-xs uppercase tracking-[0.16em] text-primary font-semibold">AI estimate</p><h2 className="text-lg font-bold text-white">Review before adding</h2></div>
              <button type="button" onClick={dismissEstimate} className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 grid place-items-center" aria-label="Close">×</button>
            </div>

            {preview && <img src={preview} alt="Food being analyzed" className="w-full max-h-64 object-cover" />}

            {photoBusy && <div className="p-8 text-center"><div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-primary animate-spin mx-auto" /><p className="text-sm text-slate-400 mt-3">Estimating portions and macros…</p></div>}

            {estimate && estimateTotals && (
              <div className="p-4 md:p-5 space-y-5">
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                  <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500">Estimated meal</p><p className="text-base font-semibold text-white mt-0.5">{estimate.description}</p></div><div className="text-right"><p className="text-3xl font-bold text-white tabular-nums">{Math.round(estimateTotals.calories)}</p><p className="text-xs text-slate-500">calories</p></div></div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs tabular-nums"><div className="rounded-lg bg-blue-500/10 py-2 text-blue-400"><b>{Math.round(estimateTotals.proteinG)}g</b><br />protein</div><div className="rounded-lg bg-amber-500/10 py-2 text-amber-400"><b>{Math.round(estimateTotals.carbsG)}g</b><br />carbs</div><div className="rounded-lg bg-rose-500/10 py-2 text-rose-400"><b>{Math.round(estimateTotals.fatG)}g</b><br />fat</div></div>
                  <p className="mt-3 text-xs text-slate-500">Likely range: {Math.max(0, Math.round(estimateTotals.calories * (1 - estimate.uncertainty_percent / 100)))}–{Math.round(estimateTotals.calories * (1 + estimate.uncertainty_percent / 100))} cal · {estimate.uncertainty_reason}</p>
                </div>

                <div className="space-y-3">
                  {estimate.items.map((item, index) => (
                    <div key={`${index}-${item.name}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 grid sm:grid-cols-2 gap-2">
                          <input value={item.name} onChange={(e) => updateEstimateItem(index, { name: e.target.value })} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-base text-white" aria-label={`Food ${index + 1} name`} />
                          <input value={item.portion} onChange={(e) => updateEstimateItem(index, { portion: e.target.value })} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-base text-white" aria-label={`Food ${index + 1} portion`} />
                        </div>
                        <button type="button" onClick={() => removeEstimateItem(index)} className="w-10 h-10 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400" aria-label={`Remove ${item.name}`}>×</button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[
                          ['calories', 'Cal', item.calories],
                          ['protein_g', 'P', item.protein_g],
                          ['carbs_g', 'C', item.carbs_g],
                          ['fat_g', 'F', item.fat_g],
                        ].map(([field, label, value]) => (
                          <label key={String(field)} className="text-[10px] uppercase tracking-wide text-slate-600">{label}<input type="number" min="0" value={Number(value)} onChange={(e) => updateEstimateItem(index, { [String(field)]: Math.max(0, Number(e.target.value) || 0) } as Partial<EstimateItem>)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-base text-white tabular-nums" /></label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-2">Meal</p>
                  <div className="grid grid-cols-4 gap-2">
                    {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => <button key={type} type="button" onClick={() => setMealType(mealType === type ? '' : type)} className={`rounded-lg py-2.5 text-xs font-semibold capitalize border ${mealType === type ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{type}</button>)}
                  </div>
                </div>

                {photoError && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{photoError}</div>}

                <div className="flex gap-3">
                  <button type="button" onClick={dismissEstimate} className="flex-1 rounded-xl bg-slate-800 text-slate-300 py-3 font-semibold text-sm">Cancel</button>
                  <button type="button" onClick={savePhotoEstimate} disabled={savingPhoto || estimate.items.length === 0} className="flex-[1.4] rounded-xl bg-primary text-white py-3 font-semibold text-sm disabled:opacity-50">{savingPhoto ? 'Adding…' : `Add ${Math.round(estimateTotals.calories)} cal to Fuel`}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
