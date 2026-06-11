'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import type { UserProfile } from '@/types';

const fitnessGoals = [
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'flexibility', label: 'Flexibility' },
];

const experienceLevels = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

interface InviteRow { id: string; email: string; joined: boolean }

function InviteUsers() {
  const { toast } = useToast();
  const [emails, setEmails] = useState<InviteRow[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/allowed-emails')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEmails(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const add = async () => {
    const email = input.trim().toLowerCase();
    if (!email || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/allowed-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmails((prev) => [{ id: d.id, email: d.email, joined: false }, ...prev.filter((e) => e.email !== d.email)]);
        setInput('');
        toast('Invite added');
      } else {
        toast(d.error || 'Could not add invite', 'error');
      }
    } catch {
      toast('Could not add invite', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (email: string) => {
    try {
      await fetch(`/api/admin/allowed-emails?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      setEmails((prev) => prev.filter((e) => e.email !== email));
    } catch {
      toast('Could not remove invite', 'error');
    }
  };

  return (
    <Card>
      <div className="text-sm font-bold text-white mb-1">Invite users</div>
      <p className="text-xs text-muted mb-3">Only invited emails (and people who already have an account) can sign in.</p>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          type="email"
          placeholder="name@gmail.com"
          className="flex-1 bg-card border border-border-dark rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary"
        />
        <Button onClick={add} disabled={busy || !input.trim()} size="sm">Invite</Button>
      </div>
      <div className="space-y-0.5">
        {emails.length === 0 && <p className="text-xs text-slate-500">No invites yet.</p>}
        {emails.map((e) => (
          <div key={e.id} className="flex items-center justify-between py-1 text-sm">
            <span className="text-slate-300 truncate">
              {e.email}
              {e.joined && <span className="ml-2 text-[10px] font-bold text-primary uppercase">joined</span>}
            </span>
            <button onClick={() => remove(e.email)} className="text-slate-600 hover:text-red-400 text-xs ml-2 shrink-0">
              Remove
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateField = (field: string, value: unknown) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      toast('Profile saved');
    } catch {
      toast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="h-7 w-48 bg-slate-800 rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/60 rounded-xl h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Profile & Settings</h2>

      {/* Profile */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Profile</h3>
        <div className="space-y-3">
          <Input
            label="Name"
            value={profile.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-300">Fitness Goal</label>
            <select
              value={profile.fitnessGoal || ''}
              onChange={(e) => updateField('fitnessGoal', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a goal</option>
              {fitnessGoals.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-300">Experience Level</label>
            <select
              value={profile.experienceLevel || ''}
              onChange={(e) => updateField('experienceLevel', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select level</option>
              {experienceLevels.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-300">Timezone</label>
            <select
              value={profile.timezone || 'UTC'}
              onChange={(e) => updateField('timezone', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-base text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[
                ['Pacific/Honolulu', 'Hawaii (HST −10)'],
                ['America/Anchorage', 'Alaska (AKST −9)'],
                ['America/Los_Angeles', 'Pacific (PST −8)'],
                ['America/Denver', 'Mountain (MST −7)'],
                ['America/Mexico_City', 'Mexico City (CST −6)'],
                ['America/Chicago', 'Central (CST −6)'],
                ['America/New_York', 'Eastern (EST −5)'],
                ['America/Bogota', 'Bogotá (COT −5)'],
                ['America/Sao_Paulo', 'São Paulo (BRT −3)'],
                ['America/Argentina/Buenos_Aires', 'Buenos Aires (ART −3)'],
                ['Atlantic/Azores', 'Azores (AZOT −1)'],
                ['UTC', 'UTC ±0'],
                ['Europe/London', 'London (GMT ±0)'],
                ['Europe/Paris', 'Central Europe (CET +1)'],
                ['Europe/Helsinki', 'Eastern Europe (EET +2)'],
                ['Africa/Nairobi', 'Nairobi (EAT +3)'],
                ['Asia/Dubai', 'Dubai (GST +4)'],
                ['Asia/Karachi', 'Pakistan (PKT +5)'],
                ['Asia/Kolkata', 'India (IST +5:30)'],
                ['Asia/Bangkok', 'Bangkok (ICT +7)'],
                ['Asia/Singapore', 'Singapore (SGT +8)'],
                ['Asia/Tokyo', 'Tokyo (JST +9)'],
                ['Australia/Sydney', 'Sydney (AEST +10)'],
                ['Pacific/Auckland', 'Auckland (NZST +12)'],
              ].map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {(() => {
            const unit = (profile.weightUnit || 'lb') as 'lb' | 'kg';
            const displayValue = profile.weightKg != null
              ? (unit === 'kg' ? profile.weightKg : +(profile.weightKg * 2.20462).toFixed(1))
              : '';
            return (
              <Input
                label={`Your Weight (${unit})`}
                type="number"
                step="0.1"
                placeholder={unit === 'kg' ? 'e.g. 80' : 'e.g. 175'}
                value={displayValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    updateField('weightKg', null);
                    return;
                  }
                  const n = parseFloat(raw);
                  if (isNaN(n)) return;
                  const kg = unit === 'kg' ? n : +(n / 2.20462).toFixed(2);
                  updateField('weightKg', kg);
                }}
              />
            );
          })()}

        </div>
      </Card>

      {/* Weight Unit */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Weight Unit</h3>
        <div className="flex gap-2">
          <button
            onClick={() => updateField('weightUnit', 'lb')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (profile.weightUnit || 'lb') === 'lb'
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Pounds (lb)
          </button>
          <button
            onClick={() => updateField('weightUnit', 'kg')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              profile.weightUnit === 'kg'
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Kilograms (kg)
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          Sets your default logging unit. You can still toggle per-set while logging.
        </p>
      </Card>

      {/* Gym & Equipment */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Gym & Equipment</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => updateField('gymType', 'own_gym')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                profile.gymType === 'own_gym'
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Home Gym
            </button>
            <button
              onClick={() => updateField('gymType', 'public_gym')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                profile.gymType === 'public_gym'
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Public Gym
            </button>
          </div>

          {profile.gymType === 'own_gym' && (
            <TextArea
              label="Available Equipment"
              placeholder={"Barbell + plates (up to 300lb)\nDumbbells 5-50lb\nPull-up bar\nAdjustable bench\nSquat rack"}
              rows={3}
              value={profile.equipmentText || ''}
              onChange={(e) => updateField('equipmentText', e.target.value)}
            />
          )}
        </div>
      </Card>

      {/* Nutrition Targets */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Nutrition Targets</h3>
        <p className="text-xs text-muted mb-3">Set your daily calories and protein, then split the remaining calories between carbs and fat</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Daily Calories"
              type="number"
              value={profile.dailyCalorieTarget ?? ''}
              onChange={(e) => updateField('dailyCalorieTarget', e.target.value ? parseInt(e.target.value) : null)}
            />
            <Input
              label="Protein (g)"
              type="number"
              step="0.1"
              value={profile.dailyProteinTarget ?? ''}
              onChange={(e) => updateField('dailyProteinTarget', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>

          {/* Macro split for remaining calories */}
          {(() => {
            const cal = profile.dailyCalorieTarget ?? 0;
            const protG = profile.dailyProteinTarget ?? 0;
            const protCal = protG * 4;
            const remaining = Math.max(cal - protCal, 0);
            const carbsPct = profile.carbsPercent ?? 50;
            const fatPct = profile.fatPercent ?? 50;
            const carbsG = Math.round((remaining * (carbsPct / 100)) / 4);
            const fatG = Math.round((remaining * (fatPct / 100)) / 9);

            if (!cal || !protG) return null;

            return (
              <div className="space-y-3">
                <div className="text-xs text-muted">
                  Protein uses <span className="text-blue-400 font-medium">{Math.round(protCal)} kcal</span> ({cal > 0 ? Math.round((protCal / cal) * 100) : 0}%) — <span className="text-slate-300 font-medium">{remaining} kcal</span> remaining for carbs & fat
                </div>

                {/* Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-amber-400 font-medium">Carbs {carbsPct}%</span>
                    <span className="text-red-400 font-medium">Fat {fatPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={carbsPct}
                    onChange={(e) => {
                      const c = parseInt(e.target.value);
                      updateField('carbsPercent', c);
                      updateField('fatPercent', 100 - c);
                    }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-amber-500 to-red-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
                  />
                </div>

                {/* Computed grams */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-800/50 rounded-lg py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-blue-400">{Math.round(protG)}g</div>
                    <div className="text-xs text-muted">protein</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-amber-400">{carbsG}g</div>
                    <div className="text-xs text-muted">carbs</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-red-400">{fatG}g</div>
                    <div className="text-xs text-muted">fat</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </Card>

      {/* Personal Trainer */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">Personal Trainer</h3>
        <p className="text-xs text-slate-500 mb-4">
          FitClaude sends your trainer a weekly training report every Sunday. Leave blank to disable.
        </p>
        <Input
          type="email"
          placeholder="trainer@example.com"
          value={profile.trainerEmail || ''}
          onChange={(e) => updateField('trainerEmail', e.target.value || null)}
        />
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/trainer-email/send-test', { method: 'POST' });
              const data = await res.json();
              if (res.ok) toast(`Test report sent to ${data.sentTo}`);
              else toast(data.error || 'Failed to send', 'error');
            } catch {
              toast('Failed to send test email', 'error');
            }
          }}
          className="mt-3 text-xs text-primary hover:text-white transition-colors underline underline-offset-2"
        >
          Send test report to trainer →
        </button>
      </Card>

      {/* Injuries */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Injuries & Notes</h3>
        <TextArea
          placeholder="Any injuries, limitations, or things your coach should know?"
          rows={4}
          value={profile.injuriesNotes || ''}
          onChange={(e) => updateField('injuriesNotes', e.target.value)}
        />
      </Card>

      {/* Admin link */}
      {profile.isAdmin && (
        <Card>
          <a
            href="/admin"
            className="flex items-center justify-between py-1 text-sm font-bold text-primary hover:text-white transition-colors"
          >
            <span>Admin Review</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </Card>
      )}

      {/* Invite users (admin only) */}
      {profile.isAdmin && <InviteUsers />}


      {/* Save */}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

