import type { Metadata } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import { FitClaudeProvider } from "@/context/FitClaudeContext";
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

export const metadata: Metadata = {
  title: "FitClaude",
  description: "AI-powered fitness coach by Anthropic Claude",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <FitClaudeProvider>
            <AppShell>{children}</AppShell>
          </FitClaudeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
