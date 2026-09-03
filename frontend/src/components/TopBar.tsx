"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { timeAgo } from "@/lib/format";
import { severityTone, Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

const ALERTS_PREVIEW_COUNT = 8;

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { currentUser, organisations, dashboardAlerts, markAlertRead, logout } = useApp();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const alerts = isOrgLevel(currentUser) ? dashboardAlerts : [];
  const unread = alerts.filter((a) => !a.read).length;
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, ALERTS_PREVIEW_COUNT);

  const org = organisations.find((o) => o.id === currentUser?.orgId);
  const accountLabel =
    currentUser?.role === "internal" ? "Internal account" : isOrgLevel(currentUser) ? "Organization account" : "Employee account";
  const orgName = currentUser?.role === "internal" ? "SafeIQ Internal" : org?.name ?? "SafeIQ";

  function closeAlerts() {
    setAlertsOpen(false);
    setShowAllAlerts(false);
  }

  function handleLogout() {
    setMenuOpen(false);
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 sm:h-[72px] sm:justify-end sm:gap-4 sm:border-b-0 sm:px-6 backdrop-blur-md bg-[var(--shell-bg)]/80 lg:bg-transparent lg:backdrop-blur-none">
      <button
        type="button"
        onClick={onMenuClick}
        className="flex size-10 items-center justify-center rounded-[var(--r-field)] bg-brand-soft text-[var(--brand-dark)] transition-all hover:bg-brand-soft/80 active:scale-95 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      <div className="flex items-center gap-2 sm:gap-4">
        {isOrgLevel(currentUser) && (
          <div className="relative">
            <button
              onClick={() => {
                setAlertsOpen((o) => {
                  if (o) setShowAllAlerts(false);
                  return !o;
                });
                setMenuOpen(false);
              }}
              className="relative flex size-10 sm:size-11 items-center justify-center rounded-[var(--r-field)] bg-brand-soft text-[var(--brand-dark)] transition-all hover:bg-brand-soft/80 active:scale-95"
              aria-label="Alerts"
              aria-expanded={alertsOpen}
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[11px] font-bold leading-none text-white">
                  {unread}
                </span>
              )}
            </button>
            {alertsOpen && (
              <>
                <div className="fixed inset-0 z-10 bg-[var(--shell-bg)]/30 backdrop-blur-[2px]" onClick={closeAlerts} />
                <div
                  className="fixed left-4 right-4 top-[4.25rem] z-20 mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-2xl shadow-brand-darker/10 animate-popover-in sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[min(100vw-2rem,22rem)]"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-gradient-to-b from-[var(--brand-tint-2)]/60 to-white px-5 py-4">
                    <div>
                      <p className="text-[var(--text-base)] font-bold text-[var(--text-strong)]">Alerts</p>
                      {unread > 0 && (
                        <p className="mt-0.5 text-[var(--text-xs)] text-[var(--text-soft)]">{unread} unread</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeAlerts}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-warm)] hover:text-[var(--text-body)]"
                      aria-label="Close alerts"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className={`divide-y divide-[var(--border-soft)] overflow-y-auto ${showAllAlerts ? "max-h-[min(70vh,28rem)]" : "max-h-[min(60vh,20rem)]"}`}>
                    {visibleAlerts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => markAlertRead(a.id)}
                        className={`w-full px-5 py-4 text-left transition-colors hover:bg-[var(--surface-warm)] ${!a.read ? "bg-[var(--brand-tint)]/35" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[var(--text-sm)] font-semibold text-[var(--text-body)]">{a.title}</p>
                          <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[var(--text-xs)] text-[var(--text-soft)]">{a.detail}</p>
                        <p className="mt-1.5 text-[var(--text-xs)] text-[var(--text-soft)]/80">{timeAgo(a.createdAt)}</p>
                      </button>
                    ))}
                    {alerts.length === 0 && (
                      <p className="px-5 py-8 text-center text-[var(--text-sm)] text-[var(--text-soft)]">No alerts yet.</p>
                    )}
                  </div>
                  {alerts.length > 0 && !showAllAlerts && (
                    <button
                      type="button"
                      onClick={() => setShowAllAlerts(true)}
                      className="block w-full border-t border-[var(--border-soft)] py-3.5 text-center text-[var(--text-sm)] font-semibold text-brand hover:bg-[var(--surface-warm)]"
                    >
                      View all
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentUser && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((o) => !o);
                closeAlerts();
              }}
              className="flex items-center justify-center rounded-[var(--r-field)] transition-all hover:opacity-90 active:scale-95"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size={44} className="rounded-[var(--r-field)]" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white shadow-2xl shadow-brand-darker/10 animate-popover-in">
                  <div className="border-b border-[var(--border-soft)] px-4 py-3">
                    <p className="truncate text-[var(--text-sm)] font-semibold text-[var(--text-strong)]">{orgName}</p>
                    <p className="truncate text-[var(--text-xs)] text-[var(--text-soft)]">{accountLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[var(--text-sm)] font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-warm)]"
                  >
                    <LogOut size={18} className="text-[var(--text-soft)]" />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
