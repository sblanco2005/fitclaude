'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, SearchIcon } from '@/components/redesign/icons';
import { readImageCompressed } from '@/lib/image';

export type PickOption = { id?: string; name: string; muscleGroup?: string; confidence?: string };
type LibEx = { id: string; name: string; muscleGroup: string; exerciseType: string };

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

// Unified exercise picker sheet — pick from the library (search) OR photograph a
// machine (Meta vision). Identify results are biased toward `targetMuscle` so a
// bench photographed on glute day surfaces glute-with-bench moves first.
export function ExercisePicker({ label, targetMuscle, onPick, onClose }: {
  label: string;
  targetMuscle?: string;
  onPick: (o: PickOption) => Promise<void> | void;
  onClose: () => void;
}) {
  const [lib, setLib] = useState<LibEx[]>([]);
  const [libLoading, setLibLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState<{ equipment: string; options: PickOption[] } | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const list = await fetch('/api/exercises').then((r) => (r.ok ? r.json() : [])).catch(() => []);
      setLib(Array.isArray(list) ? list : []);
      setLibLoading(false);
    })();
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setIdentifying(true); setIdError(null); setIdentified(null);
    try {
      const img = await readImageCompressed(f);
      const res = await fetch('/api/exercises/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: img.base64, image_media_type: img.mediaType, target_muscle: targetMuscle || null }),
      });
      const data = res.ok ? await res.json() : { error: 'Identify failed' };
      const opts: PickOption[] = (data.matches ?? []).map((m: { id: string; name: string; muscleGroup: string; confidence: string }) => ({ id: m.id, name: m.name, muscleGroup: m.muscleGroup, confidence: m.confidence }));
      const primary = (data.primary_exercise || '').trim();
      if (primary && !opts.some((o) => o.name.toLowerCase() === primary.toLowerCase())) {
        opts.unshift({ name: primary, muscleGroup: data.muscle_group || undefined });
      }
      if (!opts.length) { setIdError(data.error || 'Couldn’t identify the machine. Try a clearer photo of it or its name plate.'); return; }
      setIdentified({ equipment: data.raw_identification || 'this machine', options: opts });
    } catch {
      setIdError('Couldn’t read the photo. Try again.');
    } finally {
      setIdentifying(false);
    }
  };

  const pick = async (o: PickOption) => {
    if (applying) return;
    setApplying(true);
    try { await onPick(o); } finally { setApplying(false); }
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? lib.filter((x) => x.name.toLowerCase().includes(q) || x.muscleGroup.includes(q)) : lib;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(4,5,8,.6)', backdropFilter: 'blur(2px)' }} />
      <div className="relative flex max-h-[84%] w-full flex-col overflow-hidden rounded-t-[24px] border-t border-[var(--rd-border)] pb-6" style={{ background: '#0F1117' }} onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pb-1 pt-5">
          <div className="min-w-0">
            <p className="font-label text-[10px] tracking-[.14em] text-[var(--rd-text-faint)]">SWAP</p>
            <h3 className="font-display mt-0.5 truncate text-[18px] font-bold text-[var(--rd-ink)]">{label}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] text-[var(--rd-text-secondary)]"><CloseIcon size={16} /></button>
        </div>

        {/* Search + camera */}
        <div className="flex items-center gap-2 px-5 pb-3 pt-3">
          <div className="flex flex-1 items-center gap-2 rounded-[12px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] px-3.5 py-2.5">
            <SearchIcon size={17} className="text-[var(--rd-text-faint)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises…" className="font-body min-w-0 flex-1 bg-transparent text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none" />
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={identifying} aria-label="Photo a machine" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border disabled:opacity-60" style={{ borderColor: 'rgba(34,211,238,.35)', background: 'rgba(34,211,238,.12)', color: '#22D3EE' }}>
            {identifying ? <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg> : <CameraIcon size={18} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        </div>

        <div className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-5">
          {idError && <p className="rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: 'rgba(255,107,69,.4)', background: 'rgba(255,107,69,.1)', color: 'var(--rd-ember)' }}>{idError}</p>}
          {identified && (
            <div className="mb-1.5 rounded-[12px] border p-2.5" style={{ borderColor: 'rgba(34,211,238,.3)', background: 'rgba(34,211,238,.06)' }}>
              <p className="font-label px-1 pb-1.5 text-[9px] tracking-[.14em]" style={{ color: '#22D3EE' }}>SPOTTED · {identified.equipment.toUpperCase()}</p>
              <div className="space-y-1.5">
                {identified.options.map((o, i) => (
                  <button key={i} onClick={() => pick(o)} disabled={applying} className="flex w-full items-center justify-between rounded-[10px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-2.5 text-left disabled:opacity-50">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--rd-ink)]">{o.name}</span>
                      {o.muscleGroup && <span className="font-label text-[11px] capitalize text-[var(--rd-text-faint)]">{o.muscleGroup}</span>}
                    </span>
                    {o.id ? <span className="font-label ml-2 shrink-0 text-[9px] tracking-[.1em] text-[var(--rd-text-faint)]">{(o.confidence || '').toUpperCase()}</span> : <span className="font-label ml-2 shrink-0 rounded-[6px] px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(34,211,238,.15)', color: '#22D3EE' }}>NEW</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {libLoading ? (
            <p className="py-8 text-center text-[13px] text-[var(--rd-text-faint)]">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--rd-text-faint)]">No matches.</p>
          ) : (
            filtered.map((x) => (
              <button key={x.id} onClick={() => pick({ id: x.id, name: x.name, muscleGroup: x.muscleGroup })} disabled={applying} className="flex w-full items-center justify-between rounded-[11px] border border-[var(--rd-border)] bg-[var(--rd-card)] px-3.5 py-3 text-left active:bg-[var(--rd-card-glass-hover)] disabled:opacity-50">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[var(--rd-ink)]">{x.name}</span>
                  <span className="font-label block text-[11px] capitalize text-[var(--rd-text-faint)]">{x.muscleGroup} · {x.exerciseType}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
