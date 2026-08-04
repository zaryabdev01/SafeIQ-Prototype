"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { Search, ChevronDown, ShieldAlert } from "lucide-react";
import type { AlertSeverity } from "@/lib/types";

export default function AlertsPage() {
  const { currentUser, alertCases, users, rags, organisations } = useApp();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<AlertSeverity | "">("");
  const [date, setDate] = useState("");
  const [member, setMember] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const isInternal = currentUser?.role === "internal";
  const orgCases = useMemo(
    () => alertCases.filter((c) => (isInternal ? true : c.orgId === currentUser?.orgId)),
    [alertCases, currentUser, isInternal]
  );

  const filtered = orgCases.filter((c) => {
    if (priority && c.severity !== priority) return false;
    if (date && !c.createdAt.startsWith(date)) return false;
    if (member && c.userId !== member) return false;
    if (search.trim()) {
      const person = users.find((u) => u.id === c.userId)?.name ?? "";
      const rag = rags.find((r) => r.id === c.ragId)?.name ?? "";
      const haystack = `${c.keyword} ${person} ${rag}`.toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const orgEmployees = users.filter((u) => u.role === "employee" && (isInternal || u.orgId === currentUser?.orgId));

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
      title="Alerts"
      subtitle={isInternal ? "Every alert raised across every organisation" : "Every alert raised across your RAGs, in one place"}
    >
      <Card className="mb-5">
        <CardBody className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts..." className="pl-8" />
          </div>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as AlertSeverity | "")} className="sm:w-40">
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={member} onChange={(e) => setMember(e.target.value)} className="sm:w-48">
            <option value="">All team members</option>
            {orgEmployees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" />
        </CardBody>
      </Card>

      <div className="space-y-3">
        {sorted.map((c) => {
          const isExpanded = expanded === c.id;
          return (
            <Card key={c.id}>
              <button onClick={() => setExpanded(isExpanded ? null : c.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
                <ShieldAlert size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    &ldquo;{c.keyword}&rdquo; - {userName(c.userId)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {ragName(c.ragId)} · {timeAgo(c.createdAt)}
                  </p>
                </div>
                {isInternal && <Badge tone="slate">{orgName(c.orgId)}</Badge>}
                <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                <Badge tone={c.status === "open" ? "amber" : "green"}>{c.status}</Badge>
                <ChevronDown size={16} className={`text-slate-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>
              {isExpanded && (
                <div className="px-5 pb-5">
                  <AlertCaseThread caseItem={c} canClose={true} currentUserId={currentUser?.id ?? "u-admin"} />
                </div>
              )}
            </Card>
          );
        })}
        {sorted.length === 0 && (
          <Card>
            <CardBody className="text-center py-12 text-sm text-slate-400">No alerts match these filters.</CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
