'use client';

import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Check if already installed
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if dismissed recently (hide for 7 days)
    const dismissedAt = localStorage.getItem('fitclaude:pwa-dismissed');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true);
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem('fitclaude:pwa-dismissed', String(Date.now()));
  }, []);

  // Don't show if already installed, dismissed, or not applicable
  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-300 mb-[env(safe-area-inset-bottom,0px)]">
      <div className="glass rounded-2xl border border-border-dark shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Install FitClaude</p>
            {isIOS ? (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Tap Safari&apos;s share button{' '}
                <svg className="inline w-4 h-4 -mt-0.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0-12l-3 3m3-3l3 3" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" /></svg>
                {' '}in the toolbar at the bottom of your screen, then tap <strong className="text-white">&quot;Add to Home Screen&quot;</strong>
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">
                Add to your home screen for the full app experience
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium active:scale-95 transition-transform"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
