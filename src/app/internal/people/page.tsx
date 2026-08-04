"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Field";
import { useApp } from "@/lib/store";

export default function InternalPeoplePage() {
  const { users, organisations } = useApp();
  const [directOnly, setDirectOnly] = useState(false);

  const people = users
    .filter((u) => u.role !== "internal")
    .filter((u) => !directOnly || u.directSignUp)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function orgName(id: string) {
    return organisations.find((o) => o.id === id)?.name ?? "Unknown organisation";
  }

  return (
    <AppShell title="People" subtitle="Every person across every organisation">
      <div className="flex justify-end mb-4">
        <Select value={directOnly ? "direct" : "all"} onChange={(e) => setDirectOnly(e.target.value === "direct")} className="!w-auto text-sm">
          <option value="all">Everyone</option>
          <option value="direct">Direct sign-ups only</option>
        </Select>
      </div>
      <Card>
        <div className="divide-y divide-slate-100">
          {people.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={u.name} color={u.avatarColor} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{u.name}</p>
                <p className="text-xs text-slate-400">
                  {orgName(u.orgId)} · {u.jobTitle}
                </p>
              </div>
              <Badge tone={u.role === "organisation" ? "indigo" : "slate"}>{u.role === "organisation" ? "Super Admin" : u.teamRole ?? "employee"}</Badge>
              {u.directSignUp && <Badge tone="green">Direct sign-up</Badge>}
            </div>
          ))}
          {people.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No one matches this filter.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
