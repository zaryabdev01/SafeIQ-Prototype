"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { MapPin, Siren } from "lucide-react";

const STATUS_TONE = { new: "red", active: "amber", satisfied: "green", escalated: "red" } as const;

export default function EmployeeEmergenciesPage() {
  const { currentUser, emergencyEvents } = useApp();

  const myEvents = useMemo(
    () =>
      currentUser
        ? [...emergencyEvents].filter((e) => e.userId === currentUser.id).sort((a, b) => (a.triggeredAt < b.triggeredAt ? 1 : -1))
        : [],
    [emergencyEvents, currentUser]
  );

  if (!currentUser) return null;

  return (
    <AppShell title="Emergencies" subtitle="Your Emergency Safe Word and siren triggers">
      <Card>
        <CardBody className="space-y-3">
          {myEvents.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
              <Siren size={16} className="text-red-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{e.trigger === "safe_word" ? "Emergency Safe Word" : "Siren button"}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {e.gpsLat.toFixed(4)}, {e.gpsLng.toFixed(4)} · Notified {e.nominatedContact} · {formatDateTime(e.triggeredAt)}
                </p>
              </div>
              <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
              <span className="text-[11px] text-slate-400">{timeAgo(e.triggeredAt)}</span>
            </div>
          ))}
          {myEvents.length === 0 && <p className="text-sm text-slate-400 text-center py-8">You haven&apos;t triggered any emergency alerts.</p>}
        </CardBody>
      </Card>
    </AppShell>
  );
}
