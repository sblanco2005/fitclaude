'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OnboardingData {
  sex: string;
  fitnessGoal: string;
  experienceLevel: string;
  trainingFrequency: string;
  gymType: string;
  equipmentText: string;
  injuriesNotes: string;
}

const INITIAL_DATA: OnboardingData = {
  sex: '',
  fitnessGoal: '',
  experienceLevel: '',
  trainingFrequency: '',
  gymType: '',
  equipmentText: '',
  injuriesNotes: '',
};

interface StepProps {
  data: OnboardingData;
  onChange: (field: keyof OnboardingData, value: string) => void;
}

// ─── Step config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'About You',        subtitle: 'Tell us a bit about yourself' },
  { id: 2, title: 'Your Goal',         subtitle: 'What are you training for?' },
  { id: 3, title: 'Your Experience',   subtitle: 'How long have you been training?' },
  { id: 4, title: 'Training Schedule', subtitle: 'How often do you train?' },
  { id: 5, title: 'Your Setup',        subtitle: 'Where do you work out?' },
  { id: 6, title: 'Health Notes',      subtitle: 'Injuries or limitations (optional)' },
];
const TOTAL_STEPS = STEPS.length;

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: number, data: OnboardingData): string | null {
  switch (step) {
    case 1: {
      if (!data.sex) return 'Please select your sex.';
      return null;
    }
    case 2:
      if (!data.fitnessGoal) return 'Please select a goal.';
      return null;
    case 3:
      if (!data.experienceLevel) return 'Please select your experience level.';
      return null;
    case 4: {
      const freq = parseInt(data.trainingFrequency);
      if (!data.trainingFrequency || isNaN(freq) || freq < 1 || freq > 7)
        return 'Please select how many days per week you train.';
      return null;
    }
    case 5:
      if (!data.gymType) return 'Please select your gym type.';
      if (data.gymType === 'own_gym' && !data.equipmentText.trim())
        return 'Please describe your available equipment.';
      return null;
    case 6:
      return null;
    default:
      return null;
  }
}

// ─── Shared UI components ────────────────────────────────────────────────────

function ProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const pct = Math.round((currentStep / totalSteps) * 100);
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs text-muted">
        <span>Step {currentStep} of {totalSteps}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SelectionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
        selected
          ? 'bg-primary text-white shadow-lg'
          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Step components ─────────────────────────────────────────────────────────

function StepOne({ data, onChange }: StepProps) {
  const sexOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Sex</label>
        <div className="grid grid-cols-2 gap-2">
          {sexOptions.map((opt) => (
            <SelectionButton
              key={opt.value}
              selected={data.sex === opt.value}
              onClick={() => onChange('sex', opt.value)}
            >
              {opt.label}
            </SelectionButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepTwo({ data, onChange }: StepProps) {
  const goals = [
    { value: 'lose_fat',     label: 'Fat Loss',     desc: 'Burn fat, get lean' },
    { value: 'build_muscle', label: 'Muscle Gain',  desc: 'Build size and strength' },
    { value: 'maintain',     label: 'Maintenance',  desc: 'Stay where I am' },
    { value: 'recomp',       label: 'Recomp',       desc: 'Build muscle and lose fat simultaneously' },
  ];

  return (
    <div className="space-y-2">
      {goals.map((opt) => (
        <SelectionButton
          key={opt.value}
          selected={data.fitnessGoal === opt.value}
          onClick={() => onChange('fitnessGoal', opt.value)}
        >
          <span className="font-semibold">{opt.label}</span>
          <span className="block text-xs mt-0.5 opacity-70">{opt.desc}</span>
        </SelectionButton>
      ))}
    </div>
  );
}

function StepThree({ data, onChange }: StepProps) {
  const levels = [
    { value: 'beginner',     label: 'Beginner',     desc: 'Less than 1 year of consistent training' },
    { value: 'intermediate', label: 'Intermediate', desc: '1–3 years of training' },
    { value: 'advanced',     label: 'Advanced',     desc: '3+ years of consistent training' },
  ];

  return (
    <div className="space-y-2">
      {levels.map((opt) => (
        <SelectionButton
          key={opt.value}
          selected={data.experienceLevel === opt.value}
          onClick={() => onChange('experienceLevel', opt.value)}
        >
          <span className="font-semibold">{opt.label}</span>
          <span className="block text-xs mt-0.5 opacity-70">{opt.desc}</span>
        </SelectionButton>
      ))}
    </div>
  );
}

function StepFour({ data, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Days per week
        </label>
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => onChange('trainingFrequency', String(day))}
              className={`aspect-square rounded-lg text-sm font-bold transition-all ${
                data.trainingFrequency === String(day)
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        {data.trainingFrequency && (
          <p className="mt-3 text-center text-sm text-muted">
            {data.trainingFrequency} day{data.trainingFrequency !== '1' ? 's' : ''} per week
          </p>
        )}
      </div>
    </div>
  );
}

function StepFive({ data, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <SelectionButton
          selected={data.gymType === 'own_gym'}
          onClick={() => onChange('gymType', 'own_gym')}
        >
          Home Gym
        </SelectionButton>
        <SelectionButton
          selected={data.gymType === 'public_gym'}
          onClick={() => onChange('gymType', 'public_gym')}
        >
          Public Gym
        </SelectionButton>
      </div>
      {data.gymType === 'own_gym' && (
        <TextArea
          label="Available Equipment"
          placeholder={'Barbell + plates (up to 300lb)\nDumbbells 5–50lb\nPull-up bar\nAdjustable bench'}
          rows={5}
          value={data.equipmentText}
          onChange={(e) => onChange('equipmentText', e.target.value)}
        />
      )}
      {data.gymType === 'public_gym' && (
        <p className="text-sm text-muted text-center py-2">
          Your coach will assume full gym access — barbells, cables, machines, and more.
        </p>
      )}
    </div>
  );
}

function StepSix({ data, onChange }: StepProps) {
  return (
    <div className="space-y-4">
      <TextArea
        label="Injuries & Limitations (optional)"
        placeholder={'Lower back pain — avoid heavy deadlifts\nLeft knee — no deep squats\nShoulder impingement'}
        rows={5}
        value={data.injuriesNotes}
        onChange={(e) => onChange('injuriesNotes', e.target.value)}
      />
      <p className="text-xs text-muted">
        This helps your AI coach recommend safe exercise modifications. You can update this any time in Settings.
      </p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof OnboardingData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleNext = () => {
    const validationError = validateStep(step, data);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        sex: data.sex,
        fitnessGoal: data.fitnessGoal,
        experienceLevel: data.experienceLevel,
        trainingFrequency: parseInt(data.trainingFrequency),
        gymType: data.gymType,
        equipmentText: data.gymType === 'own_gym' ? data.equipmentText : null,
        injuriesNotes: data.injuriesNotes || null,
        isOnboarded: true,
      };

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save profile');

      // Refresh session so isOnboarded = true before navigation
      // (middleware reads the session — without this it would redirect back)
      await update();
      router.replace('/');
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const currentStep = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Fit<span className="text-primary">Claude</span>
          </h1>
          <p className="mt-1 text-muted text-sm">{"Let's set up your profile"}</p>
        </div>

        {/* Progress */}
        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

        {/* Step card */}
        <Card>
          <div className="space-y-1 mb-6">
            <h2 className="text-lg font-bold text-white">{currentStep.title}</h2>
            <p className="text-sm text-muted">{currentStep.subtitle}</p>
          </div>

          <div className="space-y-4">
            {step === 1 && <StepOne data={data} onChange={updateField} />}
            {step === 2 && <StepTwo data={data} onChange={updateField} />}
            {step === 3 && <StepThree data={data} onChange={updateField} />}
            {step === 4 && <StepFour data={data} onChange={updateField} />}
            {step === 5 && <StepFive data={data} onChange={updateField} />}
            {step === 6 && <StepSix data={data} onChange={updateField} />}
          </div>

          {error && (
            <p className="mt-4 text-sm text-danger">{error}</p>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="ghost" onClick={handleBack} className="flex-1">
              Back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} className="flex-1">
              Continue
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={submitting} className="flex-1">
              {submitting ? 'Saving...' : 'Start Training'}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
