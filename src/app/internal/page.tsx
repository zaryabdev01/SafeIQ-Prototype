"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useApp } from "@/lib/store";
import { AlertTriangle, BrainCircuit, Building2, FileSearch, FileText, Siren, UserPlus, Users } from "lucide-react";

export default function InternalOverviewPage() {
  const { organisations, users, rags, ragAssignments, alertCases, incidents, emergencyEvents } = useApp();

  const teamMembers = users.filter((u) => u.role === "employee").length;
  const directSignUps = users.filter((u) => u.role !== "internal" && u.directSignUp).length;
  const activeAlerts = alertCases.filter((c) => c.status === "open").length;
  const completedAlerts = alertCases.filter((c) => c.status === "closed").length;
  const activeIncidents = incidents.filter((i) => i.status === "open").length;
  const completedIncidents = incidents.filter((i) => i.status === "closed").length;
  const activeEmergencies = emergencyEvents.filter((e) => e.status === "new" || e.status === "active").length;
  const completedEmergencies = emergencyEvents.filter((e) => e.status === "satisfied" || e.status === "escalated").length;

  const tiles = [
    { label: "Organisations", value: organisations.length, icon: Building2, tone: "text-indigo-600 bg-indigo-50", href: "/internal/organisations" },
    { label: "Team members", value: teamMembers, icon: Users, tone: "text-teal-600 bg-teal-50", href: "/internal/people" },
    { label: "Direct sign-ups", value: directSignUps, icon: UserPlus, tone: "text-emerald-600 bg-emerald-50", href: "/internal/people" },
    { label: "RAGs created", value: rags.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50", href: "#internal-rags" },
    {
      label: "Alerts",
      value: alertCases.length,
      caption: `${activeAlerts} active · ${completedAlerts} complete`,
      icon: AlertTriangle,
      tone: "text-red-600 bg-red-50",
      href: "/alerts",
    },
    {
      label: "Incidents",
      value: incidents.length,
      caption: `${activeIncidents} active · ${completedIncidents} complete`,
      icon: FileSearch,
      tone: "text-slate-600 bg-slate-100",
      href: "/incidents",
    },
    {
      label: "Emergencies",
      value: emergencyEvents.length,
      caption: `${activeEmergencies} active · ${completedEmergencies} complete`,
      icon: Siren,
      tone: "text-red-600 bg-red-50",
      href: "/emergencies",
    },
  ];

  function orgName(orgId: string) {
    return organisations.find((o) => o.id === orgId)?.name ?? "SafeIQ Internal";
  }

  return (
    <AppShell title="SafeIQ Internal" subtitle="Cross-organisation overview and alert management">
      <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-4 py-3 mb-6 flex items-start gap-2">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>
          Preview only - this prototype seeds two demo organisations. In production this view would span every SafeIQ client
          organisation.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="hover:border-brand transition-colors h-full">
              <CardBody className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${t.tone}`}>
                  <t.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-slate-900 leading-none">{t.value}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{t.label}</p>
                  {t.caption && <p className="text-[10px] text-slate-400">{t.caption}</p>}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Card id="internal-rags">
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
    </AppShell>
  );
}
