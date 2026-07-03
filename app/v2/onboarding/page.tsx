'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon, CheckIcon } from '@/components/redesign/icons';

// Screen 07 · Onboarding — accent: ember
type Choice = { value: string; title: string; sub: string };

const GOALS: Choice[] = [
  { value: 'muscle_gain', title: 'Build muscle', sub: 'Add size and strength' },
  { value: 'fat_loss', title: 'Lose fat', sub: 'Lean out, keep strength' },
  { value: 'maintenance', title: 'Stay healthy', sub: 'Feel good, stay consistent' },
  { value: 'recomp', title: 'Recomp', sub: 'Build muscle, lose fat' },
];
const EXPERIENCE: Choice[] = [
  { value: 'beginner', title: 'Beginner', sub: 'New to training' },
  { value: 'intermediate', title: 'Intermediate', sub: '6+ months consistent' },
  { value: 'advanced', title: 'Advanced', sub: 'Years under the bar' },
];
const GYMS: Choice[] = [
  { value: 'home', title: 'Home gym', sub: 'Limited equipment' },
  { value: 'public', title: 'Public gym', sub: 'Full equipment' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [frequency, setFrequency] = useState(4);
  const [gym, setGym] = useState('');
  const [equipment, setEquipment] = useState('');
  const [injuries, setInjuries] = useState('');
  const [saving, setSaving] = useState(false);

  const steps = useMemo(() => {
    const base = ['goal', 'experience', 'frequency', 'gym'];
    if (gym === 'home') base.push('equipment');
    base.push('injuries');
    return base;
  }, [gym]);

  const key = steps[step];
  const total = steps.length;
  const canNext =
    (key === 'goal' && goal) ||
    (key === 'experience' && experience) ||
    key === 'frequency' ||
    (key === 'gym' && gym) ||
    key === 'equipment' ||
    key === 'injuries';

  const finish = async () => {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fitnessGoal: goal || undefined,
          experienceLevel: experience || undefined,
          trainingFrequency: frequency,
          gymType: gym || undefined,
          equipmentText: gym === 'home' ? equipment || undefined : undefined,
          injuriesNotes: injuries || undefined,
        }),
      });
    } finally {
      setSaving(false);
      router.push('/v2');
    }
  };

  const advance = () => (step === total - 1 ? finish() : setStep((s) => s + 1));
  const back = () => (step === 0 ? router.push('/v2') : setStep((s) => s - 1));

  return (
    <div className="animate-fadeup flex min-h-full flex-col">
      {/* Progress */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex flex-1 gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: i <= step ? 'var(--rd-ember)' : 'var(--rd-border)' }}
            />
          ))}
        </div>
        <span className="font-label text-[11px] text-[var(--rd-text-faint)]">
          {step + 1}/{total}
        </span>
      </div>

      <div className="flex-1 pt-8">
        {key === 'goal' && (
          <Question eyebrow="YOUR GOAL" title="What are you training for?">
            <Cards options={GOALS} value={goal} onChange={setGoal} />
          </Question>
        )}
        {key === 'experience' && (
          <Question eyebrow="EXPERIENCE" title="How long have you trained?">
            <Cards options={EXPERIENCE} value={experience} onChange={setExperience} />
          </Question>
        )}
        {key === 'frequency' && (
          <Question eyebrow="FREQUENCY" title="How many days per week?">
            <div className="mt-2 grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setFrequency(n)}
                  className="font-num rounded-[14px] border py-4 text-[20px] font-bold transition-colors"
                  style={{
                    borderColor: frequency === n ? 'transparent' : 'var(--rd-border)',
                    background: frequency === n ? 'var(--rd-ember)' : 'var(--rd-card-glass)',
                    color: frequency === n ? '#0A0C10' : 'var(--rd-text-muted)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </Question>
        )}
        {key === 'gym' && (
          <Question eyebrow="WHERE YOU TRAIN" title="Home or public gym?">
            <Cards options={GYMS} value={gym} onChange={setGym} />
          </Question>
        )}
        {key === 'equipment' && (
          <Question eyebrow="EQUIPMENT" title="What do you have?">
            <textarea
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              rows={4}
              placeholder="e.g. adjustable dumbbells, pull-up bar, bands…"
              className="font-body mt-2 w-full resize-none rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] p-4 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
            />
          </Question>
        )}
        {key === 'injuries' && (
          <Question eyebrow="LIMITATIONS" title="Any injuries to avoid?">
            <textarea
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              rows={4}
              placeholder="Optional — e.g. left knee, lower back…"
              className="font-body mt-2 w-full resize-none rounded-[14px] border border-[var(--rd-border)] bg-[var(--rd-card-glass)] p-4 text-[14px] text-[var(--rd-ink)] placeholder:text-[var(--rd-text-faint)] focus:outline-none"
            />
          </Question>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center gap-3 pb-2 pt-4">
        <button
          onClick={back}
          className="flex h-12 w-12 items-center justify-center rounded-[13px] border border-[var(--rd-border)] text-[var(--rd-text-muted)]"
          aria-label="Back"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <button
          onClick={advance}
          disabled={!canNext || saving}
          className="grad-ember relative flex h-12 flex-1 items-center justify-center overflow-hidden rounded-[13px] text-[15px] font-semibold text-[#0A0C10] disabled:opacity-50"
          style={{ boxShadow: 'var(--rd-glow-ember)' }}
        >
          <span className="relative z-10">{step === total - 1 ? (saving ? 'Saving…' : 'Finish') : 'Continue'}</span>
          <span aria-hidden className="animate-sheen absolute inset-y-0 -left-1/3 z-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }} />
        </button>
      </div>
    </div>
  );
}

function Question({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-label text-[10px] tracking-[.16em] text-[var(--rd-ember)]">{eyebrow}</p>
      <h1 className="font-display mt-2 text-[26px] font-bold leading-[1.1] text-[var(--rd-ink)]">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Cards({ options, value, onChange }: { options: Choice[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex w-full items-center justify-between rounded-[16px] border p-4 text-left transition-colors"
            style={{
              borderColor: active ? 'var(--rd-ember)' : 'var(--rd-border)',
              background: active ? 'rgba(255,107,69,.08)' : 'var(--rd-card-glass)',
            }}
          >
            <div>
              <p className="text-[15px] font-semibold text-[var(--rd-ink)]">{o.title}</p>
              <p className="mt-0.5 text-[12px] text-[var(--rd-text-faint)]">{o.sub}</p>
            </div>
            {active && (
              <span className="grad-ember flex h-6 w-6 items-center justify-center rounded-full text-[#0A0C10]">
                <CheckIcon size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
