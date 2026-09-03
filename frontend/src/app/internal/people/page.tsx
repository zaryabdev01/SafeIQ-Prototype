"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Input, Select } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { DashboardSectionTitle, DashboardEmptyState } from "@/components/dashboard/DashboardPrimitives";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { Mail, Search, Users } from "lucide-react";

const PAGE_SIZE = 8;

export default function InternalPeoplePage() {
  const { users, organisations } = useApp();
  const [directOnly, setDirectOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => u.role !== "internal")
      .filter((u) => !directOnly || u.directSignUp)
      .filter((u) => {
        if (!q) return true;
        const org = organisations.find((o) => o.id === u.orgId)?.name ?? "";
        return `${u.name} ${u.email} ${org} ${u.jobTitle ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [users, organisations, directOnly, search]);

  const totalPages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pagedPeople = people.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  function orgName(id: string) {
    return organisations.find((o) => o.id === id)?.name ?? "Unknown organisation";
  }

  function roleLabel(u: (typeof people)[number]) {
    if (u.role === "organisation") return "Super Admin";
    return u.teamRole ?? "employee";
  }

  return (
    <AppShell title="People" subtitle="Every person across every organisation">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, organisation, or job title…"
            className="pl-8"
          />
        </div>
        <Select
          value={directOnly ? "direct" : "all"}
          onChange={(e) => {
            setDirectOnly(e.target.value === "direct");
            setPage(1);
          }}
          className="!w-auto text-sm sm:min-w-[200px]"
        >
          <option value="all">Everyone</option>
          <option value="direct">Direct sign-ups only</option>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <DashboardSectionTitle icon={Users}>All people</DashboardSectionTitle>
          <Badge tone="slate">{people.length}</Badge>
        </CardHeader>

        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-[var(--border-soft)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
          <span>Person</span>
          <span>Email</span>
          <span>Organisation</span>
          <span>Role</span>
          <span>Joined</span>
          <span>Status</span>
        </div>

        <div className="divide-y divide-[var(--border-soft)]">
          {pagedPeople.map((u) => (
            <div
              key={u.id}
              className="grid gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-warm)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_auto] lg:items-center lg:py-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={u.name} color={u.avatarColor} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-body)]">{u.name}</p>
                  <p className="truncate text-xs text-[var(--text-soft)]">{u.jobTitle ?? "No job title"} · {u.country}</p>
                </div>
              </div>

              <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-[var(--text-soft)]">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{u.email}</span>
              </p>

              <p className="truncate text-sm text-[var(--text-soft)]">{orgName(u.orgId)}</p>

              <div className="flex flex-wrap gap-1.5">
                <Badge tone={u.role === "organisation" ? "indigo" : "slate"}>{roleLabel(u)}</Badge>
                {u.directSignUp && <Badge tone="green">Direct sign-up</Badge>}
                {u.isSafeguardingLead && <Badge tone="amber">Safeguarding</Badge>}
              </div>

              <p className="text-xs text-[var(--text-soft)]">{timeAgo(u.createdAt)}</p>

              <Badge tone={u.status === "archived" ? "slate" : "green"}>{u.status === "archived" ? "Archived" : "Active"}</Badge>
            </div>
          ))}
          {people.length === 0 && (
            <DashboardEmptyState>No one matches this filter.</DashboardEmptyState>
          )}
        </div>

        <Pagination
          page={clampedPage}
          totalPages={totalPages}
          totalItems={people.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
        />
      </Card>
    </AppShell>
  );
}
