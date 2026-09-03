"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import {
  DashboardStatTile,
  DashboardSectionTitle,
  DashboardEmptyState,
} from "@/components/dashboard/DashboardPrimitives";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import {
  AlertTriangle,
  BrainCircuit,
  Building2,
  FileSearch,
  FileText,
  Siren,
  UserPlus,
  Users,
  Globe2,
  ShieldCheck,
} from "lucide-react";

const RAG_PAGE_SIZE = 8;
const ALERTS_PAGE_SIZE = 5;

export default function InternalOverviewPage() {
  const { organisations, users, rags, ragAssignments, alertCases, incidents, emergencyEvents } = useApp();
  const [ragPage, setRagPage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);

  const teamMembers = users.filter((u) => u.role === "employee").length;
  const directSignUps = users.filter((u) => u.role !== "internal" && u.directSignUp).length;
  const activeAlerts = alertCases.filter((c) => c.status === "open").length;
  const completedAlerts = alertCases.filter((c) => c.status === "closed").length;
  const activeIncidents = incidents.filter((i) => i.status === "open").length;
  const completedIncidents = incidents.filter((i) => i.status === "closed").length;
  const activeEmergencies = emergencyEvents.filter((e) => e.status === "new" || e.status === "active").length;
  const completedEmergencies = emergencyEvents.filter((e) => e.status === "satisfied" || e.status === "escalated").length;

  const tiles = [
    { label: "Organisations", value: organisations.length, icon: Building2, tone: "text-brand bg-[var(--brand-tint-2)]", href: "/internal/organisations" },
    { label: "Team members", value: teamMembers, icon: Users, tone: "text-teal-600 bg-teal-50", href: "/internal/people" },
    { label: "Direct sign-ups", value: directSignUps, icon: UserPlus, tone: "text-emerald-600 bg-emerald-50", href: "/internal/people" },
    { label: "RAGs created", value: rags.length, icon: BrainCircuit, tone: "text-brand bg-[var(--brand-tint-2)]", href: "#internal-rags" },
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
      tone: "text-[var(--text-soft)] bg-[var(--surface-warm)]",
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

  const sortedAlerts = useMemo(
    () => [...alertCases].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [alertCases]
  );
  const alertsTotalPages = Math.max(1, Math.ceil(sortedAlerts.length / ALERTS_PAGE_SIZE));
  const clampedAlertsPage = Math.min(alertsPage, alertsTotalPages);
  const pagedAlerts = sortedAlerts.slice(
    (clampedAlertsPage - 1) * ALERTS_PAGE_SIZE,
    clampedAlertsPage * ALERTS_PAGE_SIZE
  );

  const totalRagPages = Math.max(1, Math.ceil(rags.length / RAG_PAGE_SIZE));
  const clampedRagPage = Math.min(ragPage, totalRagPages);
  const pagedRags = rags.slice((clampedRagPage - 1) * RAG_PAGE_SIZE, clampedRagPage * RAG_PAGE_SIZE);

  function orgName(orgId: string) {
    return organisations.find((o) => o.id === orgId)?.name ?? "SafeIQ Internal";
  }

  function userName(userId: string) {
    return users.find((u) => u.id === userId)?.name ?? "Unknown";
  }

  function ragName(ragId: string) {
    return rags.find((r) => r.id === ragId)?.name ?? "General";
  }

  return (
    <AppShell title="SafeIQ Internal" subtitle="Cross-organisation overview and alert management" icon={Globe2}>
      <div className="rounded-[var(--radius-xl)] border border-amber-200/60 bg-amber-50 text-amber-900 text-xs px-4 py-3 mb-6 flex items-start gap-2 animate-page-enter">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>
          Preview only — this prototype seeds two demo organisations. In production this view would span every SafeIQ
          client organisation.
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tiles.map((t, i) => (
          <DashboardStatTile
            key={t.label}
            label={t.label}
            value={t.value}
            caption={t.caption}
            icon={t.icon}
            tone={t.tone}
            href={t.href}
            index={i}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <DashboardSectionTitle icon={ShieldCheck}>Recent alerts</DashboardSectionTitle>
            <Link href="/alerts" className="text-xs font-medium text-brand hover:underline">View all</Link>
          </CardHeader>
          <div className="divide-y divide-[var(--border-soft)]">
            {pagedAlerts.map((c) => (
              <Link
                key={c.id}
                href="/alerts"
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--surface-warm)] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-body)] truncate">
                    &ldquo;{c.keyword}&rdquo; — {userName(c.userId)}
                  </p>
                  <p className="text-xs text-[var(--text-soft)]">
                    {orgName(c.orgId)} · {ragName(c.ragId)} · {timeAgo(c.createdAt)}
                  </p>
                </div>
                <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
                <Badge tone={c.status === "open" ? "amber" : "green"}>{c.status}</Badge>
              </Link>
            ))}
            {sortedAlerts.length === 0 && <DashboardEmptyState>No alerts raised yet.</DashboardEmptyState>}
          </div>
          <Pagination
            page={clampedAlertsPage}
            totalPages={alertsTotalPages}
            totalItems={sortedAlerts.length}
            pageSize={ALERTS_PAGE_SIZE}
            onChange={setAlertsPage}
          />
        </Card>

        <Card>
          <CardHeader>
            <DashboardSectionTitle icon={FileSearch}>Incident summary</DashboardSectionTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-soft)]">Open incidents</span>
              <span className="font-semibold text-[var(--text-strong)]">{activeIncidents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-soft)]">Closed incidents</span>
              <span className="font-semibold text-[var(--text-strong)]">{completedIncidents}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-soft)]">Active emergencies</span>
              <span className={`font-semibold ${activeEmergencies > 0 ? "text-red-600" : "text-[var(--text-strong)]"}`}>
                {activeEmergencies}
              </span>
            </div>
            <Link href="/incidents" className="block text-xs font-medium text-brand hover:underline pt-1">
              Open incidents console →
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card id="internal-rags">
        <CardHeader>
          <DashboardSectionTitle icon={BrainCircuit}>RAG systems across every organisation</DashboardSectionTitle>
          <Badge tone="slate">{rags.length}</Badge>
        </CardHeader>
        <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_auto] gap-3 border-b border-[var(--border-soft)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
          <span>RAG</span>
          <span>Status</span>
          <span>Docs</span>
          <span>Assigned</span>
          <span>Keywords</span>
          <span>Created</span>
        </div>
        <div className="divide-y divide-[var(--border-soft)]">
          {pagedRags.map((r) => {
            const assigned = ragAssignments.filter((a) => a.ragId === r.id).length;
            return (
              <Link
                key={r.id}
                href={`/rag/${r.id}`}
                className="grid gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-warm)] group md:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_auto] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: r.colorTag }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-body)] group-hover:text-brand">{r.name}</p>
                    <p className="truncate text-xs text-[var(--text-soft)]">{orgName(r.orgId)} · {r.category}</p>
                  </div>
                </div>
                <Badge tone={r.status === "published" ? "green" : "amber"}>{r.status}</Badge>
                <span className="flex items-center gap-1 text-xs text-[var(--text-soft)]">
                  <FileText size={12} /> {r.documents.length}
                </span>
                <span className="flex items-center gap-1 text-xs text-[var(--text-soft)]">
                  <Users size={12} /> {assigned}
                </span>
                <span className="text-xs text-[var(--text-soft)]">{r.alertKeywords.filter((k) => k.enabled).length}</span>
                <span className="text-xs text-[var(--text-soft)]">{timeAgo(r.createdAt)}</span>
              </Link>
            );
          })}
          {rags.length === 0 && <DashboardEmptyState>No RAG systems yet.</DashboardEmptyState>}
        </div>
        <Pagination
          page={clampedRagPage}
          totalPages={totalRagPages}
          totalItems={rags.length}
          pageSize={RAG_PAGE_SIZE}
          onChange={setRagPage}
        />
      </Card>
    </AppShell>
  );
}
