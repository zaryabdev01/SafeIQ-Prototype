"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { PageHeader } from "@/components/PageHeader";
import { FloatingWidget } from "@/components/widget/FloatingWidget";
import type { LucideIcon } from "lucide-react";

export function AppShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const { currentUser, hydrated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !currentUser) {
      // Preserve where they were headed (e.g. a shared /onboarding?video=… link)
      // so login can send them back there instead of the default landing page.
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
      const next = here && here !== "/login" ? `?next=${encodeURIComponent(here)}` : "";
      router.replace(`/login${next}`);
    }
  }, [hydrated, currentUser, router]);

  if (!hydrated || !currentUser) return null;

  return (
    <div className="relative flex min-h-screen overflow-hidden" style={{ backgroundColor: "var(--shell-bg)" }}>
      {/* faint depth glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(38% 30% at 4% 96%, rgba(124,92,196,0.32) 0%, rgba(20,11,61,0) 70%), radial-gradient(34% 26% at 98% 2%, rgba(120,96,200,0.28) 0%, rgba(20,11,61,0) 70%)",
        }}
      />

      <Sidebar />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto rounded-tl-[28px] bg-white px-6 py-7 sm:px-8">
          <div className="mx-auto w-full max-w-[1320px]">
            <PageHeader title={title} subtitle={subtitle} icon={icon} />
            {children}
          </div>
        </main>
      </div>

      <FloatingWidget />
    </div>
  );
}
