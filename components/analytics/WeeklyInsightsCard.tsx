'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { WeeklyInsights } from '@/types';

export function WeeklyInsightsCard() {
  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/analytics/insights');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setInsights(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">AI Weekly Insights</h3>
      </div>

      {!insights && !loading && !error && (
        <div className="text-center py-4">
          <p className="text-xs text-muted mb-3">
            Get AI-powered analysis of your recent training patterns, plateau detection, and recovery recommendations.
          </p>
          <Button onClick={generate} className="mx-auto">
            Generate Insights
          </Button>
        </div>
      )}

      {loading && (
        <div className="space-y-2 py-2">
          <div className="h-3 bg-slate-800 rounded animate-pulse w-full" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-5/6" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-full mt-4" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4" />
          <div className="text-[10px] text-muted text-center mt-3">Analyzing your training data...</div>
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-xs text-red-400 mb-3">Failed to generate insights</p>
          <Button onClick={generate} className="mx-auto">
            Try Again
          </Button>
        </div>
      )}

      {insights && (
        <div>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {insights.insights.split('\n').map((line, i) => {
              // Bold text between ** markers
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <div key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>
                  {parts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return (
                        <span key={j} className="font-semibold text-white">
                          {part.slice(2, -2)}
                        </span>
                      );
                    }
                    return <span key={j}>{part}</span>;
                  })}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-dark">
            <span className="text-[10px] text-slate-600">
              Generated {new Date(insights.generatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <button
              onClick={generate}
              className="text-[10px] text-primary hover:text-white transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
