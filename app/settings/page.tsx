'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
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

export default function SettingsPage() {
  const { data: session } = useSession();
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
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted">Loading profile...</div>
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select level</option>
              {experienceLevels.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Age"
              type="number"
              value={profile.age ?? ''}
              onChange={(e) => updateField('age', e.target.value ? parseInt(e.target.value) : null)}
            />
            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              value={profile.weightKg ?? ''}
              onChange={(e) => updateField('weightKg', e.target.value ? parseFloat(e.target.value) : null)}
            />
            <Input
              label="Height (cm)"
              type="number"
              value={profile.heightCm ?? ''}
              onChange={(e) => updateField('heightCm', e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        </div>
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
              rows={5}
              value={profile.equipmentText || ''}
              onChange={(e) => updateField('equipmentText', e.target.value)}
            />
          )}
        </div>
      </Card>

      {/* Nutrition Targets */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Nutrition Targets</h3>
        <p className="text-xs text-muted mb-3">Your coach uses these to track your nutrition progress</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Daily Calories"
            type="number"
            value={profile.dailyCalorieTarget ?? ''}
            onChange={(e) => updateField('dailyCalorieTarget', e.target.value ? parseInt(e.target.value) : null)}
          />
          <Input
            label="Daily Protein (g)"
            type="number"
            step="0.1"
            value={profile.dailyProteinTarget ?? ''}
            onChange={(e) => updateField('dailyProteinTarget', e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
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
