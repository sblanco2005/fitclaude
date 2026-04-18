'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useFitClaude } from '@/context/FitClaudeContext';
import { BarcodeScanner } from '@/components/nutrition/BarcodeScanner';
import type { DailyNutrition, DailyNutritionSummary, NutritionLog, RecentNutritionItem } from '@/types';

/** Strip XML parameter tags that Claude sometimes injects into raw_text */
function cleanRawInput(text: string): string {
  return text
    .replace(/["']?\s*>\s*<parameter\s+name="[^"]*">[^<]*(<\/parameter>)?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/["']\s*$/, '')
    .trim();
}

// ─── Calorie Ring ───────────────────────────────────────────────────────────

function CalorieRing({ current, target, animate }: {
  current: number;
  target: number;
  animate: boolean;
}) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (animate ? pct : 0));
  const over = current > target;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        {/* Track */}
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(30,41,59,0.6)" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={over ? 'var(--warning)' : 'var(--primary)'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white tabular-nums leading-none">
          {Math.round(current)}
        </span>
        <span className="text-xs text-muted mt-0.5">/ {target} cal</span>
      </div>
    </div>
  );
}

// ─── Macro Pill ─────────────────────────────────────────────────────────────

function MacroPill({ label, current, target, color, animate }: {
  label: string;
  current: number;
  target: number;
  color: string;
  animate: boolean;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-xs font-bold ${color}`}>{label}</span>
        <span className="text-xs text-muted tabular-nums">{Math.round(current)}/{target}g</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color.replace('text-', 'bg-')}`}
          style={{ width: `${animate ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

// ─── MealRow ────────────────────────────────────────────────────────────────

const mealIcons: Record<string, string> = {
  breakfast: '\u2600\uFE0F',
  lunch: '\u{1F32E}',
  dinner: '\u{1F37D}\uFE0F',
  snack: '\u{1F36A}',
};

function MealRow({
  log,
  onUpdate,
  onDelete,
  index,
}: {
  log: NutritionLog;
  onUpdate: () => void;
  onDelete: () => void;
  index: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [rawInput, setRawInput] = useState(log.rawInput);
  const [mealType, setMealType] = useState(log.mealType ?? '');
  const [calories, setCalories] = useState(String(log.calories ?? ''));
  const [proteinG, setProteinG] = useState(String(log.proteinG ?? ''));
  const [carbsG, setCarbsG] = useState(String(log.carbsG ?? ''));
  const [fatG, setFatG] = useState(String(log.fatG ?? ''));

  const inputRef = useRef<HTMLInputElement>(null);
  const startEdit = () => {
    setRawInput(log.rawInput);
    setMealType(log.mealType ?? '');
    setCalories(String(log.calories ?? ''));
    setProteinG(String(log.proteinG ?? ''));
    setCarbsG(String(log.carbsG ?? ''));
    setFatG(String(log.fatG ?? ''));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditing(false);
    setConfirmDelete(false);
  };

  const submitEdit = async () => {
    setSaving(true);
    try {
      await fetch(`/api/nutrition/log/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput,
          mealType: mealType || null,
          calories: calories ? parseFloat(calories) : null,
          proteinG: proteinG ? parseFloat(proteinG) : null,
          carbsG: carbsG ? parseFloat(carbsG) : null,
          fatG: fatG ? parseFloat(fatG) : null,
        }),
      });
      setEditing(false);
      onUpdate();
    } catch {
      // keep editing open on error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/nutrition/log/${log.id}`, { method: 'DELETE' });
      onDelete();
    } catch {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="py-3 border-b border-slate-800 last:border-0 space-y-2.5">
        <input
          ref={inputRef}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="What did you eat?"
        />
        <div className="flex gap-1.5">
          {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMealType(mealType === type ? '' : type)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                mealType === type
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-slate-800 text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-muted uppercase tracking-widest font-bold">Cal</label>
            <input value={calories} onChange={(e) => setCalories(e.target.value)} type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-blue-400 uppercase tracking-widest font-bold">Protein</label>
            <input value={proteinG} onChange={(e) => setProteinG(e.target.value)} type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-amber-400 uppercase tracking-widest font-bold">Carbs</label>
            <input value={carbsG} onChange={(e) => setCarbsG(e.target.value)} type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-red-400 uppercase tracking-widest font-bold">Fat</label>
            <input value={fatG} onChange={(e) => setFatG(e.target.value)} type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={submitEdit} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={cancelEdit}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider">
            Cancel
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400 text-xs font-bold transition-colors"
              aria-label="Delete meal">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider disabled:opacity-50">
              Confirm Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 py-2.5 border-b border-slate-800/50 last:border-0 animate-in fade-in slide-in-from-bottom-1"
      style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
    >
      {/* Meal type icon */}
      {log.mealType && (
        <span className="text-sm shrink-0 w-5 text-center" aria-hidden>
          {mealIcons[log.mealType] || ''}
        </span>
      )}
      {/* Food name — truncated */}
      <p className="text-sm text-white flex-1 min-w-0 truncate">
        {cleanRawInput(log.rawInput)}
      </p>
      {/* All 4 macros inline */}
      <div className="flex items-center gap-1.5 shrink-0 text-xs tabular-nums">
        <span className="text-primary font-medium">{Math.round(log.calories || 0)}</span>
        <span className="text-slate-700">|</span>
        <span className="text-blue-400">{Math.round(log.proteinG || 0)}</span>
        <span className="text-slate-700">|</span>
        <span className="text-amber-400">{Math.round(log.carbsG || 0)}</span>
        <span className="text-slate-700">|</span>
        <span className="text-red-400">{Math.round(log.fatG || 0)}</span>
      </div>
      {/* Edit */}
      <button
        onClick={startEdit}
        className="p-1.5 -mr-1 text-slate-700 hover:text-slate-400 active:text-primary transition-colors shrink-0"
        aria-label="Edit meal"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}

// ─── HistoryDayCard ─────────────────────────────────────────────────────────

function HistoryDayCard({
  summary,
  formatDate,
  onCopied,
  onDeleted,
  timezone,
}: {
  summary: DailyNutritionSummary;
  formatDate: (d: string) => string;
  onCopied: () => void;
  onDeleted: () => void;
  timezone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [meals, setMeals] = useState<NutritionLog[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopyOptions, setShowCopyOptions] = useState(false);

  const dateKey = summary.date.split('T')[0];

  const toggleExpand = async () => {
    if (!expanded && meals.length === 0) {
      setLoadingMeals(true);
      try {
        const res = await fetch(`/api/nutrition/history?date=${dateKey}&tz=${encodeURIComponent(timezone)}`);
        if (res.ok) setMeals(await res.json());
      } catch { /* ignore */ }
      setLoadingMeals(false);
    }
    setExpanded((v) => !v);
  };

  const handleCopy = async (mode: 'append' | 'replace') => {
    setCopying(true);
    setShowCopyOptions(false);
    try {
      const res = await fetch('/api/nutrition/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey, timezone, mode }),
      });
      if (res.ok) {
        setCopied(true);
        onCopied();
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* ignore */ }
    setCopying(false);
  };

  const handleDelete = async () => {
    try {
      const res = await fetch('/api/nutrition/summaries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: summary.id }),
      });
      if (res.ok) onDeleted();
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-xl bg-slate-800/30 border border-slate-800/50 p-3">
      <button onClick={toggleExpand} className="w-full flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-300">{formatDate(summary.date)}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{summary.mealCount} meal{summary.mealCount !== 1 ? 's' : ''}</span>
          <svg className={`w-3.5 h-3.5 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="text-primary font-semibold">{Math.round(summary.calories)} cal</span>
        <span className="text-blue-400">{Math.round(summary.proteinG)}p</span>
        <span className="text-amber-400">{Math.round(summary.carbsG)}c</span>
        <span className="text-red-400">{Math.round(summary.fatG)}f</span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          {loadingMeals ? (
            <div className="text-xs text-muted text-center py-2">Loading meals...</div>
          ) : meals.length === 0 ? (
            <div className="text-xs text-muted text-center py-2">No individual meals found</div>
          ) : (
            <div className="space-y-1.5 mb-3">
              {meals.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400 truncate flex-1 min-w-0">{cleanRawInput(m.rawInput)}</p>
                  <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {Math.round(m.calories || 0)} · {Math.round(m.proteinG || 0)}p
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {copied ? (
              <div className="flex-1 py-2 rounded-lg text-xs font-medium text-center bg-green-600/20 text-green-400">
                Copied to Today!
              </div>
            ) : copying ? (
              <div className="flex-1 py-2 rounded-lg text-xs font-medium text-center bg-primary/15 text-primary opacity-50">
                Copying...
              </div>
            ) : !showCopyOptions ? (
              <button onClick={() => setShowCopyOptions(true)}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
                Copy All to Today
              </button>
            ) : (
              <>
                <button onClick={() => handleCopy('append')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors">
                  Add to Today
                </button>
                <button onClick={() => handleCopy('replace')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors">
                  Replace Today
                </button>
              </>
            )}
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-500 hover:bg-red-500/15 hover:text-red-400 transition-colors">
                Delete
              </button>
            ) : (
              <button onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                Confirm?
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Week grouping helpers ──────────────────────────────────────────────────

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekRange(dateStr: string): string {
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

interface WeekData {
  key: string;
  label: string;
  summaries: DailyNutritionSummary[];
  avgCalories: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  totalDays: number;
}

function groupByWeek(summaries: DailyNutritionSummary[]): WeekData[] {
  const groups: Record<string, DailyNutritionSummary[]> = {};
  for (const s of summaries) {
    const wk = getWeekKey(s.date);
    if (!groups[wk]) groups[wk] = [];
    groups[wk].push(s);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, days]) => {
      const n = days.length;
      return {
        key,
        label: getWeekRange(days[0].date),
        summaries: days,
        avgCalories: days.reduce((s, d) => s + d.calories, 0) / n,
        avgProteinG: days.reduce((s, d) => s + d.proteinG, 0) / n,
        avgCarbsG: days.reduce((s, d) => s + d.carbsG, 0) / n,
        avgFatG: days.reduce((s, d) => s + d.fatG, 0) / n,
        totalDays: n,
      };
    });
}

function WeekGroup({
  week,
  formatDate,
  timezone,
  onCopied,
  onDeleted,
}: {
  week: WeekData;
  formatDate: (d: string) => string;
  timezone: string;
  onCopied: () => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {/* Week header — bolder, distinct from day cards */}
      <button onClick={() => setExpanded((v) => !v)} className="w-full">
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-base font-bold text-white tracking-tight">{week.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">{week.totalDays} day{week.totalDays !== 1 ? 's' : ''}</span>
              <svg className={`w-4 h-4 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums">
            <div>
              <span className="text-primary font-bold text-sm">{Math.round(week.avgCalories)}</span>
              <span className="text-slate-600 ml-1">avg cal</span>
            </div>
            <div>
              <span className="text-blue-400 font-semibold">{Math.round(week.avgProteinG)}g</span>
              <span className="text-slate-600 ml-0.5">p</span>
            </div>
            <div>
              <span className="text-amber-400 font-semibold">{Math.round(week.avgCarbsG)}g</span>
              <span className="text-slate-600 ml-0.5">c</span>
            </div>
            <div>
              <span className="text-red-400 font-semibold">{Math.round(week.avgFatG)}g</span>
              <span className="text-slate-600 ml-0.5">f</span>
            </div>
          </div>
        </Card>
      </button>

      {expanded && (
        <div className="ml-3 mt-2 space-y-2 border-l-2 border-slate-800 pl-3">
          {week.summaries.map((s) => (
            <HistoryDayCard
              key={s.id}
              summary={s}
              formatDate={formatDate}
              timezone={timezone}
              onCopied={onCopied}
              onDeleted={() => onDeleted(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

type Tab = 'today' | 'history';
type MealView = 'meals' | 'recent';

interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export default function NutritionPage() {
  const { dataVersion } = useFitClaude();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('today');
  const [mealView, setMealView] = useState<MealView>('meals');
  const [recentItems, setRecentItems] = useState<RecentNutritionItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [loggingItem, setLoggingItem] = useState<string | null>(null);
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [summaries, setSummaries] = useState<DailyNutritionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 });
  const [mounted, setMounted] = useState(false);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Trigger mount animation after first render
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Fetch user profile targets
  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.ok ? res.json() : null)
      .then((p) => {
        if (!p) return;
        const cal = p.dailyCalorieTarget ?? 2000;
        const protG = p.dailyProteinTarget ?? 150;
        const protCal = protG * 4;
        const remaining = Math.max(cal - protCal, 0);
        const carbsPct = p.carbsPercent ?? 50;
        const fatPct = p.fatPercent ?? 50;
        setTargets({
          calories: cal,
          proteinG: protG,
          carbsG: Math.round((remaining * (carbsPct / 100)) / 4),
          fatG: Math.round((remaining * (fatPct / 100)) / 9),
        });
      })
      .catch(() => {});
  }, []);

  const fetchToday = useCallback(() => {
    fetch(`/api/nutrition/today?tz=${encodeURIComponent(userTz)}`)
      .then((res) => res.json())
      .then((data) => {
        setToday(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userTz]);

  const fetchRecentItems = useCallback(() => {
    setRecentLoading(true);
    fetch('/api/nutrition/recent-items?days=14&limit=50')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setRecentItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setRecentItems([]))
      .finally(() => setRecentLoading(false));
  }, []);

  const handleQuickLog = useCallback(async (item: RecentNutritionItem) => {
    if (loggingItem) return;
    setLoggingItem(item.key);
    try {
      const res = await fetch('/api/nutrition/log-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories ?? 0,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
        }),
      });
      if (res.ok) {
        toast(`Logged ${item.name}`);
        fetchToday();
      } else {
        toast('Failed to log item', 'error');
      }
    } catch {
      toast('Failed to log item', 'error');
    } finally {
      setLoggingItem(null);
    }
  }, [fetchToday, loggingItem, toast]);

  useEffect(() => {
    fetch('/api/nutrition/auto-close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: userTz }),
    })
      .then(() => fetchToday())
      .catch(() => fetchToday());
  }, [fetchToday, userTz]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday, dataVersion]);

  useEffect(() => {
    const checkAutoClose = () => {
      const now = new Date();
      if (now.getHours() >= 23) {
        const closedKey = `nutrition-closed-${now.toDateString()}`;
        if (!localStorage.getItem(closedKey)) {
          localStorage.setItem(closedKey, 'true');
          fetch('/api/nutrition/close-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).then(() => {
            setHistoryLoaded(false);
          }).catch(() => {});
        }
      }
    };
    checkAutoClose();
    const interval = setInterval(checkAutoClose, 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = useCallback(async () => {
    if (historyLoaded) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/nutrition/summaries?daysBack=90');
      if (res.ok) {
        const data = await res.json();
        setSummaries(data);
        setHistoryLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch nutrition history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyLoaded]);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab, fetchHistory]);

  useEffect(() => {
    if (tab === 'today' && mealView === 'recent') fetchRecentItems();
  }, [tab, mealView, fetchRecentItems, dataVersion]);

  const [closeDayConfirm, setCloseDayConfirm] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleCloseDay = async () => {
    setCloseDayConfirm(false);
    setClosing(true);
    try {
      const res = await fetch('/api/nutrition/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: userTz }),
      });
      if (res.ok) {
        setHistoryLoaded(false);
        fetchToday();
        setTab('history');
        toast('Day closed and saved to history');
      }
    } catch (err) {
      console.error('Failed to close day:', err);
      toast('Failed to close day', 'error');
    } finally {
      setClosing(false);
    }
  };

  const totals = today?.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

  const formatDate = (dateStr: string) => {
    const dStr = dateStr.split('T')[0];
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: userTz });
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterdayStr = yestDate.toLocaleDateString('en-CA', { timeZone: userTz });

    if (dStr === todayStr) return 'Today';
    if (dStr === yesterdayStr) return 'Yesterday';
    const d = new Date(dStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="h-6 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-48 bg-slate-800/60 rounded-xl animate-pulse" />
        <div className="h-32 bg-slate-800/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header with barcode scanner */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Nutrition</h2>
        <button
          onClick={() => setScannerOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/15 text-primary hover:bg-primary/25 active:scale-95 transition-all"
          aria-label="Scan barcode"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
            <line x1="7" y1="7" x2="7" y2="17" strokeWidth={2} />
            <line x1="10" y1="7" x2="10" y2="17" strokeWidth={1} />
            <line x1="12" y1="7" x2="12" y2="17" strokeWidth={2} />
            <line x1="14.5" y1="7" x2="14.5" y2="17" strokeWidth={1} />
            <line x1="17" y1="7" x2="17" y2="17" strokeWidth={2.5} />
          </svg>
        </button>
      </div>

      {scannerOpen && (
        <BarcodeScanner onLogged={fetchToday} onClose={() => setScannerOpen(false)} />
      )}

      {/* Tab toggle — larger, more prominent (#5) */}
      <div className="flex bg-slate-800/40 rounded-xl p-1 border border-slate-800/60">
        {(['today', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all capitalize ${
              tab === t
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <>
          {/* Calorie Ring Hero + Macro Pills (#1, #2, #7) */}
          <Card className="!p-5">
            <CalorieRing current={totals.calories} target={targets.calories} animate={mounted} />
            <div className="flex gap-3 mt-5">
              <MacroPill label="Protein" current={totals.proteinG} target={targets.proteinG} color="text-blue-400" animate={mounted} />
              <MacroPill label="Carbs" current={totals.carbsG} target={targets.carbsG} color="text-amber-400" animate={mounted} />
              <MacroPill label="Fat" current={totals.fatG} target={targets.fatG} color="text-red-400" animate={mounted} />
            </div>
          </Card>

          {/* Meal Log — lighter card, secondary feel (#2, #3, #4) */}
          <div className="rounded-xl bg-slate-800/20 border border-slate-800/40 p-4">
            <div className="flex items-center gap-1 mb-3">
              {(['meals', 'recent'] as MealView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setMealView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                    mealView === v
                      ? 'bg-primary/20 text-primary'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {v === 'meals' ? 'Meals' : 'Recent'}
                </button>
              ))}
              {mealView === 'meals' && today?.logs && today.logs.length > 0 && (
                <span className="ml-auto text-xs text-slate-600 tabular-nums">
                  cal | p | c | f
                </span>
              )}
            </div>

            {mealView === 'meals' ? (
              (!today?.logs || today.logs.length === 0) ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-500">No meals logged yet</p>
                </div>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto -mr-2 pr-2">
                  {today.logs.map((log: NutritionLog, i: number) => (
                    <MealRow
                      key={log.id}
                      log={log}
                      onUpdate={fetchToday}
                      onDelete={fetchToday}
                      index={i}
                    />
                  ))}
                </div>
              )
            ) : recentLoading ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500">Loading recent items…</p>
              </div>
            ) : recentItems.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500">No recent items yet.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Log meals through the coach and they&apos;ll appear here for one-tap reuse.
                </p>
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto -mr-1 pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {recentItems.map((item) => {
                  const isLogging = loggingItem === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleQuickLog(item)}
                      disabled={isLogging}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate capitalize">
                          {item.name}
                          {(() => {
                            const unit = item.unit || '';
                            const gramMatch = /^(\d+(?:\.\d+)?)\s*g$/i.test(unit);
                            if (gramMatch) return <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">({unit})</span>;
                            if (item.quantity && item.quantity !== 1) return <span className="ml-1.5 text-xs font-normal text-slate-400 normal-case">({item.quantity}{unit && unit !== 'serving' ? ` ${unit}` : 'x'})</span>;
                            return null;
                          })()}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {item.calories != null ? `${Math.round(item.calories)} kcal` : '—'}
                          {item.proteinG != null && <span className="ml-2 text-blue-400">{Math.round(item.proteinG)}P</span>}
                          {item.carbsG != null && <span className="ml-1.5 text-amber-400">{Math.round(item.carbsG)}C</span>}
                          {item.fatG != null && <span className="ml-1.5 text-red-400">{Math.round(item.fatG)}F</span>}
                          {item.useCount > 1 && <span className="ml-2 text-slate-600">·{item.useCount}x</span>}
                        </div>
                      </div>
                      <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-primary/15 text-primary">
                        {isLogging ? (
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                            <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Close Day */}
          {today?.closed ? (
            <div className="w-full py-3 px-4 bg-green-500/10 border border-green-500/30 text-green-400 font-medium rounded-xl text-sm text-center">
              Day closed — saved to history
            </div>
          ) : today?.logs && today.logs.length > 0 ? (
            <button
              onClick={() => setCloseDayConfirm(true)}
              disabled={closing}
              className="w-full py-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium rounded-xl transition-colors text-sm"
            >
              {closing ? 'Saving...' : 'Close Day & Save to History'}
            </button>
          ) : null}
        </>
      )}

      {/* Close Day confirmation */}
      {closeDayConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-20">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCloseDayConfirm(false)} />
          <div className="relative w-full max-w-sm glass rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            <div className="p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Close Day?</h3>
              <p className="text-sm text-slate-400 mb-5">
                This saves today&apos;s nutrition to history. You won&apos;t be able to edit these meals after closing.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setCloseDayConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm active:scale-95 transition-transform">
                  Cancel
                </button>
                <button onClick={handleCloseDay}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary/20 text-primary font-medium text-sm active:scale-95 transition-transform">
                  Close & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted">Loading history...</div>
            </div>
          ) : summaries.length === 0 ? (
            <Card>
              <p className="text-muted text-sm text-center py-4">
                No daily logs saved yet. Close your day to save a summary here.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupByWeek(summaries).map((week) => (
                <WeekGroup
                  key={week.key}
                  week={week}
                  formatDate={formatDate}
                  timezone={userTz}
                  onCopied={() => {
                    fetchToday();
                    setTab('today');
                  }}
                  onDeleted={(id) => setSummaries((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
