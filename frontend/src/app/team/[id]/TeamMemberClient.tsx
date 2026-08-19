"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  MessageSquare,
  ShieldAlert,
  History as HistoryIcon,
  Activity,
  EyeOff,
  Check,
  Clock3,
  X,
  Phone,
  PhoneCall,
  CalendarDays,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  Bell,
  Users as UsersIcon,
  Plus,
} from "lucide-react";
import type { AlertSeverity, TeamRole, Booking } from "@/lib/types";
import { AlertCaseThread } from "@/components/AlertCaseThread";
import { AlertStageStepper, inferAlertStage } from "@/components/AlertStageStepper";
import { GlobalScopeConfirmModal, RuleHistory, SeverityLegend } from "@/components/AlertRuleGovernance";
import { Tabs } from "@/components/ui/Tabs";
import { severityTone } from "@/components/ui/Badge";
import { apiClient, ApiError, type ApiAlertSeverity, type ApiPersonAlertRule, type ApiTeamNote, type ApiTeamRole, type ApiUserProfile } from "@/lib/apiClient";
import type { AlertRuleScope } from "@/lib/types";
import { canViewConversationContent } from "@/lib/permissions";
import { toIsoDate } from "@/lib/calendar";

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

const WEEK_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 09:00-17:00

function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7; // Monday-first
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDaysToDate(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

const BOOKING_COLORS = [
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
];

function bookingColor(b: Booking) {
  let hash = 0;
  for (const ch of b.title) hash = (hash * 31 + ch.charCodeAt(0)) % BOOKING_COLORS.length;
  return BOOKING_COLORS[hash];
}

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
    bookings: allBookings,
    touchPointRequests: allTouchPointRequests,
    requestTouchPoint,
    acceptTouchPoint,
    declineTouchPoint,
    proposeNewTouchPointTime,
    conversations: allConversations,
    chatMessages: allChatMessages,
    sendChatMessage,
    createGroupConversation,
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

  // --- Client feedback (18/08/2026, second round): Screenshot 1 layout ---
  const [scheduleView, setScheduleView] = useState<"calendar" | "list">("calendar");
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [alertsListOpen, setAlertsListOpen] = useState(false);
  const [touchPointsListOpen, setTouchPointsListOpen] = useState(false);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [requestManagerId, setRequestManagerId] = useState("");
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [respondMode, setRespondMode] = useState<"accept" | "decline" | "counter">("accept");
  const [respondDate, setRespondDate] = useState("");
  const [respondTime, setRespondTime] = useState("10:00");
  const [respondReason, setRespondReason] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTargetId, setComposeTargetId] = useState("");

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
  const today = new Date().toISOString().slice(0, 10);
  const canViewContent = canViewConversationContent(currentUser);

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

  // --- Client feedback (18/08/2026, second round): Screenshot 1 derived data ---
  const isOwnProfile = currentUser?.id === userId;
  const myBookings = allBookings.filter((b) => b.withUserId === userId && !b.cancelled);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToDate(weekCursor, i));
  function bookingsForCell(day: Date, hour: number) {
    const iso = toIsoDate(day);
    return myBookings.filter((b) => b.date === iso && Number(b.time.split(":")[0]) === hour);
  }
  const upcomingBookingsList = [...myBookings].filter((b) => b.date >= today).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const designatedManagers = [...new Set(assignments.map((a) => a.alertOwnerId).filter((x): x is string => !!x))]
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u);

  const upcomingTouchPoints = myBookings
    .filter((b) => b.sourceTouchPointRequestId && b.date >= today)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const pendingIncoming = allTouchPointRequests.filter((r) => r.targetManagerId === userId && r.status === "pending");
  const pendingOutgoing = allTouchPointRequests.filter((r) => r.requesterId === userId && r.status === "pending");

  const myConversations = allConversations
    .filter((c) => c.participantIds.includes(userId))
    .map((c) => {
      const msgs = allChatMessages.filter((m) => m.conversationId === c.id).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
      return { conv: c, lastMessage: msgs[0] };
    })
    .sort((a, b) => ((a.lastMessage?.sentAt ?? "") < (b.lastMessage?.sentAt ?? "") ? 1 : -1));

  function conversationTagFor(c: (typeof allConversations)[number]): { label: string; tone: "indigo" | "red" | "slate" } {
    if (c.relatedRagId) return { label: rags.find((r) => r.id === c.relatedRagId)?.name ?? "RAG", tone: "indigo" };
    if (c.relatedAlertCaseId) return { label: "Alert", tone: "red" };
    return { label: "Direct", tone: "slate" };
  }

  const activeConversation = allConversations.find((c) => c.id === activeConversationId) ?? null;
  const activeMessages = activeConversationId
    ? allChatMessages.filter((m) => m.conversationId === activeConversationId).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
    : [];
  const activeConversationHidden = !!activeConversation?.relatedAlertCaseId && !canViewContent;
  const composeEligibleUsers = users.filter((u) => u.orgId === mockUser?.orgId && u.id !== userId);

  function otherParticipantName(c: (typeof allConversations)[number]) {
    const otherId = c.participantIds.find((id) => id !== userId);
    return users.find((u) => u.id === otherId)?.name ?? c.label;
  }

  function toggleAlertSelected(caseId: string) {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  function sendTouchPointRequest() {
    if (!requestManagerId || selectedAlertIds.size === 0) return;
    requestTouchPoint(userId, requestManagerId, [...selectedAlertIds]);
    setSelectedAlertIds(new Set());
    setRequestManagerId("");
  }

  function openRespond(requestId: string, mode: "accept" | "decline" | "counter") {
    setRespondingRequestId(requestId);
    setRespondMode(mode);
    setRespondDate(today);
    setRespondTime("10:00");
    setRespondReason("");
  }

  function submitRespond() {
    if (!respondingRequestId) return;
    if (respondMode === "accept") acceptTouchPoint(respondingRequestId, respondDate, respondTime);
    else if (respondMode === "decline") declineTouchPoint(respondingRequestId, respondReason.trim() || "No reason given");
    else proposeNewTouchPointTime(respondingRequestId, respondDate, respondTime);
    setRespondingRequestId(null);
  }

  function openConversationWith(targetId: string) {
    const existing = allConversations.find(
      (c) => !c.isGroup && c.participantIds.includes(userId) && c.participantIds.includes(targetId) && c.participantIds.length === 2
    );
    if (existing) {
      setActiveConversationId(existing.id);
      setComposeOpen(false);
      return;
    }
    const targetName = users.find((u) => u.id === targetId)?.name ?? "New conversation";
    const newId = createGroupConversation(targetName, [targetId], userId);
    setActiveConversationId(newId);
    setComposeOpen(false);
  }

  function sendMessage() {
    if (!activeConversationId || !messageDraft.trim()) return;
    sendChatMessage(activeConversationId, currentUser?.id ?? userId, messageDraft.trim());
    setMessageDraft("");
  }

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

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardBody>
            <div className="flex flex-col items-start gap-3">
              <Avatar name={displayName} color={mockUser?.avatarColor ?? "#4f46e5"} size={56} />
              <div>
                <p className="text-lg font-semibold text-slate-900">{displayName}</p>
                <p className="text-sm text-slate-500">{displayEmail}</p>
              </div>
            </div>
            {isRealSession ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
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
                <>
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <Badge tone="indigo">{mockUser.jobTitle}</Badge>
                    <Badge tone="slate">
                      <Globe2 size={11} /> {mockUser.country}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge tone="slate">
                      <Languages size={11} /> {mockUser.language}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge tone={mockUser.twoFactorEnabled ? "green" : "slate"}>2FA {mockUser.twoFactorEnabled ? "on" : "off"}</Badge>
                    <Badge tone={mockUser.ipLockEnabled ? "green" : "slate"}>IP lock {mockUser.ipLockEnabled ? "on" : "off"}</Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600 w-full">
                    {mockUser.mobile && (
                      <div className="flex items-center gap-2.5">
                        <Phone size={14} className="text-slate-400" /> {mockUser.mobile}
                      </div>
                    )}
                    {mockUser.landline && (
                      <div className="flex items-center gap-2.5">
                        <PhoneCall size={14} className="text-slate-400" /> {mockUser.landline}
                      </div>
                    )}
                  </div>
                </>
              )
            )}
            {!isRealSuperAdmin && (
              <div className="mt-4 flex items-center gap-2">
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
            {!isRealSession && lastLogin && (
              <p className="text-xs text-slate-400 mt-4">
                Last seen {timeAgo(lastLogin.loginAt)} · {lastLogin.location}
              </p>
            )}
          </CardBody>
        </Card>

        {!isRealSession && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <CalendarDays size={15} /> Scheduled activities
              </h2>
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs">
                <button
                  onClick={() => setScheduleView("calendar")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${scheduleView === "calendar" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  <CalendarDays size={12} /> Calendar view
                </button>
                <button
                  onClick={() => setScheduleView("list")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${scheduleView === "list" ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  <ListIcon size={12} /> List view
                </button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setWeekCursor((c) => addDaysToDate(c, -7))} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                  <ChevronLeft size={15} />
                </button>
                <p className="text-sm font-medium text-slate-700 w-40">
                  {weekCursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </p>
                <button onClick={() => setWeekCursor((c) => addDaysToDate(c, 7))} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
                  <ChevronRight size={15} />
                </button>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => setWeekCursor(startOfWeek(new Date()))}>
                  Today
                </Button>
              </div>

              {scheduleView === "calendar" ? (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 gap-px bg-slate-100 rounded-lg overflow-hidden min-w-[640px]">
                    <div className="bg-white" />
                    {weekDays.map((d) => (
                      <div key={d.toISOString()} className="bg-white text-center py-1.5">
                        <p className="text-[11px] text-slate-400">{WEEK_DAY_LABELS[(d.getDay() + 6) % 7]}</p>
                        <p className={`text-xs font-medium ${toIsoDate(d) === today ? "text-brand" : "text-slate-700"}`}>{d.getDate()}</p>
                      </div>
                    ))}
                    {WEEK_HOURS.map((hour) => (
                      <Fragment key={hour}>
                        <div className="bg-white text-[10px] text-slate-400 text-right pr-1.5 pt-1">
                          {String(hour).padStart(2, "0")}:00
                        </div>
                        {weekDays.map((d) => (
                          <div key={`${d.toISOString()}-${hour}`} className="bg-white min-h-[2.5rem] p-0.5 space-y-0.5">
                            {bookingsForCell(d, hour).map((b) => (
                              <div key={b.id} className={`text-[10px] leading-tight rounded border px-1 py-0.5 ${bookingColor(b)}`} title={b.title}>
                                <p className="font-medium truncate">{b.time}</p>
                                <p className="truncate">{b.title}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingBookingsList.map((b) => (
                    <div key={b.id} className="py-2.5 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${bookingColor(b).split(" ")[0].replace("100", "500")}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 truncate">{b.title}</p>
                        <p className="text-xs text-slate-400">
                          {b.date} · {b.time}
                        </p>
                      </div>
                    </div>
                  ))}
                  {upcomingBookingsList.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nothing scheduled.</p>}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {!isRealSession && (
        <div id="alerts-touchpoints" className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-3">
                <UsersIcon size={14} /> RAGs
              </p>
              <p className="text-3xl font-semibold text-slate-900">{assignments.length}</p>
              <p className="text-xs text-slate-500 mt-1">RAG systems allocated</p>
              <a
                href="#assigned-rags"
                className="text-xs text-brand font-medium hover:underline mt-3 inline-block"
                onClick={() => document.getElementById("assigned-rags")?.scrollIntoView({ behavior: "smooth" })}
              >
                View all RAGs →
              </a>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Bell size={14} /> Touch Points
                </p>
                {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && <Badge tone="amber">{pendingIncoming.length + pendingOutgoing.length} pending</Badge>}
              </div>
              <p className="text-3xl font-semibold text-slate-900">{upcomingTouchPoints.length}</p>
              <p className="text-xs text-slate-500 mt-1">Upcoming, agreed meetings</p>
              <button onClick={() => setTouchPointsListOpen((v) => !v)} className="text-xs text-brand font-medium hover:underline mt-3">
                {touchPointsListOpen ? "Hide" : "View all touch points →"}
              </button>
              {touchPointsListOpen && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {upcomingTouchPoints.map((b) => (
                    <div key={b.id} className="text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                      <p className="font-medium text-slate-700">{b.title}</p>
                      <p className="text-slate-400">
                        {b.date} · {b.time}
                      </p>
                    </div>
                  ))}
                  {isOwnProfile &&
                    pendingIncoming.map((r) => (
                      <div key={r.id} className="text-xs bg-amber-50 rounded-lg px-2.5 py-2 space-y-1.5">
                        <p className="font-medium text-amber-800">
                          Request from {users.find((u) => u.id === r.requesterId)?.name ?? "someone"} - {r.alertCaseIds.length} alert
                          {r.alertCaseIds.length === 1 ? "" : "s"}
                        </p>
                        {respondingRequestId === r.id ? (
                          <div className="space-y-1.5">
                            <div className="flex gap-1">
                              {(["accept", "decline", "counter"] as const).map((m) => (
                                <button
                                  key={m}
                                  onClick={() => setRespondMode(m)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${respondMode === m ? "bg-brand text-white" : "bg-white border border-slate-200"}`}
                                >
                                  {m === "accept" ? "Accept" : m === "decline" ? "Decline" : "Suggest new time"}
                                </button>
                              ))}
                            </div>
                            {respondMode === "decline" ? (
                              <input
                                value={respondReason}
                                onChange={(e) => setRespondReason(e.target.value)}
                                placeholder="Reason..."
                                className="w-full text-[11px] rounded border border-slate-200 px-1.5 py-1"
                              />
                            ) : (
                              <div className="flex gap-1">
                                <input type="date" value={respondDate} onChange={(e) => setRespondDate(e.target.value)} className="flex-1 text-[11px] rounded border border-slate-200 px-1.5 py-1" />
                                <input type="time" value={respondTime} onChange={(e) => setRespondTime(e.target.value)} className="flex-1 text-[11px] rounded border border-slate-200 px-1.5 py-1" />
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={submitRespond} className="!py-1 !text-[11px]">
                                Confirm
                              </Button>
                              <button onClick={() => setRespondingRequestId(null)} className="text-[11px] text-slate-400">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => openRespond(r.id, "accept")} className="text-[11px] text-brand hover:underline">
                            Respond
                          </button>
                        )}
                      </div>
                    ))}
                  {pendingOutgoing.map((r) => (
                    <div key={r.id} className="text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                      <p className="text-slate-500">
                        Awaiting response from {users.find((u) => u.id === r.targetManagerId)?.name ?? "manager"}
                      </p>
                    </div>
                  ))}
                  {upcomingTouchPoints.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No touch points yet.</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-3">
                <ShieldAlert size={14} /> Alerts
              </p>
              <p className="text-3xl font-semibold text-slate-900">{flaggedCases.length}</p>
              <p className="text-xs text-slate-500 mt-1">Concerns or keywords flagged</p>
              <button onClick={() => setAlertsListOpen((v) => !v)} className="text-xs text-brand font-medium hover:underline mt-3">
                {alertsListOpen ? "Hide" : "View all alerts →"}
              </button>
              {alertsListOpen && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {flaggedCases.map((c) => {
                    const rag = rags.find((r) => r.id === c.ragId);
                    return (
                      <label key={c.id} className="flex items-start gap-2 text-xs bg-slate-50 rounded-lg px-2.5 py-2 cursor-pointer">
                        <input type="checkbox" checked={selectedAlertIds.has(c.id)} onChange={() => toggleAlertSelected(c.id)} className="mt-0.5" />
                        <span className="flex-1">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setOpenRagId(c.ragId);
                              setRecordTab("alerts");
                              document.getElementById("assigned-rags")?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="text-brand font-medium hover:underline"
                          >
                            {rag?.name ?? "Unknown RAG"}
                          </button>
                          <span className="text-slate-500"> - &ldquo;{c.keyword}&rdquo;</span>
                          <Badge tone={severityTone(c.severity)} className="ml-1.5">
                            {c.severity}
                          </Badge>
                        </span>
                      </label>
                    );
                  })}
                  {flaggedCases.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No alerts flagged.</p>}
                  {designatedManagers.length > 0 && (
                    <div className="flex gap-1.5 pt-1">
                      <Select value={requestManagerId} onChange={(e) => setRequestManagerId(e.target.value)} className="!w-auto text-[11px] py-1">
                        <option value="">Request touch point with...</option>
                        {designatedManagers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </Select>
                      <Button size="sm" className="!py-1 !text-[11px]" onClick={sendTouchPointRequest} disabled={!requestManagerId || selectedAlertIds.size === 0}>
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
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
          <Card className="mb-6" id="assigned-rags">
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

      {!isRealSession && (
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <MessageSquare size={15} /> Communications
            </h2>
            <Button size="sm" variant="outline" onClick={() => setComposeOpen((v) => !v)}>
              <Plus size={13} /> New message
            </Button>
          </CardHeader>
          {composeOpen && (
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Select value={composeTargetId} onChange={(e) => setComposeTargetId(e.target.value)} className="!w-auto text-xs py-1.5">
                <option value="">Choose a person...</option>
                {composeEligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={() => composeTargetId && openConversationWith(composeTargetId)} disabled={!composeTargetId}>
                Start
              </Button>
            </div>
          )}
          <div className="grid md:grid-cols-3 min-h-[22rem]">
            <div className="border-r border-slate-100 divide-y divide-slate-100 overflow-y-auto max-h-[26rem]">
              {myConversations.map(({ conv, lastMessage }) => {
                const tag = conversationTagFor(conv);
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${activeConversationId === conv.id ? "bg-indigo-50/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">{otherParticipantName(conv)}</p>
                      <Badge tone={tag.tone}>{tag.label}</Badge>
                    </div>
                    {lastMessage && (
                      <p className="text-xs text-slate-400 truncate mt-1">
                        {lastMessage.text} · {timeAgo(lastMessage.sentAt)}
                      </p>
                    )}
                  </button>
                );
              })}
              {myConversations.length === 0 && <p className="text-sm text-slate-400 text-center py-8 px-4">No conversations yet.</p>}
            </div>
            <div className="md:col-span-2 flex flex-col">
              {activeConversation ? (
                <>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{otherParticipantName(activeConversation)}</p>
                    <Badge tone={conversationTagFor(activeConversation).tone}>{conversationTagFor(activeConversation).label}</Badge>
                  </div>
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[20rem]">
                    {activeConversationHidden ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
                        <EyeOff size={13} className="shrink-0" /> This conversation is about an alert - full text is hidden by default, only a
                        Safeguarding Lead can open it.
                      </div>
                    ) : (
                      activeMessages.map((m) => (
                        <div key={m.id} className={`max-w-[80%] ${m.senderId === userId ? "ml-auto text-right" : ""}`}>
                          <div className={`inline-block rounded-2xl px-3 py-2 text-sm ${m.senderId === userId ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}>
                            {m.text}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(m.sentAt)}</p>
                        </div>
                      ))
                    )}
                    {!activeConversationHidden && activeMessages.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>
                    )}
                  </div>
                  {!activeConversationHidden && (
                    <div className="p-3 border-t border-slate-100 flex gap-2">
                      <input
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <Button onClick={sendMessage} disabled={!messageDraft.trim()}>
                        <Send size={14} />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Select a conversation</div>
              )}
            </div>
          </div>
        </Card>
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
