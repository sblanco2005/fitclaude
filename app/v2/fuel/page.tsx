'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RecentNutritionItem } from '@/types';
import { MacroBar } from '@/components/redesign/nutrition/MacroBar';
import { useNutrition, type MealItem } from '@/components/redesign/nutrition/useNutrition';
import { BarcodeScanner } from '@/components/redesign/nutrition/BarcodeScanner';
import { ScreenHeader, Pill } from '@/components/redesign/ui';
import { PlusIcon, BarcodeIcon, CheckIcon, SpinIcon } from '@/components/redesign/icons';
import { useToast } from '@/components/ui/Toast';

// Screen 04 · Nutrition ("Fuel") — accent: lime
const MEAL_STYLE: Record<string, { letter: string; color: string; tint: string }> = {
  breakfast: { letter: 'B', color: 'var(--rd-amber)', tint: 'rgba(255,178,62,.14)' },
  lunch: { letter: 'L', color: 'var(--rd-ember)', tint: 'rgba(255,107,69,.14)' },
  dinner: { letter: 'D', color: 'var(--rd-violet)', tint: 'rgba(155,123,255,.16)' },
  snack: { letter: 'S', color: 'var(--rd-lime)', tint: 'rgba(200,255,77,.14)' },
};
const mealStyle = (t: string | null) => MEAL_STYLE[t ?? ''] ?? { letter: '•', color: 'var(--rd-text-muted)', tint: 'var(--rd-card-glass)' };
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const todayLabel = () => `TODAY · ${new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}`;

export default function FuelPage() {
  const n = useNutrition();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [view, setView] = useState<'meals' | 'recent'>('meals');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (view === 'recent') n.fetchRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const over = n.remaining < 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await n.logText(text);
  };

  const doClose = async () => {
    setClosing(true);
    const ok = await n.closeDay();
    setClosing(false);
    setCloseConfirm(false);
    toast(ok ? 'Day closed and saved to history' : 'Failed to close day', ok ? 'success' : 'error');
  };

  return (
    <div className="animate-fadeup space-y-5 pb-4">
      <ScreenHeader
        eyebrow={todayLabel()}
        title="Nutrition"
        back
        right={
          <div className="flex items-center gap-2">
            <Pill color={over ? 'var(--rd-ember)' : 'var(--rd-lime)'} tint={over ? 'rgba(255,107,69,.12)' : 'rgba(200,255,77,.12)'}>
              {over ? `${Math.abs(n.remaining)} over` : `${n.remaining} left`}
            </Pill>
            <button onClick={() => setScannerOpen(true)} aria-label="Scan barcode" className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] border" style={{ borderColor: 'rgba(200,255,77,.24)', background: 'rgba(200,255,77,.08)', color: 'var(--rd-lime)' }}>
              <BarcodeIcon size={20} />
            </button>
          </div>
        }
      />

      {/* Counter */}
      <section className="rd-card p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-num text-[46px] font-bold leading-[.9] tracking-tight text-[var(--rd-ink)]">{n.kcal.toLocaleString()}</span>
          <span className="font-label text-[13px] text-[var(--rd-text-faint)]">/ {n.kcalTarget.toLocaleString()} kcal</span>
        </div>
        <div className="mt-4"><MacroBar proteinG={n.proteinG} carbsG={n.carbsG} fatG={n.fatG} /></div>
      </section>

      <WeeklyDeficit deficit={n.weekDeficit} kg={n.weekKg} bars={n.weekBars} goalPerWeek={-0.5} />

      {/* Meals / Recent */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex overflow-hidden rounded-full border border-[var(--rd-border)]">
            {(['meals', 'recent'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className="font-label px-3 py-1.5 text-[11px] font-semibold capitalize" style={{ background: view === v ? 'var(--rd-lime)' : 'transparent', color: view === v ? '#0A0C10' : 'var(--rd-text-muted)' }}>
                {v === 'meals' ? "Today's meals" : 'Recent'}
              </button>
            ))}
          </div>
          <Link href="/v2/fuel/history" className="font-label text-[11px] font-semibold text-[var(--rd-lime)]">History</Link>
        </div>

        {view === 'meals' ? (
          n.loading ? (
            <div className="space-y-2.5">{[0, 1, 2].map((i) => <div key={i} className="rd-card h-[64px] animate-pulse-soft" />)}</div>
          ) : n.meals.length === 0 ? (
            <div className="rd-card p-6 text-center">
              <p className="text-[13px] text-[var(--rd-text-muted)]">No meals logged yet.</p>
              <p className="mt-1 text-[12px] text-[var(--rd-text-faint)]">Type what you ate, or scan a barcode.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {n.meals.map((m) => (
                <MealRow
                  key={m.id}
                  meal={m}
                  editing={editingId === m.id}
                  onEdit={() => setEditingId(m.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={async (patch) => { await n.editMeal(m.id, patch); setEditingId(null); }}
                  onDelete={async () => { await n.deleteMeal(m.id); setEditingId(null); toast('Meal deleted', 'success'); }}
                />
              ))}
            </div>
          )
        ) : (
          <RecentList
            items={n.recentItems}
            loading={n.recentLoading}
            onLog={async (it) => { const ok = await n.logRecent(it); toast(ok ? `Logged ${it.name}` : 'Failed to log item', ok ? 'success' : 'error'); }}
          />
        )}
      </section>

      {/* Close day */}
      {n.closed ? (
        <div className="flex items-center justify-center gap-2 rounded-[13px] border py-3 text-[13px] font-semibold" style={{ borderColor: 'rgba(200,255,77,.28)', background: 'rgba(200,255,77,.06)', color: 'var(--rd-lime)' }}>
          <CheckIcon size={15} /> Day closed — saved to history
        </div>
      ) : n.meals.length > 0 ? (
        <button onClick={() => setCloseConfirm(true)} className="w-full rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[14px] font-semibold text-[var(--rd-text-secondary)]">
          Close Day &amp; save to history
        </button>
      ) : null}

      {/* Quick-log bar */}
      <form onSubmit={submit} className="sticky bottom-2 flex items-center gap-2 rounded-full border border-[var(--rd-border)] bg-[var(--rd-card)] p-1.5 pl-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={n.logging ? 'Logging…' : '"a handful of almonds…"'} disabled={n.logging} className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none" />
        <button type="submit" disabled={n.logging || !input.trim()} aria-label="Log meal" className="grad-lime flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0A0C10] disabled:opacity-50">
          <PlusIcon size={18} />
        </button>
      </form>

      {/* Overlays */}
      {scannerOpen && <BarcodeScanner onLogged={() => n.refetch()} onClose={() => setScannerOpen(false)} />}
      {closeConfirm && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setCloseConfirm(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
          <div className="relative w-full rounded-t-[24px] border-t border-[var(--rd-border)] p-5 pb-8" style={{ background: '#0F1117' }} onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[18px] font-bold text-[var(--rd-ink)]">Close Day?</p>
            <p className="mt-1.5 text-[13px] text-[var(--rd-text-muted)]">You won&apos;t be able to edit today&apos;s meals after closing.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setCloseConfirm(false)} className="flex-1 rounded-[13px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-3 text-[14px] font-semibold text-[var(--rd-text-secondary)]">Cancel</button>
              <button onClick={doClose} disabled={closing} className="grad-lime flex-1 rounded-[13px] py-3 text-[14px] font-semibold text-[#0A0C10] disabled:opacity-60">{closing ? 'Saving…' : 'Close & save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MealRow({ meal, editing, onEdit, onCancel, onSave, onDelete }: {
  meal: MealItem;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: { rawInput: string; mealType: string | null; calories: number; proteinG: number; carbsG: number; fatG: number }) => void;
  onDelete: () => void;
}) {
  const s = mealStyle(meal.mealType);
  const [name, setName] = useState(meal.name);
  const [type, setType] = useState<string | null>(meal.mealType);
  const [cal, setCal] = useState(String(meal.calories));
  const [pro, setPro] = useState(String(meal.proteinG));
  const [carbs, setCarbs] = useState(String(meal.carbsG));
  const [fat, setFat] = useState(String(meal.fatG));
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const num = 'font-num w-full rounded-[9px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-2 py-2 text-center text-[14px] text-[var(--rd-ink)] focus:outline-none';

  if (!editing) {
    return (
      <div className="rd-card flex items-center gap-3 p-3.5">
        <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: s.tint, color: s.color }}>{s.letter}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[var(--rd-ink)]">{meal.name}</p>
          <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">P{meal.proteinG} · C{meal.carbsG} · F{meal.fatG}</p>
        </div>
        <span className="font-num text-[17px] font-bold text-[var(--rd-ink)]">{meal.calories}</span>
        <button onClick={onEdit} aria-label="Edit" className="text-[var(--rd-text-muted)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 1 0 5.6L7 19.6 3 20.6l1-4L11.7 8.9a4 4 0 0 1 3-2.6zM17 4l3 3" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="rd-card space-y-3 p-3.5">
      <input value={name} onChange={(e) => setName(e.target.value)} className="font-body w-full rounded-[9px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3 py-2 text-[14px] text-[var(--rd-ink)] focus:outline-none" />
      <div className="flex gap-1.5">
        {MEAL_TYPES.map((t) => (
          <button key={t} onClick={() => setType(type === t ? null : t)} className="font-label flex-1 rounded-[9px] border py-1.5 text-[10px] font-semibold capitalize" style={{ borderColor: type === t ? 'var(--rd-lime)' : 'var(--rd-border)', background: type === t ? 'rgba(200,255,77,.1)' : 'transparent', color: type === t ? 'var(--rd-lime)' : 'var(--rd-text-muted)' }}>{t[0]}</button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[['Cal', cal, setCal], ['P', pro, setPro], ['C', carbs, setCarbs], ['F', fat, setFat]].map(([lbl, val, set]) => (
          <div key={lbl as string}>
            <p className="font-label mb-1 text-center text-[9px] text-[var(--rd-text-faint)]">{lbl as string}</p>
            <input value={val as string} inputMode="decimal" onChange={(e) => (set as (v: string) => void)(e.target.value)} className={num} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {confirmDel ? (
          <button onClick={onDelete} className="flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold" style={{ borderColor: 'rgba(255,107,69,.4)', color: 'var(--rd-ember)' }}>Confirm delete</button>
        ) : (
          <button onClick={() => setConfirmDel(true)} aria-label="Delete" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--rd-border)] text-[var(--rd-ember)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
          </button>
        )}
        <button onClick={onCancel} className="flex-1 rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] py-2 text-[13px] font-semibold text-[var(--rd-text-secondary)]">Cancel</button>
        <button
          onClick={async () => { setSaving(true); await onSave({ rawInput: name, mealType: type, calories: +cal || 0, proteinG: +pro || 0, carbsG: +carbs || 0, fatG: +fat || 0 }); setSaving(false); }}
          disabled={saving}
          className="grad-lime flex-1 rounded-[10px] py-2 text-[13px] font-semibold text-[#0A0C10] disabled:opacity-60"
        >{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

function RecentList({ items, loading, onLog }: { items: RecentNutritionItem[]; loading: boolean; onLog: (it: RecentNutritionItem) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (loading) return <div className="space-y-2.5">{[0, 1, 2].map((i) => <div key={i} className="rd-card h-[58px] animate-pulse-soft" />)}</div>;
  if (items.length === 0) return <div className="rd-card p-6 text-center text-[13px] text-[var(--rd-text-muted)]">No recent items yet.</div>;
  const qtyLabel = (it: RecentNutritionItem) => {
    if (/g|ml/i.test(it.unit) && it.quantity) return ` (${it.quantity}${it.unit})`;
    if (it.quantity && it.quantity !== 1) return ` (${it.quantity}×)`;
    return '';
  };
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.key} className="rd-card flex items-center gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold capitalize text-[var(--rd-ink)]">
              {it.name}<span className="font-label text-[11px] font-normal text-[var(--rd-text-faint)]">{qtyLabel(it)}</span>
              {it.useCount > 1 && <span className="font-label ml-1.5 text-[10px] text-[var(--rd-lime)]">·{it.useCount}×</span>}
            </p>
            <p className="font-label mt-0.5 text-[11px] text-[var(--rd-text-faint)]">{Math.round(it.calories ?? 0)} cal · P{Math.round(it.proteinG ?? 0)} C{Math.round(it.carbsG ?? 0)} F{Math.round(it.fatG ?? 0)}</p>
          </div>
          <button onClick={async () => { setBusy(it.key); await onLog(it); setBusy(null); }} aria-label="Log" className="grad-lime flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0A0C10]">
            {busy === it.key ? <SpinIcon size={15} className="animate-spinslow" /> : <PlusIcon size={16} />}
          </button>
        </div>
      ))}
    </div>
  );
}

function WeeklyDeficit({ deficit, kg, bars, goalPerWeek }: {
  deficit: number; kg: number; bars: { label: string; magnitude: number; state: 'today' | 'logged' | 'future' }[]; goalPerWeek: number;
}) {
  const isDeficit = deficit >= 0;
  const netBalance = -deficit;
  const changeKg = -kg;
  const accent = isDeficit ? 'var(--rd-lime)' : 'var(--rd-ember)';
  const max = Math.max(1, ...bars.map((b) => b.magnitude));
  const sign = (v: number, digits = 0) => `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  return (
    <section className="rounded-[20px] border p-4" style={{ borderColor: isDeficit ? 'rgba(200,255,77,.2)' : 'rgba(255,107,69,.22)', background: isDeficit ? 'linear-gradient(135deg,rgba(200,255,77,.1),rgba(200,255,77,.02))' : 'linear-gradient(135deg,rgba(255,107,69,.1),rgba(255,107,69,.02))' }}>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-label text-[10px] tracking-[.1em]" style={{ color: accent }}>THIS WEEK · {isDeficit ? 'DEFICIT' : 'SURPLUS'}</p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-num text-[28px] font-bold leading-[.9] text-[var(--rd-ink)]">{sign(netBalance)}</span>
            <span className="font-label text-[12px] text-[var(--rd-text-faint)]">kcal</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[15px] font-bold" style={{ color: accent }}>{sign(changeKg, 2)} kg</div>
          <div className="font-label mt-0.5 text-[10px] text-[var(--rd-text-faint)]">goal {sign(goalPerWeek, 1)}/wk</div>
        </div>
      </div>
      <div className="mt-4 flex h-[46px] items-end gap-1.5">
        {bars.map((b, i) => {
          const h = b.state === 'future' ? 30 : Math.max(14, (b.magnitude / max) * 100);
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-[4px]" style={{ height: `${h}%`, background: b.state === 'logged' ? `color-mix(in srgb, ${accent} 55%, transparent)` : b.state === 'today' ? accent : 'rgba(200,255,77,.22)', boxShadow: b.state === 'today' ? '0 0 8px rgba(200,255,77,.5)' : undefined }} />
              </div>
              <span className="font-label text-[9px]" style={{ color: b.state === 'today' ? accent : 'var(--rd-text-disabled)' }}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
