"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { useApp } from "@/lib/store";
import { AlertTriangle, BrainCircuit, FileText, Users } from "lucide-react";

export default function InternalOverviewPage() {
  const { currentUser, rags, ragAssignments, alertCases, organisations } = useApp();

  if (!currentUser) return null;

  const sortedCases = [...alertCases].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function orgName(orgId: string) {
    return organisations.find((o) => o.id === orgId)?.name ?? "Unknown organisation";
  }

  return (
    <AppShell title="SafeIQ Internal" subtitle="Cross-organisation overview and alert management">
      <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-4 py-3 mb-6 flex items-start gap-2">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>
          Preview only - this prototype seeds a single demo organisation (Bright Care Homes Ltd), so everything below reflects just
          that one account. In production this view would span every SafeIQ client organisation.
        </span>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BrainCircuit size={15} /> RAG systems across every organisation
          </h2>
          <Badge tone="slate">{rags.length}</Badge>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {rags.map((r) => {
            const assigned = ragAssignments.filter((a) => a.ragId === r.id).length;
            return (
              <Link key={r.id} href={`/rag/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.colorTag }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{r.name}</p>
                  <p className="text-xs text-slate-400">{orgName(r.orgId)}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <FileText size={12} /> {r.documents.length}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={12} /> {assigned}
                </span>
              </Link>
            );
          })}
          {rags.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">No RAG systems yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={15} /> Alert cases across every organisation
          </h2>
          <Badge tone="amber">{sortedCases.filter((c) => c.status === "open").length} open</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          {sortedCases.map((c) => (
            <AlertCaseThread key={c.id} caseItem={c} canClose={true} currentUserId={currentUser.id} />
          ))}
          {sortedCases.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No alert cases yet.</p>}
        </CardBody>
      </Card>
    </AppShell>
  );
}
