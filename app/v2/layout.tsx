import type { Metadata } from 'next';
import { Space_Grotesk, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { RedesignShell } from '@/components/redesign/RedesignShell';

// Redesign v1 type system — scoped to this independent app only.
const display = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--rd-display' });
const body = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--rd-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--rd-mono' });

export const metadata: Metadata = {
  title: 'FitClaude — Redesign v1',
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} ${mono.variable} redesign-root`}>
      <RedesignShell>{children}</RedesignShell>
    </div>
  );
}
