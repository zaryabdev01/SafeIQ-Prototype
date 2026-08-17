"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { formatDateTime, timeAgo } from "@/lib/format";
import {
  ArrowLeft,
  StickyNote,
  BellRing,
  BrainCircuit,
  Trash2,
  Globe2,
  Languages,
  Loader2,
  Info,
  ListChecks,
  MessageSquare,
  ShieldAlert,
  History as HistoryIcon,
  Activity,
  EyeOff,
  Check,
  Clock3,
  X,
} from "lucide-react";
import type { AlertSeverity, TeamRole } from "@/lib/types";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { AlertStageStepper, inferAlertStage } from "@/components/AlertStageStepper";
import { GlobalScopeConfirmModal, RuleHistory, SeverityLegend } from "@/components/AlertRuleGovernance";
import { Tabs } from "@/components/ui/Tabs";
import { severityTone } from "@/components/ui/Badge";
import { apiClient, ApiError, type ApiAlertSeverity, type ApiPersonAlertRule, type ApiTeamNote, type ApiTeamRole, type ApiUserProfile } from "@/lib/apiClient";
import type { AlertRuleScope } from "@/lib/types";
import { canViewConversationContent } from "@/lib/permissions";

const PRIORITY_ACTION_LABEL: Record<string, string> = {
  low: "Information only",
  medium: "Recommended action",
  high: "Required review",
  urgent: "Urgent action",
};

const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  employee: "Employee",
  manager: "Manager",
  support: "Support",
  administrator: "Administrator",
};

export function TeamMemberClient({ userId }: { userId: string }) {
  const {
    currentUser,
    isRealSession,
    users,
    rags,
    ragAssignments,
    ragQuestions,
    notesByUser,
    personAlertsByUser,
    addNote,
    addPersonAlertRule,
    removePersonAlertRule,
    assignRagToUser,
    setTeamRole,
    loginHistory,
    alertCases,
    alertCaseMessages,
    actions: allActions,
    updateActionStatus,
  } = useApp();

  const mockUser = users.find((u) => u.id === userId);

  const [note, setNote] = useState("");
  const [ruleCategory, setRuleCategory] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState<AlertSeverity>("medium");
  const [ruleScope, setRuleScope] = useState<AlertRuleScope>("employee");
  const [ruleEmail, setRuleEmail] = useState(() => currentUser?.email ?? "");
  const [confirmingGlobalRule, setConfirmingGlobalRule] = useState(false);
  const [openRagId, setOpenRagId] = useState<string | null>(null);
  const [recordTab, setRecordTab] = useState("overview");
  const [assignRagId, setAssignRagId] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [justAssignedCode, setJustAssignedCode] = useState<string | null>(null);

  // --- Real-backend mode (Milestone 4's /team/{id}/notes + /alert-rules - see backend/README.md) ---
  const [realProfile, setRealProfile] = useState<ApiUserProfile | null>(null);
  const [realNotes, setRealNotes] = useState<ApiTeamNote[]>([]);
  const [realRules, setRealRules] = useState<ApiPersonAlertRule[]>([]);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState("");
  const [realBusy, setRealBusy] = useState(false);

  const refreshReal = useCallback(async () => {
    setRealLoading(true);
    setRealError("");
    try {
      const [profile, notesList, rulesList] = await Promise.all([
        apiClient.getTeamMember(userId),
        apiClient.listNotes(userId),
        apiClient.listAlertRules(userId),
      ]);
      setRealProfile(profile);
      setRealNotes(notesList);
      setRealRules(rulesList);
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not load this profile from the SafeIQ API.");
    } finally {
      setRealLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount/id-change; loading flag must flip synchronously
    if (isRealSession) void refreshReal();
  }, [isRealSession, refreshReal]);

  const assignments = useMemo(() => ragAssignments.filter((a) => a.userId === userId), [ragAssignments, userId]);
  const availableRags = rags.filter((r) => r.orgId === mockUser?.orgId && !assignments.some((a) => a.ragId === r.id));

  const displayNotes = useMemo(
    () =>
      isRealSession
        ? realNotes.map((n) => ({ id: n.id, text: n.text, authorName: n.author_name, createdAt: n.created_at }))
        : (notesByUser[userId] ?? []).map((n) => ({ id: n.id, text: n.text, authorName: n.authorName, createdAt: n.createdAt })),
    [isRealSession, realNotes, notesByUser, userId]
  );
  const displayRules = useMemo(
    () =>
      isRealSession
        ? realRules.map((r) => ({
            id: r.id,
            category: r.category,
            severity: r.severity as AlertSeverity,
            notifyEmail: r.notify_email,
            scope: undefined as AlertRuleScope | undefined,
            changeLog: undefined,
          }))
        : (personAlertsByUser[userId] ?? []).map((r) => ({
            id: r.id,
            category: r.category,
            severity: r.severity,
            notifyEmail: r.notifyEmail,
            scope: r.scope,
            changeLog: r.changeLog,
          })),
    [isRealSession, realRules, personAlertsByUser, userId]
  );
  const flaggedCases = useMemo(
    () => alertCases.filter((c) => c.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [alertCases, userId]
  );
  const eligibleOwners = users.filter(
    (u) => u.role === "employee" && u.orgId === mockUser?.orgId && u.id !== userId && u.teamRole && u.teamRole !== "employee"
  );
  const lastLogin = [...loginHistory].filter((l) => l.userId === userId).sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1))[0];
  const orgEmployeeCount = users.filter((u) => u.role === "employee" && u.orgId === mockUser?.orgId).length;

  const myQuestions = useMemo(() => ragQuestions.filter((q) => q.userId === userId), [ragQuestions, userId]);
  const actionsForUser = useMemo(() => allActions.filter((a) => a.assigneeId === userId), [allActions, userId]);
  const openActionsForUser = actionsForUser.filter((a) => a.status !== "completed");
  const today = new Date().toISOString().slice(0, 10);
  const canViewContent = canViewConversationContent(currentUser);
  const lastActivityAt = [...myQuestions, ...flaggedCases]
    .map((x) => ("askedAt" in x ? x.askedAt : x.createdAt))
    .sort()
    .at(-1);

  function ragRiskStatus(ragId: string): { tone: "green" | "amber" | "red"; label: string } {
    const casesForRag = flaggedCases.filter((c) => c.ragId === ragId && c.status === "open");
    const overdueAction = actionsForUser.some((a) => a.ragId === ragId && a.status !== "completed" && a.dueAt && a.dueAt < today);
    if (casesForRag.some((c) => c.severity === "critical" || c.severity === "high")) return { tone: "red", label: "Needs attention" };
    if (casesForRag.length > 0 || overdueAction) return { tone: "amber", label: "Monitor" };
    return { tone: "green", label: "On track" };
  }

  function lastActivityForRag(ragId: string) {
    const dates = myQuestions.filter((q) => q.ragId === ragId).map((q) => q.askedAt);
    return dates.sort().at(-1);
  }

  const openRag = openRagId ? rags.find((r) => r.id === openRagId) : null;
  const casesForOpenRag = openRagId ? flaggedCases.filter((c) => c.ragId === openRagId) : [];
  const questionsForOpenRag = openRagId
    ? myQuestions.filter((q) => q.ragId === openRagId).sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1))
    : [];
  const actionsForOpenRag = openRagId ? actionsForUser.filter((a) => a.ragId === openRagId) : [];

  const overviewTimeline = [
    ...questionsForOpenRag.map((q) => ({
      id: `q-${q.id}`,
      text: `Question asked${q.status === "answered" ? " and answered" : q.status === "escalated" ? " - escalated to an alert" : ""}`,
      at: q.askedAt,
    })),
    ...casesForOpenRag.flatMap((c) => [
      { id: `c-${c.id}-open`, text: `Alert raised - "${c.keyword}" (${c.severity})`, at: c.createdAt },
      ...(c.closedAt ? [{ id: `c-${c.id}-closed`, text: "Alert closed after review", at: c.closedAt }] : []),
    ]),
    ...actionsForOpenRag.map((a) => ({ id: `a-${a.id}`, text: `Action created: ${a.title}`, at: a.createdAt })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));

  const auditLog = [
    ...casesForOpenRag.flatMap((c) => [
      { id: `audit-c-${c.id}-open`, text: `Alert case opened, owner notified (${users.find((u) => u.id === c.ownerId)?.name ?? "Unknown"})`, at: c.createdAt },
      ...(c.closedAt ? [{ id: `audit-c-${c.id}-closed`, text: `Alert case closed by ${c.closedBy ? (users.find((u) => u.id === c.closedBy)?.name ?? "Unknown") : "a manager"}`, at: c.closedAt }] : []),
    ]),
    ...actionsForOpenRag.map((a) => ({ id: `audit-a-${a.id}`, text: `Action created and assigned to ${mockUser?.name ?? "this person"}`, at: a.createdAt })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));

  if (!isRealSession && !mockUser) return notFound();
  if (isRealSession && !realLoading && !realProfile && realError) {
    return (
      <AppShell title="Team member" subtitle="">
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{realError}</p>
      </AppShell>
    );
  }

  const displayUser = isRealSession ? realProfile : mockUser;
  if (!displayUser) {
    return (
      <AppShell title="Team member" subtitle="">
        <div className="flex items-center gap-2 text-sm text-slate-500 py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      </AppShell>
    );
  }

  const displayName = "name" in displayUser ? displayUser.name : "";
  const displayEmail = "email" in displayUser ? displayUser.email : "";
  const displayJobTitle = isRealSession ? (realProfile?.job_title ?? "Team member") : mockUser?.jobTitle;
  const displayRole: TeamRole = isRealSession ? ((realProfile?.team_role as TeamRole) ?? "employee") : (mockUser?.teamRole ?? "employee");
  const isRealSuperAdmin = isRealSession && realProfile?.team_role === "super_admin";

  function submitNote() {
    if (!note.trim()) return;
    if (isRealSession) {
      setRealBusy(true);
      apiClient
        .createNote(userId, note.trim())
        .then((created) => {
          setRealNotes((prev) => [created, ...prev]);
          setNote("");
        })
        .catch((err) => setRealError(err instanceof ApiError ? err.message : "Could not add that note."))
        .finally(() => setRealBusy(false));
      return;
    }
    addNote(userId, note.trim());
    setNote("");
  }

  function submitRule() {
    if (!ruleCategory.trim() || (isRealSession && !ruleEmail.trim())) return;
    if (isRealSession) {
      setRealBusy(true);
      apiClient
        .createAlertRule(userId, { category: ruleCategory.trim(), severity: ruleSeverity as ApiAlertSeverity, notify_email: ruleEmail.trim() })
        .then((created) => {
          setRealRules((prev) => [created, ...prev]);
          setRuleCategory("");
        })
        .catch((err) => setRealError(err instanceof ApiError ? err.message : "Could not add that alert rule."))
        .finally(() => setRealBusy(false));
      return;
    }
    if (ruleScope === "global") {
      setConfirmingGlobalRule(true);
      return;
    }
    createRule();
  }

  function createRule() {
    addPersonAlertRule(userId, {
      category: ruleCategory.trim(),
      severity: ruleSeverity,
      notifyEmail: "morgan.ellis@brightcare.co.uk",
      scope: ruleScope,
    });
    setRuleCategory("");
    setConfirmingGlobalRule(false);
  }

  function deleteRule(ruleId: string) {
    if (isRealSession) {
      apiClient
        .deleteAlertRule(userId, ruleId)
        .then(() => setRealRules((prev) => prev.filter((r) => r.id !== ruleId)))
        .catch((err) => setRealError(err instanceof ApiError ? err.message : "Could not remove that alert rule."));
      return;
    }
    removePersonAlertRule(userId, ruleId);
  }

  function changeRole(role: TeamRole) {
    if (isRealSession) {
      apiClient
        .updateRole(userId, role as ApiTeamRole)
        .then((updated) => setRealProfile(updated))
        .catch((err) => setRealError(err instanceof ApiError ? err.message : "Could not change that person's role."));
      return;
    }
    setTeamRole(userId, role);
  }

  function assign() {
    if (!assignRagId || !assignOwnerId) return;
    const code = assignRagToUser(assignRagId, userId, assignOwnerId);
    setJustAssignedCode(code);
    setAssignRagId("");
    setAssignOwnerId("");
  }

  return (
    <AppShell title={displayName} subtitle={displayJobTitle ?? undefined}>
      <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to team
      </Link>

      {isRealSession && realError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{realError}</p>}

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-4">
          <Avatar name={displayName} color={mockUser?.avatarColor ?? "#4f46e5"} size={56} />
          <div className="flex-1 min-w-[200px]">
            <p className="text-lg font-semibold text-slate-900">{displayName}</p>
            <p className="text-sm text-slate-500">{displayEmail}</p>
            {isRealSession ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Badge tone={realProfile?.email_verified ? "green" : "amber"}>{realProfile?.email_verified ? "Verified" : "Unverified"}</Badge>
                <Badge tone="indigo">KYC {realProfile?.kyc_status}</Badge>
                {realProfile?.country && (
                  <Badge tone="slate">
                    <Globe2 size={11} /> {realProfile.country}
                  </Badge>
                )}
                {realProfile?.language && (
                  <Badge tone="slate">
                    <Languages size={11} /> {realProfile.language}
                  </Badge>
                )}
              </div>
            ) : (
              mockUser && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge tone="indigo">{mockUser.jobTitle}</Badge>
                  <Badge tone="slate">
                    <Globe2 size={11} /> {mockUser.country}
                  </Badge>
                  <Badge tone="slate">
                    <Languages size={11} /> {mockUser.language}
                  </Badge>
                  <Badge tone={mockUser.twoFactorEnabled ? "green" : "slate"}>2FA {mockUser.twoFactorEnabled ? "on" : "off"}</Badge>
                  <Badge tone={mockUser.ipLockEnabled ? "green" : "slate"}>IP lock {mockUser.ipLockEnabled ? "on" : "off"}</Badge>
                </div>
              )
            )}
            {!isRealSuperAdmin && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Account type</span>
                <Select value={displayRole} onChange={(e) => changeRole(e.target.value as TeamRole)} className="!w-auto text-xs py-1.5">
                  {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((r) => (
                    <option key={r} value={r}>
                      {TEAM_ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          {!isRealSession && (
            <div className="text-xs text-slate-500 text-right space-y-0.5">
              {lastLogin && <p>Last seen {timeAgo(lastLogin.loginAt)}</p>}
              {lastLogin && <p>{lastLogin.location}</p>}
              <p>
                {assignments.length} RAG{assignments.length === 1 ? "" : "s"} assigned · {openActionsForUser.length} open item
                {openActionsForUser.length === 1 ? "" : "s"}
                {lastActivityAt && ` · last activity ${timeAgo(lastActivityAt)}`}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {!isRealSession && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Assigned RAGs", value: assignments.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50" },
            { label: "Conversations", value: myQuestions.length, icon: MessageSquare, tone: "text-teal-600 bg-teal-50" },
            { label: "Alerts", value: flaggedCases.length, icon: ShieldAlert, tone: "text-red-600 bg-red-50" },
            { label: "Open actions", value: openActionsForUser.length, icon: ListChecks, tone: "text-indigo-600 bg-indigo-50" },
          ].map((s) => (
            <Card key={s.label}>
              <CardBody className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.tone}`}>
                  <s.icon size={16} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900 leading-none">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <StickyNote size={15} /> Notes
            </h2>
            {isRealSession && realLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </CardHeader>
          <CardBody>
            <div className="flex gap-2 mb-4">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about this person..." onKeyDown={(e) => e.key === "Enter" && submitNote()} />
              <Button onClick={submitNote} disabled={isRealSession && realBusy}>
                {isRealSession && realBusy ? <Loader2 size={13} className="animate-spin" /> : "Add"}
              </Button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {displayNotes.map((n) => (
                <div key={n.id} className="text-sm bg-slate-50 rounded-lg px-3 py-2.5">
                  <p className="text-slate-700">{n.text}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {n.authorName} · {timeAgo(n.createdAt)}
                  </p>
                </div>
              ))}
              {displayNotes.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No notes yet.</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BellRing size={15} /> Custom alert rules
            </h2>
          </CardHeader>
          <CardBody>
            <details className="mb-3">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">What does each severity do?</summary>
              <div className="pt-2">
                <SeverityLegend />
              </div>
            </details>
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)} placeholder="e.g. Missed check-in" className="flex-1" />
                <Select value={ruleSeverity} onChange={(e) => setRuleSeverity(e.target.value as AlertSeverity)} className="!w-auto">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
                <Button onClick={submitRule} disabled={isRealSession && realBusy}>
                  {isRealSession && realBusy ? <Loader2 size={13} className="animate-spin" /> : "Add"}
                </Button>
              </div>
              {isRealSession && (
                <Input value={ruleEmail} onChange={(e) => setRuleEmail(e.target.value)} placeholder="Notify email address" className="text-xs" />
              )}
              {!isRealSession && (
                <Select value={ruleScope} onChange={(e) => setRuleScope(e.target.value as AlertRuleScope)} className="!w-auto text-xs">
                  <option value="employee">Scope: this employee only</option>
                  <option value="global">Scope: organisation-wide (global)</option>
                </Select>
              )}
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {displayRules.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-800">{r.category}</p>
                      <p className="text-[11px] text-slate-400">Notifies {r.notifyEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.scope && <Badge tone={r.scope === "global" ? "indigo" : "slate"}>{r.scope === "global" ? "Global" : "Employee-only"}</Badge>}
                      <Badge tone={severityTone(r.severity)}>{r.severity}</Badge>
                      <button onClick={() => deleteRule(r.id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {!isRealSession && <RuleHistory entries={r.changeLog} />}
                </div>
              ))}
              {displayRules.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No custom alert rules set for this person.</p>}
            </div>
          </CardBody>
        </Card>
      </div>

      {isRealSession ? (
        <Card>
          <CardBody className="flex items-start gap-2.5 text-xs text-slate-500">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              Keyword-flagged alerts and RAG assignments aren&apos;t available on the real backend yet - they depend on the RAG engine
              (Milestone 5), which hasn&apos;t been built. Notes and custom alert rules above are fully real.
            </span>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <BrainCircuit size={15} /> Assigned RAG systems
              </h2>
              {availableRags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={assignRagId} onChange={(e) => setAssignRagId(e.target.value)} className="!w-auto text-xs py-1.5">
                    <option value="">Assign a RAG...</option>
                    {availableRags.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  <Select value={assignOwnerId} onChange={(e) => setAssignOwnerId(e.target.value)} className="!w-auto text-xs py-1.5">
                    <option value="">Who recovers their alerts?</option>
                    {eligibleOwners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({TEAM_ROLE_LABEL[o.teamRole ?? "employee"]})
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={assign} disabled={!assignRagId || !assignOwnerId}>
                    Assign
                  </Button>
                </div>
              )}
            </CardHeader>
            {justAssignedCode && (
              <div className="mx-5 mt-4 rounded-lg bg-emerald-50 text-emerald-700 text-xs px-3 py-2.5">
                Assigned. Unique access code: <span className="font-mono font-semibold">{justAssignedCode}</span>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
              {assignments.map((a) => {
                const rag = rags.find((r) => r.id === a.ragId);
                if (!rag) return null;
                const status = ragRiskStatus(a.ragId);
                const lastAct = lastActivityForRag(a.ragId);
                const isOpen = openRagId === a.ragId;
                return (
                  <button
                    key={a.ragId}
                    onClick={() => {
                      setOpenRagId(isOpen ? null : a.ragId);
                      setRecordTab("overview");
                    }}
                    className={`text-left rounded-lg border px-3.5 py-3 transition-colors ${isOpen ? "border-brand bg-indigo-50/40" : "border-slate-200 hover:border-brand"}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                      <p className="text-sm font-medium text-slate-800 truncate flex-1">{rag.name}</p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <p className="text-xs text-slate-400 mt-1.5">{lastAct ? `Last used ${timeAgo(lastAct)}` : "No activity yet"}</p>
                  </button>
                );
              })}
              {assignments.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6 sm:col-span-2 lg:col-span-3">No RAG systems assigned to this person yet.</p>
              )}
            </div>
          </Card>

          {openRag && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: openRag.colorTag }} />
                  {openRag.name} - {displayName}
                </h2>
                <button onClick={() => setOpenRagId(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
                  <X size={16} />
                </button>
              </CardHeader>
              <div className="px-5">
                <Tabs
                  tabs={[
                    { key: "overview", label: "Overview" },
                    { key: "conversations", label: "Conversations", count: questionsForOpenRag.length },
                    { key: "alerts", label: "Alerts & Signals", count: casesForOpenRag.length },
                    { key: "actions", label: "Actions", count: actionsForOpenRag.length },
                    { key: "audit", label: "Audit Log" },
                  ]}
                  active={recordTab}
                  onChange={setRecordTab}
                />
              </div>

              {recordTab === "overview" && (
                <CardBody className="space-y-2">
                  {overviewTimeline.map((e) => (
                    <div key={e.id} className="flex items-start gap-2.5 text-sm">
                      <Activity size={13} className="text-slate-300 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-slate-700">{e.text}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(e.at)}</p>
                      </div>
                    </div>
                  ))}
                  {overviewTimeline.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No activity recorded yet.</p>}
                </CardBody>
              )}

              {recordTab === "conversations" && (
                <CardBody className="space-y-2">
                  {!canViewContent && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5 mb-2">
                      <EyeOff size={13} className="shrink-0" /> Full conversation text is hidden by default - only a Safeguarding Lead can open it.
                    </div>
                  )}
                  {questionsForOpenRag.map((q) => {
                    const linkedCase = casesForOpenRag.find((c) => c.questionId === q.id);
                    return (
                      <div key={q.id} className="rounded-lg border border-slate-200 px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-slate-800 truncate">{canViewContent ? q.text : `Question asked ${timeAgo(q.askedAt)}`}</p>
                          <Badge tone={q.status === "answered" ? "green" : q.status === "escalated" ? "red" : "amber"}>{q.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                          <span>{formatDateTime(q.askedAt)}</span>
                          {linkedCase && (
                            <Badge tone={severityTone(linkedCase.severity)}>
                              {linkedCase.severity} risk
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {questionsForOpenRag.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No conversations yet.</p>}
                </CardBody>
              )}

              {recordTab === "alerts" && (
                <CardBody className="space-y-4">
                  {casesForOpenRag.map((c) => {
                    const hasMessages = alertCaseMessages.some((m) => m.caseId === c.id);
                    return (
                      <div key={c.id} className="space-y-2">
                        <AlertStageStepper stage={inferAlertStage(c, hasMessages)} />
                        {c.context && (
                          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                            <span className="font-medium text-slate-600">Context: </span>
                            {c.context}
                          </p>
                        )}
                        <AlertCaseThread caseItem={c} canClose={true} currentUserId={currentUser?.id ?? "u-admin"} />
                      </div>
                    );
                  })}
                  {casesForOpenRag.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No alerts & signals for this RAG.</p>}
                </CardBody>
              )}

              {recordTab === "actions" && (
                <CardBody className="space-y-2">
                  {actionsForOpenRag.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 truncate">{a.title}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock3 size={10} /> {a.dueAt ? `Due ${a.dueAt}` : "No due date"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone={a.priority === "urgent" || a.priority === "high" ? "red" : a.priority === "medium" ? "amber" : "slate"}>
                          {PRIORITY_ACTION_LABEL[a.priority]}
                        </Badge>
                        {a.status === "completed" ? (
                          <Badge tone="green">Completed</Badge>
                        ) : (
                          <button onClick={() => updateActionStatus(a.id, "completed")} className="text-xs text-brand hover:underline flex items-center gap-1">
                            <Check size={12} /> Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {actionsForOpenRag.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No actions for this RAG.</p>}
                </CardBody>
              )}

              {recordTab === "audit" && (
                <CardBody className="space-y-2">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-2">
                    <HistoryIcon size={13} /> System and process events only - not conversation content.
                  </p>
                  {auditLog.map((e) => (
                    <div key={e.id} className="flex items-start gap-2.5 text-sm">
                      <HistoryIcon size={13} className="text-slate-300 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-slate-700">{e.text}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(e.at)}</p>
                      </div>
                    </div>
                  ))}
                  {auditLog.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No audit events yet.</p>}
                </CardBody>
              )}
            </Card>
          )}
        </>
      )}

      <GlobalScopeConfirmModal
        open={confirmingGlobalRule}
        onClose={() => setConfirmingGlobalRule(false)}
        onConfirm={createRule}
        affectedLabel={`${orgEmployeeCount} employee account${orgEmployeeCount === 1 ? "" : "s"}`}
      />
    </AppShell>
  );
}
