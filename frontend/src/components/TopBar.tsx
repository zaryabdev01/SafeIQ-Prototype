"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { timeAgo } from "@/lib/format";
import { severityTone, Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Slim top strip that sits on the dark app background above the white content
 * panel (production Figma, M3). Right-aligned controls only — the page title now
 * lives inside the panel via <PageHeader>. `title`/`subtitle` are kept in the
 * signature for AppShell compatibility but rendered by PageHeader, not here.
 */
export function TopBar() {
  const router = useRouter();
  const { currentUser, organisations, dashboardAlerts, markAlertRead, logout } = useApp();
  const [open, setOpen] = useState(false);

  const alerts = isOrgLevel(currentUser) ? dashboardAlerts : [];
  const unread = alerts.filter((a) => !a.read).length;

  const org = organisations.find((o) => o.id === currentUser?.orgId);
  const accountLabel =
    currentUser?.role === "internal" ? "Internal account" : isOrgLevel(currentUser) ? "Organization account" : "Employee account";
  const orgName = currentUser?.role === "internal" ? "SafeIQ Internal" : org?.name ?? "SafeIQ";

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-3 px-6">
      {isOrgLevel(currentUser) && (
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative flex size-10 items-center justify-center rounded-[12px] bg-brand-soft text-[var(--brand-dark)] transition-colors hover:bg-brand-soft/80"
            aria-label="Alerts"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold leading-none text-white">
                {unread}
              </span>
            )}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-fade-in">
                <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">Alerts</div>
                <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
                  {alerts.slice(0, 8).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => markAlertRead(a.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${!a.read ? "bg-[var(--brand-tint)]/40" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{a.title}</p>
                        <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.detail}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(a.createdAt)}</p>
                    </button>
                  ))}
                  {alerts.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No alerts yet.</p>}
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-center text-xs font-medium text-brand hover:bg-slate-50"
                >
                  View dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={handleLogout}
        className="flex size-10 items-center justify-center rounded-[12px] bg-brand-soft text-[var(--brand-dark)] transition-colors hover:bg-brand-soft/80"
        aria-label="Log out"
      >
        <LogOut size={18} />
      </button>

      {currentUser && (
        <div className="flex items-center gap-3">
          <Avatar name={currentUser.name} color={currentUser.avatarColor} size={40} className="rounded-[11px]" />
          <div className="leading-tight">
            <p className="text-[14px] font-medium text-white">{orgName}</p>
            <p className="text-[11px] text-white/70">{accountLabel}</p>
          </div>
        </div>
      )}
    </header>
  );
}
