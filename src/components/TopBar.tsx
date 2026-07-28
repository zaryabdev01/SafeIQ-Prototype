"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { severityTone, Badge } from "@/components/ui/Badge";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { currentUser, dashboardAlerts, markAlertRead } = useApp();
  const [open, setOpen] = useState(false);

  const alerts = currentUser?.role === "organisation" ? dashboardAlerts : [];
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      {currentUser?.role === "organisation" && (
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-600"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-20 animate-fade-in overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm text-slate-800">Alerts</div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {alerts.slice(0, 8).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => markAlertRead(a.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${!a.read ? "bg-indigo-50/30" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{a.title}</p>
                        <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.detail}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{timeAgo(a.createdAt)}</p>
                    </button>
                  ))}
                  {alerts.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No alerts yet.</p>}
                </div>
                <Link href="/dashboard" onClick={() => setOpen(false)} className="block text-center text-xs font-medium text-brand py-2.5 hover:bg-slate-50">
                  View dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
