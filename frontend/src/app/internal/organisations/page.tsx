"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { DashboardSectionTitle, DashboardEmptyState } from "@/components/dashboard/DashboardPrimitives";
import { useApp } from "@/lib/store";
import { Building2, BrainCircuit, Search, ShieldAlert, Users } from "lucide-react";

const PAGE_SIZE = 5;

export default function InternalOrganisationsPage() {
  const { organisations, users, rags, alertCases } = useApp();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return organisations.filter((o) => {
      if (!q) return true;
      return `${o.name} ${o.sector} ${o.id}`.toLowerCase().includes(q);
    });
  }, [organisations, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pagedOrgs = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  function orgStats(orgId: string) {
    const members = users.filter((u) => u.orgId === orgId && u.role !== "internal");
    const admins = members.filter((u) => u.role === "organisation").length;
    const employees = members.filter((u) => u.role === "employee").length;
    const ragCount = rags.filter((r) => r.orgId === orgId).length;
    const openAlerts = alertCases.filter((c) => c.orgId === orgId && c.status === "open").length;
    return { members: members.length, admins, employees, ragCount, openAlerts };
  }

  return (
    <AppShell title="Organisations" subtitle="Every organisation signed up to SafeIQ">
      <Card className="mb-4">
        <div className="relative px-4 py-3 sm:px-5">
          <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400 sm:left-8" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, sector, or ID…"
            className="pl-8"
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <DashboardSectionTitle icon={Building2}>All organisations</DashboardSectionTitle>
          <Badge tone="slate">{filtered.length}</Badge>
        </CardHeader>

        <div className="hidden md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto_auto_auto] gap-3 border-b border-[var(--border-soft)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
          <span>Organisation</span>
          <span>Sector</span>
          <span>KYC</span>
          <span>Team</span>
          <span>RAGs</span>
          <span>Open alerts</span>
        </div>

        <div className="divide-y divide-[var(--border-soft)]">
          {pagedOrgs.map((o) => {
            const stats = orgStats(o.id);
            return (
              <div
                key={o.id}
                className="grid gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-warm)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto_auto_auto] md:items-center md:py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-tint-2)] text-brand">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-body)]">{o.name}</p>
                    <p className="truncate text-xs text-[var(--text-soft)]">ID · {o.id}</p>
                  </div>
                </div>

                <p className="text-sm text-[var(--text-soft)] md:truncate">{o.sector}</p>

                <div>
                  <Badge tone={o.kycVerified ? "green" : "amber"}>{o.kycVerified ? "Verified" : "Pending"}</Badge>
                </div>

                <div className="flex flex-col gap-0.5 text-xs text-[var(--text-soft)]">
                  <span className="flex items-center gap-1 font-medium text-[var(--text-body)]">
                    <Users size={12} /> {stats.members}
                  </span>
                  <span>{stats.admins} admin · {stats.employees} staff</span>
                </div>

                <span className="flex items-center gap-1 text-xs text-[var(--text-soft)]">
                  <BrainCircuit size={12} /> {stats.ragCount}
                </span>

                <div className="flex items-center justify-between gap-3 md:justify-start">
                  <span className={`flex items-center gap-1 text-xs font-medium ${stats.openAlerts > 0 ? "text-red-600" : "text-[var(--text-soft)]"}`}>
                    <ShieldAlert size={12} /> {stats.openAlerts}
                  </span>
                  <Link href="/internal/people" className="text-xs font-medium text-brand hover:underline md:hidden">
                    View people
                  </Link>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <DashboardEmptyState>No organisations match your search.</DashboardEmptyState>
          )}
        </div>

        <Pagination
          page={clampedPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Card>
    </AppShell>
  );
}
