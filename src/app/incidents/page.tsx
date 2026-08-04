"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { ChevronDown, FileSearch } from "lucide-react";

export default function IncidentsPage() {
  const { currentUser, incidents, users, rags, organisations, closeIncident } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [findingsDraft, setFindingsDraft] = useState<Record<string, string>>({});

  const isInternal = currentUser?.role === "internal";
  const orgIncidents = useMemo(
    () => incidents.filter((i) => (isInternal ? true : i.orgId === currentUser?.orgId)),
    [incidents, currentUser, isInternal]
  );
  const sorted = [...orgIncidents].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "Unknown";
  }
  function ragName(id: string) {
    return rags.find((r) => r.id === id)?.name || "General";
  }
  function orgName(id: string) {
    return organisations.find((o) => o.id === id)?.name ?? "";
  }

  return (
    <AppShell
      title="Incidents"
      subtitle={isInternal ? "Full investigations across every organisation" : "Full investigations opened from alerts"}
    >
      <div className="space-y-3">
        {sorted.map((inc) => {
          const isExpanded = expanded === inc.id;
          return (
            <Card key={inc.id}>
              <button onClick={() => setExpanded(isExpanded ? null : inc.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
                <FileSearch size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {userName(inc.subjectUserId)} - {ragName(inc.ragId)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Investigator {userName(inc.investigatorId)} · Opened {timeAgo(inc.openedAt)}
                  </p>
                </div>
                {isInternal && <Badge tone="slate">{orgName(inc.orgId)}</Badge>}
                <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                <Badge tone={inc.status === "open" ? "amber" : "green"}>{inc.status}</Badge>
                <ChevronDown size={16} className={`text-slate-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded && (
                <CardBody className="pt-0">
                  <div className="border-t border-slate-100 pt-4">
                    {inc.status === "closed" ? (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Findings</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2.5">{inc.findings || "No findings recorded."}</p>
                        <p className="text-xs text-slate-400 mt-2">Closed {inc.closedAt && formatDateTime(inc.closedAt)}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-500">Findings</p>
                        <Textarea
                          value={findingsDraft[inc.id] ?? ""}
                          onChange={(e) => setFindingsDraft((d) => ({ ...d, [inc.id]: e.target.value }))}
                          rows={3}
                          placeholder="Record what was found during the investigation..."
                        />
                        <Button size="sm" onClick={() => closeIncident(inc.id, findingsDraft[inc.id] ?? "")}>
                          Close incident
                        </Button>
                      </div>
                    )}
                  </div>
                </CardBody>
              )}
            </Card>
          );
        })}
        {sorted.length === 0 && (
          <Card>
            <CardBody className="text-center py-12 text-sm text-slate-400">
              No incidents yet - open one from an alert by selecting &ldquo;Turn into incident&rdquo;.
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
