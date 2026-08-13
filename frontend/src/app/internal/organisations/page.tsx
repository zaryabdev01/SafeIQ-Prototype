"use client";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { Building2, BrainCircuit, Users } from "lucide-react";

export default function InternalOrganisationsPage() {
  const { organisations, users, rags } = useApp();

  return (
    <AppShell title="Organisations" subtitle="Every organisation signed up to SafeIQ">
      <Card>
        <div className="divide-y divide-slate-100">
          {organisations.map((o) => {
            const teamCount = users.filter((u) => u.orgId === o.id && u.role !== "internal").length;
            const ragCount = rags.filter((r) => r.orgId === o.id).length;
            return (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-brand flex items-center justify-center shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{o.name}</p>
                  <p className="text-xs text-slate-400">{o.sector}</p>
                </div>
                {o.kycVerified && <Badge tone="green">KYC verified</Badge>}
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={12} /> {teamCount}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <BrainCircuit size={12} /> {ragCount}
                </span>
              </div>
            );
          })}
          {organisations.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No organisations yet.</p>}
        </div>
      </Card>
    </AppShell>
  );
}
