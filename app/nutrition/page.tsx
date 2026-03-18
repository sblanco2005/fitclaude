'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useFitClaude } from '@/context/FitClaudeContext';
import { BarcodeScanner } from '@/components/nutrition/BarcodeScanner';
import type { DailyNutrition, DailyNutritionSummary, NutritionLog } from '@/types';

/** Strip XML parameter tags that Claude sometimes injects into raw_text */
function cleanRawInput(text: string): string {
  return text
    .replace(/["']?\s*>\s*<parameter\s+name="[^"]*">[^<]*(<\/parameter>)?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/["']\s*$/, '')
    .trim();
}

function ProgressBar({ current, target, label, color }: {
  current: number;
  target: number;
  label: string;
  color: string;
}) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm gap-2">
        <span className="text-slate-300 whitespace-nowrap">{label}</span>
        <span className="text-muted shrink-0">{Math.round(current)} / {target}</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ─── MealRow ──────────────────────────────────────────────────────────────────

function MealRow({
  log,
  onUpdate,
  onDelete,
}: {
  log: NutritionLog;
  onUpdate: () => void;
  onDelete: () => void;
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
        {/* Food description */}
        <input
          ref={inputRef}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="What did you eat?"
        />

        {/* Meal type selector */}
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

        {/* Macros grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-muted uppercase tracking-widest font-bold">Cal</label>
            <input
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-blue-400 uppercase tracking-widest font-bold">Protein</label>
            <input
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-amber-400 uppercase tracking-widest font-bold">Carbs</label>
            <input
              value={carbsG}
              onChange={(e) => setCarbsG(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-red-400 uppercase tracking-widest font-bold">Fat</label>
            <input
              value={fatG}
              onChange={(e) => setFatG(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-base text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={submitEdit}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={cancelEdit}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider"
          >
            Cancel
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400 text-xs font-bold transition-colors"
              aria-label="Delete meal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              Confirm Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-2 min-h-[52px] border-b border-slate-800 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{cleanRawInput(log.rawInput)}</p>
        {log.mealType && (
          <span className="text-xs text-muted capitalize">{log.mealType}</span>
        )}
      </div>
      <div className="text-right text-xs text-muted whitespace-nowrap shrink-0">
        {log.calories != null && <div>{Math.round(log.calories)} kcal</div>}
        {log.proteinG != null && <div>{Math.round(log.proteinG)}g protein</div>}
      </div>
      <button
        onClick={startEdit}
        className="p-2 -mr-1 text-slate-600 hover:text-slate-300 active:text-primary transition-colors shrink-0"
        aria-label="Edit meal"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}

// ─── HistoryDayCard ──────────────────────────────────────────────────────────

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

  const dateKey = summary.date.split('T')[0]; // "2025-02-20"

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
    <Card className="!p-4">
      {/* Header — tap to expand */}
      <button
        onClick={toggleExpand}
        className="w-full flex items-center justify-between mb-3"
      >
        <span className="text-sm font-semibold text-white">
          {formatDate(summary.date)}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            {summary.mealCount} meal{summary.mealCount !== 1 ? 's' : ''}
          </span>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Macro summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-sm font-semibold text-primary">{Math.round(summary.calories)}</div>
          <div className="text-xs text-muted">kcal</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-blue-400">{Math.round(summary.proteinG)}g</div>
          <div className="text-xs text-muted">protein</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-amber-400">{Math.round(summary.carbsG)}g</div>
          <div className="text-xs text-muted">carbs</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-red-400">{Math.round(summary.fatG)}g</div>
          <div className="text-xs text-muted">fat</div>
        </div>
      </div>

      {/* Expanded: individual meals + copy button */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          {loadingMeals ? (
            <div className="text-xs text-muted text-center py-2">Loading meals...</div>
          ) : meals.length === 0 ? (
            <div className="text-xs text-muted text-center py-2">No individual meals found</div>
          ) : (
            <div className="space-y-2 mb-3">
              {meals.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{cleanRawInput(m.rawInput)}</p>
                    {m.mealType && (
                      <span className="text-xs text-slate-500 capitalize">{m.mealType}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap">
                    {Math.round(m.calories || 0)} cal · {Math.round(m.proteinG || 0)}p
                  </div>
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
              <button
                onClick={() => setShowCopyOptions(true)}
                className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
              >
                Copy All to Today
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleCopy('append')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                >
                  Add to Today
                </button>
                <button
                  onClick={() => handleCopy('replace')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                >
                  Replace Today
                </button>
              </>
            )}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            ) : (
              <button
                onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Confirm?
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Week grouping helpers ────────────────────────────────────────────────────

function getWeekKey(dateStr: string): string {
  // Returns "YYYY-WNN" ISO week key from a date string
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00Z');
  // ISO week: Monday is first day
  const dayOfWeek = d.getUTCDay() || 7; // Sun=7, Mon=1
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekRange(dateStr: string): string {
  // Returns "Mon Feb 17 – Sun Feb 23" style label from any date in that week
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
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
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
      {/* Week header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full"
      >
        <Card className="!p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">{week.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{week.totalDays} day{week.totalDays !== 1 ? 's' : ''}</span>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xs font-semibold text-primary">{Math.round(week.avgCalories)}</div>
              <div className="text-xs text-muted">avg kcal</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-400">{Math.round(week.avgProteinG)}g</div>
              <div className="text-xs text-muted">avg prot</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-400">{Math.round(week.avgCarbsG)}g</div>
              <div className="text-xs text-muted">avg carbs</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-red-400">{Math.round(week.avgFatG)}g</div>
              <div className="text-xs text-muted">avg fat</div>
            </div>
          </div>
        </Card>
      </button>

      {/* Expanded: individual day cards */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'today' | 'history';

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
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [summaries, setSummaries] = useState<DailyNutritionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 });

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  // Fetch today's data (timezone-aware)
  const fetchToday = useCallback(() => {
    fetch(`/api/nutrition/today?tz=${encodeURIComponent(userTz)}`)
      .then((res) => res.json())
      .then((data) => {
        setToday(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userTz]);

  // Auto-close stale days from previous dates + fetch today on load
  useEffect(() => {
    // Auto-close any unclosed previous days first, then fetch today
    fetch('/api/nutrition/auto-close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: userTz }),
    })
      .then(() => fetchToday())
      .catch(() => fetchToday());
  }, [fetchToday, userTz]);

  // Re-fetch when chat creates/modifies data
  useEffect(() => {
    fetchToday();
  }, [fetchToday, dataVersion]);

  // Auto-close day at 23:00 (belt-and-suspenders with the auto-close on load)
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

  // Fetch history when tab switches
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
    // Summary dates are stored as "YYYY-MM-DDT00:00:00Z" — extract the date part
    const dStr = dateStr.split('T')[0];
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: userTz });
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterdayStr = yestDate.toLocaleDateString('en-CA', { timeZone: userTz });

    if (dStr === todayStr) return 'Today';
    if (dStr === yesterdayStr) return 'Yesterday';
    const d = new Date(dStr + 'T12:00:00Z'); // noon UTC to avoid DST issues
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="h-6 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-32 bg-slate-800/60 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-800/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Nutrition</h2>
        <button
          onClick={() => setScannerOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/15 text-primary hover:bg-primary/25 active:scale-95 transition-all"
          aria-label="Scan barcode"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            {/* Scanner corners */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
            {/* Barcode lines */}
            <line x1="7" y1="7" x2="7" y2="17" strokeWidth={2} />
            <line x1="10" y1="7" x2="10" y2="17" strokeWidth={1} />
            <line x1="12" y1="7" x2="12" y2="17" strokeWidth={2} />
            <line x1="14.5" y1="7" x2="14.5" y2="17" strokeWidth={1} />
            <line x1="17" y1="7" x2="17" y2="17" strokeWidth={2.5} />
          </svg>
        </button>
      </div>

      {/* Barcode Scanner Overlay */}
      {scannerOpen && (
        <BarcodeScanner
          onLogged={fetchToday}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['today', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2.5 rounded-md text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'bg-primary text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <>
          {/* Daily Totals */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Today&apos;s Macros
            </h3>
            <div className="space-y-3">
              <ProgressBar current={totals.calories} target={targets.calories} label="Calories" color="bg-primary" />
              <ProgressBar current={totals.proteinG} target={targets.proteinG} label="Protein (g)" color="bg-blue-500" />
              <ProgressBar current={totals.carbsG} target={targets.carbsG} label="Carbs (g)" color="bg-amber-500" />
              <ProgressBar current={totals.fatG} target={targets.fatG} label="Fat (g)" color="bg-red-500" />
            </div>
          </Card>

          {/* Meal Log */}
          <Card>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Meals Today
            </h3>
            {(!today?.logs || today.logs.length === 0) ? (
              <p className="text-muted text-sm">
                No meals logged yet. Tell your coach what you ate or snap a photo!
              </p>
            ) : (
              <div className="max-h-[40vh] overflow-y-auto -mr-2 pr-2">
                {today.logs.map((log: NutritionLog) => (
                  <MealRow
                    key={log.id}
                    log={log}
                    onUpdate={fetchToday}
                    onDelete={fetchToday}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Close Day button or closed banner */}
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

      {/* Close Day confirmation bottom-sheet */}
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
                <button
                  onClick={() => setCloseDayConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-700/60 text-slate-300 font-medium text-sm active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseDay}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary/20 text-primary font-medium text-sm active:scale-95 transition-transform"
                >
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
