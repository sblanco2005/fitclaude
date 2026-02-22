'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { DailyNutrition, DailyNutritionSummary, NutritionLog } from '@/types';

function ProgressBar({ current, target, label, color }: {
  current: number;
  target: number;
  label: string;
  color: string;
}) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-muted">{Math.round(current)} / {target}</span>
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
  const [calories, setCalories] = useState(String(log.calories ?? ''));
  const [proteinG, setProteinG] = useState(String(log.proteinG ?? ''));
  const [carbsG, setCarbsG] = useState(String(log.carbsG ?? ''));
  const [fatG, setFatG] = useState(String(log.fatG ?? ''));

  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setRawInput(log.rawInput);
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
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="What did you eat?"
        />

        {/* Macros grid */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-[9px] text-muted uppercase tracking-widest font-bold">Cal</label>
            <input
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[9px] text-blue-400 uppercase tracking-widest font-bold">Protein</label>
            <input
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[9px] text-amber-400 uppercase tracking-widest font-bold">Carbs</label>
            <input
              value={carbsG}
              onChange={(e) => setCarbsG(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[9px] text-red-400 uppercase tracking-widest font-bold">Fat</label>
            <input
              value={fatG}
              onChange={(e) => setFatG(e.target.value)}
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={submitEdit}
            disabled={saving}
            className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={cancelEdit}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-widest"
          >
            Cancel
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400 text-[10px] font-bold transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
            >
              Delete?
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-800 last:border-0 group">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{log.rawInput}</p>
        {log.mealType && (
          <span className="text-xs text-muted capitalize">{log.mealType}</span>
        )}
      </div>
      <div className="flex items-start gap-2 shrink-0 ml-3">
        <div className="text-right text-xs text-muted whitespace-nowrap">
          {log.calories != null && <div>{Math.round(log.calories)} kcal</div>}
          {log.proteinG != null && <div>{Math.round(log.proteinG)}g protein</div>}
        </div>
        <button
          onClick={startEdit}
          className="p-1 text-slate-700 hover:text-slate-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── HistoryDayCard ──────────────────────────────────────────────────────────

function HistoryDayCard({
  summary,
  formatDate,
  onCopied,
  onDeleted,
}: {
  summary: DailyNutritionSummary;
  formatDate: (d: string) => string;
  onCopied: () => void;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [meals, setMeals] = useState<NutritionLog[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [copying, setCopying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const dateKey = summary.date.split('T')[0]; // "2025-02-20"

  const toggleExpand = async () => {
    if (!expanded && meals.length === 0) {
      setLoadingMeals(true);
      try {
        const res = await fetch(`/api/nutrition/history?date=${dateKey}`);
        if (res.ok) setMeals(await res.json());
      } catch { /* ignore */ }
      setLoadingMeals(false);
    }
    setExpanded((v) => !v);
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      const res = await fetch('/api/nutrition/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey }),
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
          <div className="text-[10px] text-muted">kcal</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-blue-400">{Math.round(summary.proteinG)}g</div>
          <div className="text-[10px] text-muted">protein</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-amber-400">{Math.round(summary.carbsG)}g</div>
          <div className="text-[10px] text-muted">carbs</div>
        </div>
        <div>
          <div className="text-sm font-semibold text-red-400">{Math.round(summary.fatG)}g</div>
          <div className="text-[10px] text-muted">fat</div>
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
                    <p className="text-xs text-white truncate">{m.rawInput}</p>
                    {m.mealType && (
                      <span className="text-[10px] text-slate-500 capitalize">{m.mealType}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted whitespace-nowrap">
                    {Math.round(m.calories || 0)} cal · {Math.round(m.proteinG || 0)}p
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={copying || copied}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                copied
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-primary/15 text-primary hover:bg-primary/25'
              }`}
            >
              {copied ? 'Copied to Today!' : copying ? 'Copying...' : 'Copy All to Today'}
            </button>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'today' | 'history';

export default function NutritionPage() {
  const { dataVersion } = useFitClaude();
  const [tab, setTab] = useState<Tab>('today');
  const [today, setToday] = useState<DailyNutrition | null>(null);
  const [summaries, setSummaries] = useState<DailyNutritionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  const handleCloseDay = async () => {
    setClosing(true);
    try {
      const res = await fetch('/api/nutrition/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setHistoryLoaded(false);
        setTab('history');
      }
    } catch (err) {
      console.error('Failed to close day:', err);
    } finally {
      setClosing(false);
    }
  };

  const totals = today?.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted">Loading nutrition...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Nutrition</h2>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['today', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
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
              <ProgressBar current={totals.calories} target={2400} label="Calories" color="bg-primary" />
              <ProgressBar current={totals.proteinG} target={180} label="Protein (g)" color="bg-blue-500" />
              <ProgressBar current={totals.carbsG} target={300} label="Carbs (g)" color="bg-amber-500" />
              <ProgressBar current={totals.fatG} target={80} label="Fat (g)" color="bg-red-500" />
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
              <div>
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

          {/* Close Day button */}
          {today?.logs && today.logs.length > 0 && (
            <button
              onClick={handleCloseDay}
              disabled={closing}
              className="w-full py-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium rounded-xl transition-colors text-sm"
            >
              {closing ? 'Saving...' : 'Close Day & Save to History'}
            </button>
          )}
        </>
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
              {summaries.map((s) => (
                <HistoryDayCard
                  key={s.id}
                  summary={s}
                  formatDate={formatDate}
                  onCopied={() => {
                    fetchToday();
                    setTab('today');
                  }}
                  onDeleted={() => setSummaries((prev) => prev.filter((x) => x.id !== s.id))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
