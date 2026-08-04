"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, severityTone } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { ChevronDown, FileSearch } from "lucide-react";

export default function EmployeeIncidentsPage() {
  const { currentUser, incidents, users, rags } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);

  const myIncidents = useMemo(
    () =>
      currentUser
        ? incidents
            .filter((i) => i.subjectUserId === currentUser.id || i.investigatorId === currentUser.id)
            .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
        : [],
    [incidents, currentUser]
  );

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }
  function ragName(id: string) {
    return rags.find((r) => r.id === id)?.name || "General";
  }

  if (!currentUser) return null;

  return (
    <AppShell title="Incidents" subtitle="Full investigations you're involved in">
      <div className="space-y-3">
        {myIncidents.map((inc) => {
          const isExpanded = expanded === inc.id;
          return (
            <Card key={inc.id}>
              <button onClick={() => setExpanded(isExpanded ? null : inc.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
                <FileSearch size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{ragName(inc.ragId)}</p>
                  <p className="text-xs text-slate-400">
                    Investigator {userName(inc.investigatorId)} · Opened {timeAgo(inc.openedAt)}
                  </p>
                </div>
                <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                <Badge tone={inc.status === "open" ? "amber" : "green"}>{inc.status}</Badge>
                <ChevronDown size={16} className={`text-slate-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded && (
                <CardBody className="pt-0">
                  <div className="border-t border-slate-100 pt-4 text-sm">
                    <p className="text-xs font-medium text-slate-500 mb-1">Findings</p>
                    <p className="text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5">{inc.findings || "Investigation still in progress."}</p>
                    {inc.closedAt && <p className="text-xs text-slate-400 mt-2">Closed {formatDateTime(inc.closedAt)}</p>}
                  </div>
                </CardBody>
              )}
            </Card>
          );
        })}
        {myIncidents.length === 0 && (
          <Card>
            <CardBody className="text-center py-12 text-sm text-slate-400">No incidents involve you right now.</CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
