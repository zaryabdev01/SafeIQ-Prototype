"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { FloatingWidget } from "@/components/widget/FloatingWidget";

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { currentUser, hydrated } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !currentUser) router.replace("/login");
  }, [hydrated, currentUser, router]);

  if (!hydrated || !currentUser) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <FloatingWidget />
    </div>
  );
}
