"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { useApp } from "@/lib/store";
import { Search, ShieldAlert } from "lucide-react";
import type { AlertSeverity } from "@/lib/types";

export default function EmployeeAlertsPage() {
  const { currentUser, alertCases, rags } = useApp();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<AlertSeverity | "">("");
  const [date, setDate] = useState("");

  const myCases = useMemo(
    () =>
      currentUser
        ? alertCases
            .filter(
              (c) => c.userId === currentUser.id || c.ownerId === currentUser.id || c.participantIds.includes(currentUser.id)
            )
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [alertCases, currentUser]
  );

  const filtered = myCases.filter((c) => {
    if (priority && c.severity !== priority) return false;
    if (date && !c.createdAt.startsWith(date)) return false;
    if (search.trim()) {
      const rag = rags.find((r) => r.id === c.ragId)?.name ?? "";
      if (!`${c.keyword} ${rag}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  if (!currentUser) return null;

  return (
    <AppShell title="Alerts" subtitle="Things flagged by keyword, or an AI concern under review by your manager">
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
            <ShieldAlert size={13} /> Anything here either concerns you directly, or is an alert you&apos;ve been designated to
            review and close.
          </p>
          {filtered.map((c) => (
            <AlertCaseThread key={c.id} caseItem={c} canClose={currentUser.id === c.ownerId} currentUserId={currentUser.id} />
          ))}
          {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No alerts match these filters.</p>}
        </CardBody>
      </Card>
    </AppShell>
  );
}
