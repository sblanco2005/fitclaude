'use client';

import React, { useEffect, useRef } from 'react';

// Muted inline autoplay that actually starts on iOS. A plain iframe with
// autoplay=1&mute=1 is silently blocked in the standalone PWA WebView, so we
// drive playback with the YouTube IFrame Player API and call playVideo() (muted)
// on ready — muted playback is allowed without a user gesture.

/* eslint-disable @typescript-eslint/no-explicit-any */
let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve();
  if (!apiReady) {
    apiReady = new Promise<void>((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return apiReady;
}

export function YouTubeAutoplay({ videoId, title }: { videoId: string; title?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    // A manual child node for YT to replace, so React never fights the DOM swap.
    const mount = document.createElement('div');
    mount.style.width = '100%';
    mount.style.height = '100%';
    hostRef.current?.appendChild(mount);

    loadApi().then(() => {
      if (cancelled) return;
      const w = window as any;
      player = new w.YT.Player(mount, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
        events: {
          onReady: (e: any) => { try { e.target.mute(); e.target.playVideo(); } catch { /* noop */ } },
        },
      });
    });

    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch { /* noop */ }
      try { mount.remove(); } catch { /* noop */ }
    };
  }, [videoId]);

  return <div ref={hostRef} className="h-full w-full" title={title} />;
}
