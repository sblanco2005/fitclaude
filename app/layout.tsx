import type { Metadata, Viewport } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { FitClaudeProvider } from "@/context/FitClaudeContext";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-code",
});

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "FitClaude",
  description: "AI-powered fitness coach by Anthropic Claude",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FitClaude",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${roboto.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <FitClaudeProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </FitClaudeProvider>
        </SessionProvider>
        {/* Server-rendered for Google bot visibility — hidden behind bottom nav in app */}
        <noscript>
          <div style={{ textAlign: 'center', padding: '8px' }}>
            <a href="/privacy" style={{ color: '#64748b', fontSize: '10px' }}>Privacy Policy</a>
          </div>
        </noscript>
        <div className="sr-only" aria-hidden="true">
          <a href="/privacy">Privacy Policy</a>
        </div>
      </body>
    </html>
  );
}
