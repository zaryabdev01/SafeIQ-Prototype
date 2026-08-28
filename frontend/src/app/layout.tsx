import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";

// Production design system font (SafeIQ Figma, 2026-08). Variable font, so no
// explicit weights needed; exposed as a CSS variable that globals.css feeds into
// --font-sans.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "SafeIQ - AI Agent & RAG Platform",
  description: "SafeIQ prototype: floating AI agent with isolated, organisation-managed RAG systems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${plusJakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
