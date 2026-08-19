"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { Send, Link2, RotateCcw, XCircle, Copy, ChevronRight, ChevronLeft, Loader2, Search } from "lucide-react";
import type { InviteStatus, TeamRole } from "@/lib/types";
import { apiClient, ApiError, type ApiInvite, type ApiTeamRole, type ApiUserProfile } from "@/lib/apiClient";

const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

const statusTone: Record<InviteStatus, "amber" | "green" | "slate"> = {
  pending: "amber",
  accepted: "green",
  cancelled: "slate",
};

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div className="px-5 py-3 flex items-center justify-center gap-1 border-t border-slate-100">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-7 h-7 text-xs rounded-md font-medium ${p === page ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"}`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function AvatarStack({ people }: { people: { id: string; name: string; avatarColor?: string }[] }) {
  if (people.length === 0) return <span className="text-xs text-slate-300">-</span>;
  return (
    <div className="flex -space-x-2">
      {people.slice(0, 3).map((p) => (
        <div key={p.id} title={p.name} className="ring-2 ring-white rounded-full">
          <Avatar name={p.name} color={p.avatarColor ?? "#4f46e5"} size={24} />
        </div>
      ))}
      {people.length > 3 && (
        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium flex items-center justify-center ring-2 ring-white">
          +{people.length - 3}
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  const {
    currentUser,
    isRealSession,
    users,
    invites: allInvites,
    createInvite,
    resendInvite,
    cancelInvite,
    ragAssignments: allRagAssignments,
    setTeamRole,
    setUserStatus,
    alertCases,
  } = useApp();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState("");

  // --- Real-backend mode (Milestone 2's /team + /invites - see backend/README.md) ---
  const [realTeam, setRealTeam] = useState<ApiUserProfile[]>([]);
  const [realInvites, setRealInvites] = useState<ApiInvite[]>([]);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState("");
  const [realBusy, setRealBusy] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [selectedInviteTokens, setSelectedInviteTokens] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // --- Mock mode: archive status (client feedback, 17/08/2026, gap-analysis §4) ---
  const [mockTeamSearch, setMockTeamSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // --- Mock mode: paginated tables (client feedback, 18/08/2026 - Team page mockup) ---
  const PAGE_SIZE = 8;
  const [invitePage, setInvitePage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);

  function toggleEmployeeSelected(userId: string) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function bulkSetStatus(status: "active" | "archived") {
    for (const userId of selectedEmployeeIds) setUserStatus(userId, status);
    setSelectedEmployeeIds(new Set());
  }

  const refreshReal = useCallback(async () => {
    setRealLoading(true);
    setRealError("");
    try {
      const [team, invitesList] = await Promise.all([apiClient.listTeam(), apiClient.listInvites()]);
      setRealTeam(team.filter((member) => member.team_role !== "super_admin"));
      setRealInvites(invitesList);
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not load the team from the SafeIQ API.");
    } finally {
      setRealLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount/session-change; loading flag must flip synchronously
    if (isRealSession) void refreshReal();
  }, [isRealSession, refreshReal]);

  async function sendRealInvite() {
    if (!email.trim()) return;
    setRealBusy(true);
    try {
      await apiClient.createInvite({ email: email.trim(), role: "employee" });
      setEmail("");
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not create that invite.");
    } finally {
      setRealBusy(false);
    }
  }

  async function generateRealOpenLink() {
    setRealBusy(true);
    try {
      await apiClient.createInvite({ role: "employee" });
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not create an open invite link.");
    } finally {
      setRealBusy(false);
    }
  }

  async function resendReal(token: string) {
    try {
      await apiClient.resendInvite(token);
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not resend that invite.");
    }
  }

  async function cancelReal(token: string) {
    try {
      await apiClient.cancelInvite(token);
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not cancel that invite.");
    }
  }

  async function changeRealRole(userId: string, role: ApiTeamRole) {
    try {
      await apiClient.updateRole(userId, role);
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not change that person's role.");
    }
  }

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(link);
    window.setTimeout(() => setCopied(""), 1800);
  }

  function toggleInviteSelected(token: string) {
    setSelectedInviteTokens((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  }

  async function bulkResendSelected() {
    setBulkBusy(true);
    try {
      for (const token of selectedInviteTokens) await apiClient.resendInvite(token);
      setSelectedInviteTokens(new Set());
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not resend the selected invites.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkCancelSelected() {
    setBulkBusy(true);
    try {
      for (const token of selectedInviteTokens) await apiClient.cancelInvite(token);
      setSelectedInviteTokens(new Set());
      await refreshReal();
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not cancel the selected invites.");
    } finally {
      setBulkBusy(false);
    }
  }

  const filteredRealInvites = realInvites.filter((inv) => {
    const q = inviteSearch.trim().toLowerCase();
    if (!q) return true;
    return (inv.email ?? "open invite link").toLowerCase().includes(q) || inv.status.toLowerCase().includes(q);
  });

  const filteredRealTeam = realTeam.filter((u) => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.job_title ?? "").toLowerCase().includes(q);
  });

  // --- Mock mode (everything else - RAGs/etc have no backend yet) ---
  const employees = users.filter((u) => u.role === "employee" && u.orgId === currentUser?.orgId);
  const invites = allInvites.filter((i) => i.orgId === currentUser?.orgId);
  const employeeIds = new Set(employees.map((e) => e.id));
  const ragAssignments = allRagAssignments.filter((a) => employeeIds.has(a.userId));

  const archivedCount = employees.filter((u) => u.status === "archived").length;
  const visibleEmployees = employees.filter((u) => (showArchived ? true : u.status !== "archived"));
  const filteredEmployees = visibleEmployees.filter((u) => {
    const q = mockTeamSearch.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.jobTitle ?? "").toLowerCase().includes(q);
  });

  function sendInvite() {
    if (!email.trim()) return;
    createInvite(email.trim());
    setEmail("");
  }

  function generateOpenLink() {
    createInvite("Open invite - anyone with this link");
  }

  function liveAlertsFor(userId: string) {
    return alertCases.filter((c) => c.userId === userId && c.status === "open");
  }

  function managersFor(userId: string) {
    const ids = [...new Set(ragAssignments.filter((a) => a.userId === userId).map((a) => a.alertOwnerId).filter((x): x is string => !!x))];
    return ids.map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u);
  }

  const totalInvitePages = Math.max(1, Math.ceil(invites.length / PAGE_SIZE));
  const clampedInvitePage = Math.min(invitePage, totalInvitePages);
  const pagedInvites = invites.slice((clampedInvitePage - 1) * PAGE_SIZE, clampedInvitePage * PAGE_SIZE);

  const totalTeamPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const clampedTeamPage = Math.min(teamPage, totalTeamPages);
  const pagedEmployees = filteredEmployees.slice((clampedTeamPage - 1) * PAGE_SIZE, clampedTeamPage * PAGE_SIZE);

  // "Your profile" mini-summary card - the logged-in person's own RAG/alert/manager snapshot
  const myRagAssignments = allRagAssignments.filter((a) => a.userId === currentUser?.id);
  const myLiveAlerts = currentUser ? liveAlertsFor(currentUser.id) : [];
  const myManagers = currentUser ? managersFor(currentUser.id) : [];

  const memberCount = isRealSession ? realTeam.length : employees.length - archivedCount;
  const pendingCount = isRealSession ? realInvites.filter((i) => i.status === "pending").length : invites.filter((i) => i.status === "pending").length;

  return (
    <AppShell
      title="Team"
      subtitle={isRealSession ? "Live from the SafeIQ API - real invites, real roles" : "Invite people and manage everyone assigned to your organisation"}
    >
      {isRealSession && realError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{realError}</p>}

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Invite a new person</h2>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.co.uk"
                onKeyDown={(e) => e.key === "Enter" && (isRealSession ? sendRealInvite() : sendInvite())}
              />
              <Button onClick={isRealSession ? sendRealInvite : sendInvite} disabled={isRealSession && realBusy}>
                {isRealSession && realBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send magic link
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-xs text-slate-400">or</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>
            <Button variant="outline" className="mt-3" onClick={isRealSession ? generateRealOpenLink : generateOpenLink} disabled={isRealSession && realBusy}>
              <Link2 size={14} /> Generate an open magic link
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Overview</h2>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Team members</span>
              <span className="font-medium text-slate-800">{memberCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pending invites</span>
              <span className="font-medium text-slate-800">{pendingCount}</span>
            </div>
            {!isRealSession && (
              <div className="flex justify-between">
                <span className="text-slate-500">RAG assignments</span>
                <span className="font-medium text-slate-800">{ragAssignments.length}</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {!isRealSession && currentUser && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Your profile</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-4">
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser.jobTitle}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6 pl-4 border-l border-slate-100">
                <div className="text-center">
                  <p className="text-xl font-semibold text-slate-900">{myRagAssignments.length}</p>
                  <p className="text-[11px] text-slate-500">RAG systems</p>
                </div>
                <div className="text-center">
                  <p className={`text-xl font-semibold ${myLiveAlerts.length > 0 ? "text-red-600" : "text-slate-900"}`}>{myLiveAlerts.length}</p>
                  <p className="text-[11px] text-slate-500">Live alerts</p>
                </div>
                <div className="text-center">
                  <div className="flex justify-center mb-1">
                    <AvatarStack people={myManagers} />
                  </div>
                  <p className="text-[11px] text-slate-500">Managers</p>
                </div>
              </div>
              <Link href={`/team/${currentUser.id}`} className="text-xs text-brand font-medium hover:underline whitespace-nowrap">
                View full profile →
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Invite log</h2>
          <div className="flex items-center gap-2">
            {isRealSession && (
              <div className="relative w-52">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Search invites"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            )}
            {isRealSession && realLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
        </CardHeader>
        {isRealSession && selectedInviteTokens.size > 0 && (
          <div className="px-5 py-2.5 bg-brand/5 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xs text-slate-600">{selectedInviteTokens.size} selected</span>
            <Button size="sm" variant="ghost" onClick={bulkResendSelected} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Resend selected
            </Button>
            <Button size="sm" variant="ghost" onClick={bulkCancelSelected} disabled={bulkBusy} className="text-red-600 hover:bg-red-50">
              {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Cancel selected
            </Button>
            <button onClick={() => setSelectedInviteTokens(new Set())} className="text-xs text-slate-400 hover:text-slate-600 ml-auto">
              Clear
            </button>
          </div>
        )}
        <div className={`divide-y divide-slate-100 ${isRealSession ? "max-h-[22.5rem] overflow-y-auto" : ""}`}>
          {isRealSession
            ? filteredRealInvites.map((inv) => (
                <div key={inv.id} className="px-5 py-3.5 flex items-center gap-3">
                  {inv.status === "pending" && (
                    <input
                      type="checkbox"
                      checked={selectedInviteTokens.has(inv.token)}
                      onChange={() => toggleInviteSelected(inv.token)}
                      className="shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">{inv.email ?? "Open invite link"}</p>
                    <p className="text-xs text-slate-400">Expires {new Date(inv.expires_at).toLocaleDateString("en-GB")}</p>
                  </div>
                  <Badge tone={statusTone[inv.status as InviteStatus] ?? "slate"}>{inv.status}</Badge>
                  <button onClick={() => copyLink(inv.link)} className="text-slate-400 hover:text-brand p-1.5 rounded-md hover:bg-slate-100" title="Copy magic link">
                    <Copy size={14} />
                  </button>
                  {copied === inv.link && <span className="text-[11px] text-emerald-600">Copied</span>}
                  {inv.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => resendReal(inv.token)}>
                        <RotateCcw size={13} /> Resend
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelReal(inv.token)} className="text-red-600 hover:bg-red-50">
                        <XCircle size={13} /> Cancel
                      </Button>
                    </>
                  )}
                </div>
              ))
            : pagedInvites.map((inv) => (
                <div key={inv.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">{inv.email}</p>
                    <p className="text-xs text-slate-400">Sent {timeAgo(inv.sentAt)}</p>
                  </div>
                  <Badge tone={statusTone[inv.status]}>{inv.status}</Badge>
                  <button onClick={() => copyLink(inv.magicLink)} className="text-slate-400 hover:text-brand p-1.5 rounded-md hover:bg-slate-100" title="Copy magic link">
                    <Copy size={14} />
                  </button>
                  {copied === inv.magicLink && <span className="text-[11px] text-emerald-600">Copied</span>}
                  {inv.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => resendInvite(inv.id)}>
                        <RotateCcw size={13} /> Resend
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelInvite(inv.id)} className="text-red-600 hover:bg-red-50">
                        <XCircle size={13} /> Cancel
                      </Button>
                    </>
                  )}
                </div>
              ))}
          {(isRealSession ? filteredRealInvites : invites).length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400 text-center">No invites sent yet.</p>
          )}
        </div>
        {!isRealSession && <Pager page={clampedInvitePage} totalPages={totalInvitePages} onChange={setInvitePage} />}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Team members</h2>
          <div className="flex items-center gap-2">
            {isRealSession && (
              <div className="relative w-52">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team members"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            )}
            {!isRealSession && (
              <>
                <div className="relative w-52">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={mockTeamSearch}
                    onChange={(e) => {
                      setMockTeamSearch(e.target.value);
                      setTeamPage(1);
                    }}
                    placeholder="Search team members"
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                {archivedCount > 0 && (
                  <button
                    onClick={() => {
                      setShowArchived((v) => !v);
                      setTeamPage(1);
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${showArchived ? "border-brand text-brand bg-brand/5" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
                  </button>
                )}
              </>
            )}
            <Badge tone="slate">{memberCount}</Badge>
          </div>
        </CardHeader>
        {!isRealSession && selectedEmployeeIds.size > 0 && (
          <div className="px-5 py-2.5 bg-brand/5 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xs text-slate-600">{selectedEmployeeIds.size} selected</span>
            <Button size="sm" variant="ghost" onClick={() => bulkSetStatus("archived")}>
              Archive selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulkSetStatus("active")}>
              Unarchive selected
            </Button>
            <button onClick={() => setSelectedEmployeeIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600 ml-auto">
              Clear
            </button>
          </div>
        )}
        <div className={`divide-y divide-slate-100 ${isRealSession ? "max-h-[22.5rem] overflow-y-auto" : ""}`}>
          {isRealSession
            ? filteredRealTeam.map((u) => (
                <div key={u.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <Link href={`/team/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={u.name} color="#4f46e5" size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {u.job_title ?? "Team member"} · {u.email}
                      </p>
                    </div>
                  </Link>
                  <Select
                    value={u.team_role}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => changeRealRole(u.id, e.target.value as ApiTeamRole)}
                    className="!w-auto text-xs py-1.5"
                  >
                    {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((r) => (
                      <option key={r} value={r}>
                        {TEAM_ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                  <Badge tone={u.email_verified ? "green" : "amber"}>{u.email_verified ? "Verified" : "Unverified"}</Badge>
                  <Link href={`/team/${u.id}`}>
                    <ChevronRight size={16} className="text-slate-300" />
                  </Link>
                </div>
              ))
            : pagedEmployees.map((u) => {
                const codes = ragAssignments.filter((a) => a.userId === u.id);
                const liveAlerts = liveAlertsFor(u.id);
                const managers = managersFor(u.id);
                const archived = u.status === "archived";
                return (
                  <div
                    key={u.id}
                    className={`px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors ${archived ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.has(u.id)}
                      onChange={() => toggleEmployeeSelected(u.id)}
                      className="shrink-0"
                    />
                    <Link href={`/team/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar name={u.name} color={u.avatarColor} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {u.jobTitle} · {u.email}
                        </p>
                      </div>
                    </Link>
                    {archived && <Badge tone="slate">Archived</Badge>}
                    <Select
                      value={u.teamRole ?? "employee"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setTeamRole(u.id, e.target.value as TeamRole)}
                      className="!w-auto text-xs py-1.5"
                    >
                      {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((r) => (
                        <option key={r} value={r}>
                          {TEAM_ROLE_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                    <div className="flex flex-col items-end gap-0.5 w-24 shrink-0">
                      <Badge tone="indigo">
                        {codes.length} RAG{codes.length === 1 ? "" : "s"}
                      </Badge>
                      <Link href={`/team/${u.id}#assigned-rags`} className="text-[11px] text-brand font-medium hover:underline">
                        View
                      </Link>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 w-24 shrink-0">
                      <Badge tone={liveAlerts.length > 0 ? "red" : "slate"}>
                        {liveAlerts.length} alert{liveAlerts.length === 1 ? "" : "s"}
                      </Badge>
                      <Link href={`/team/${u.id}#alerts-touchpoints`} className="text-[11px] text-brand font-medium hover:underline">
                        View
                      </Link>
                    </div>
                    <div className="w-16 shrink-0 flex justify-center" title="Managers / allocated by">
                      <AvatarStack people={managers} />
                    </div>
                    <Link href={`/team/${u.id}`}>
                      <ChevronRight size={16} className="text-slate-300" />
                    </Link>
                  </div>
                );
              })}
          {(isRealSession ? filteredRealTeam.length === 0 : filteredEmployees.length === 0) && (
            <p className="px-5 py-6 text-sm text-slate-400 text-center">No team members yet.</p>
          )}
        </div>
        {!isRealSession && <Pager page={clampedTeamPage} totalPages={totalTeamPages} onChange={setTeamPage} />}
      </Card>
    </AppShell>
  );
}
