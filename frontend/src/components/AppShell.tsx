"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navPath, setNavPath] = useState(pathname);

  // Reset mobile nav when the route changes (adjust state during render)
  if (pathname !== navPath) {
    setNavPath(pathname);
    setMobileNavOpen(false);
  }

  useEffect(() => {
    if (hydrated && !currentUser) {
      // Preserve where they were headed (e.g. a shared /onboarding?video=… link)
      // so login can send them back there instead of the default landing page.
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
      const next = here && here !== "/login" ? `?next=${encodeURIComponent(here)}` : "";
      router.replace(`/login${next}`);
    }
  }, [hydrated, currentUser, router]);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  if (!hydrated || !currentUser) return null;

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: "var(--shell-bg)" }}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(38% 30% at 4% 96%, rgba(124,92,196,0.32) 0%, rgba(20,11,61,0) 70%), radial-gradient(34% 26% at 98% 2%, rgba(120,96,200,0.28) 0%, rgba(20,11,61,0) 70%)",
        }}
      />

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="relative z-10 flex min-h-screen min-w-0 flex-col lg:ml-[272px]">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden rounded-tl-none bg-white shadow-[inset_1px_1px_0_rgba(255,255,255,0.6)] px-4 py-6 sm:px-6 sm:py-7 lg:rounded-tl-[28px] lg:px-9 lg:py-8 safe-bottom"
        >
          <div className="mx-auto w-full max-w-[1320px] animate-page-enter">
            <PageHeader title={title} subtitle={subtitle} icon={icon} />
            {children}
          </div>
        </main>
      </div>

      <FloatingWidget />
    </div>
  );
}
