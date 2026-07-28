"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { ShieldCheck, MapPinned, History, Smartphone } from "lucide-react";

export default function SettingsPage() {
  const { currentUser, toggle2FA, toggleIPLock, loginHistory, users } = useApp();

  const isOrg = currentUser?.role === "organisation";
  const historyRows = useMemo(
    () => [...loginHistory].filter((l) => isOrg || l.userId === currentUser?.id).sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1)),
    [loginHistory, isOrg, currentUser]
  );

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }

  if (!currentUser) return null;

  return (
    <AppShell title="Settings" subtitle="Security and account activity">
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={15} /> Security
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
              <div>
                <p className="text-sm font-medium text-slate-800">Two-step verification</p>
                <p className="text-xs text-slate-500">Require a one-time code at every sign-in</p>
              </div>
              <button
                onClick={() => toggle2FA(currentUser.id)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${currentUser.twoFactorEnabled ? "bg-brand" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${currentUser.twoFactorEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
              <div>
                <p className="text-sm font-medium text-slate-800">IP address lock</p>
                <p className="text-xs text-slate-500">Only allow sign-in from approved IP addresses</p>
              </div>
              <button
                onClick={() => toggleIPLock(currentUser.id)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${currentUser.ipLockEnabled ? "bg-brand" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${currentUser.ipLockEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <MapPinned size={15} /> Account details
            </h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-800">{currentUser.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800">{currentUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Country</span>
              <span className="font-medium text-slate-800">{currentUser.country}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Language</span>
              <span className="font-medium text-slate-800">{currentUser.language}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <History size={15} /> {isOrg ? "Account login history - all users" : "Your login history"}
          </h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                {isOrg && <th className="px-5 py-2.5 font-medium">User</th>}
                <th className="px-5 py-2.5 font-medium">IP address</th>
                <th className="px-5 py-2.5 font-medium">Location</th>
                <th className="px-5 py-2.5 font-medium">Device</th>
                <th className="px-5 py-2.5 font-medium">Logged in</th>
                <th className="px-5 py-2.5 font-medium">Logged out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historyRows.map((l) => (
                <tr key={l.id}>
                  {isOrg && <td className="px-5 py-3 text-slate-700">{userName(l.userId)}</td>}
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{l.ip}</td>
                  <td className="px-5 py-3 text-slate-500">{l.location}</td>
                  <td className="px-5 py-3 text-slate-500 flex items-center gap-1.5">
                    <Smartphone size={12} /> {l.device}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDateTime(l.loginAt)}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {l.logoutAt ? formatDateTime(l.logoutAt) : <Badge tone="green">Active now</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {historyRows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No login history yet.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
