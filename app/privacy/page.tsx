import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — FitClaude',
  description: 'FitClaude privacy policy: how we handle your data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0b1120] text-slate-300 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mb-8">Last updated: March 22, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
            <p>
              FitClaude is an AI-powered fitness assistant operated by <strong className="text-white">Santiago Blanco</strong>.
              This policy explains what data we collect, how we use it, and your rights regarding that data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data We Collect</h2>

            <h3 className="text-sm font-semibold text-slate-200 mt-3 mb-1">Authentication (Google OAuth)</h3>
            <p>
              When you sign in with Google, we receive your <strong className="text-white">name</strong>,{' '}
              <strong className="text-white">email address</strong>, and <strong className="text-white">profile picture</strong>.
              These are used solely for authentication and displaying your profile within the app.
              We do not access your Google contacts, calendar, or any other Google services.
            </p>

            <h3 className="text-sm font-semibold text-slate-200 mt-3 mb-1">Fitness Data</h3>
            <p>
              Workout logs, exercise history, routine configurations, strength training records,
              and activity sessions you create within FitClaude.
            </p>

            <h3 className="text-sm font-semibold text-slate-200 mt-3 mb-1">Nutrition Data</h3>
            <p>
              Food logs, calorie and macronutrient tracking, meal entries, and daily nutrition summaries
              you record through the app or via the AI coach.
            </p>

            <h3 className="text-sm font-semibold text-slate-200 mt-3 mb-1">Profile & Preferences</h3>
            <p>
              Fitness goals, experience level, training frequency, gym type, available equipment,
              injury notes, and nutrition targets you provide during onboarding or in settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Authenticate you and maintain your session</li>
              <li>Generate personalized workout routines based on your profile</li>
              <li>Track nutrition and provide macro breakdowns</li>
              <li>Display training analytics and progress over time</li>
              <li>Improve AI coaching responses based on your fitness context</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data Storage & Security</h2>
            <p>
              All data is stored in a <strong className="text-white">PostgreSQL database</strong> hosted
              on a secured VPS (Hostinger). Database connections use SSL encryption.
              We follow industry-standard security practices to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-white">Google OAuth</strong> — authentication only</li>
              <li><strong className="text-white">Vercel</strong> — frontend hosting</li>
              <li><strong className="text-white">Hostinger VPS</strong> — backend and database hosting</li>
              <li><strong className="text-white">Anthropic (Claude API)</strong> — AI-powered coaching (your messages are processed to generate responses; we do not store conversation data beyond your session history)</li>
              <li><strong className="text-white">Open Food Facts</strong> — barcode nutrition lookups (no personal data is sent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data Sharing</h2>
            <p>
              We <strong className="text-white">do not sell, rent, or share</strong> your personal data
              with any third parties for marketing or advertising purposes. Data is only shared with
              the third-party services listed above to the extent necessary to provide the app&apos;s functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Data Deletion</h2>
            <p>
              You may request deletion of all your data at any time by contacting us.
              Upon request, we will permanently remove your account and all associated data
              from our systems within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p>
              For questions about this privacy policy or to request data deletion, contact:
            </p>
            <p className="mt-1">
              <a href="mailto:sblanco2005@gmail.com" className="text-emerald-400 hover:text-emerald-300 underline">
                sblanco2005@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 text-center">
          <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to FitClaude
          </a>
        </div>
      </div>
    </main>
  );
}
