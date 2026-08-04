"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Siren, MapPin, Check, ArrowUpRight } from "lucide-react";

const STATUS_TONE = { new: "red", active: "amber", satisfied: "green", escalated: "red" } as const;

export default function EmergenciesPage() {
  const { currentUser, emergencyEvents, users, organisations, resolveEmergency } = useApp();

  const isInternal = currentUser?.role === "internal";
  const orgEvents = useMemo(
    () => emergencyEvents.filter((e) => (isInternal ? true : e.orgId === currentUser?.orgId)),
    [emergencyEvents, currentUser, isInternal]
  );
  const sorted = [...orgEvents].sort((a, b) => (a.triggeredAt < b.triggeredAt ? 1 : -1));
  const openEvents = sorted.filter((e) => e.status === "new" || e.status === "active");
  const resolvedEvents = sorted.filter((e) => e.status === "satisfied" || e.status === "escalated");

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }
  function orgName(id: string) {
    return organisations.find((o) => o.id === id)?.name ?? "";
  }

  return (
    <AppShell
      title="Emergencies"
      subtitle={isInternal ? "Safe word and siren triggers across every organisation" : "Safe word and siren triggers, and how they were resolved"}
    >
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Siren size={15} className="text-red-600" /> New &amp; active
          </h2>
          <Badge tone="red">{openEvents.length}</Badge>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {openEvents.map((e) => (
            <div key={e.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  {userName(e.userId)} - {e.trigger === "safe_word" ? "Emergency Safe Word" : "Siren button"}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {e.gpsLat.toFixed(4)}, {e.gpsLng.toFixed(4)} · Notifying {e.nominatedContact} · {timeAgo(e.triggeredAt)}
                </p>
              </div>
              {isInternal && <Badge tone="slate">{orgName(e.orgId)}</Badge>}
              <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => resolveEmergency(e.id, "satisfied")}>
                <Check size={13} /> Satisfied
              </Button>
              <Button size="sm" variant="danger" onClick={() => resolveEmergency(e.id, "escalated")}>
                <ArrowUpRight size={13} /> Escalate
              </Button>
            </div>
          ))}
          {openEvents.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No active emergencies right now.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">History</h2>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {resolvedEvents.map((e) => (
            <div key={e.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  {userName(e.userId)} - {e.trigger === "safe_word" ? "Emergency Safe Word" : "Siren button"}
                </p>
                <p className="text-xs text-slate-400">{e.triggeredAt && formatDateTime(e.triggeredAt)}</p>
              </div>
              {isInternal && <Badge tone="slate">{orgName(e.orgId)}</Badge>}
              <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
            </div>
          ))}
          {resolvedEvents.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">Nothing resolved yet.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
