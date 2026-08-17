"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import {
  BrainCircuit,
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  FileWarning,
  FileSearch,
  Siren,
  ListChecks,
  HelpCircle,
  CalendarClock,
  Activity,
  Clock,
} from "lucide-react";
import type { Action, ActionPriority, AlertSeverity } from "@/lib/types";

const PRIORITY_TONE: Record<ActionPriority, "red" | "amber" | "slate"> = {
  urgent: "red",
  high: "red",
  medium: "amber",
  low: "slate",
};

type AttentionKind = "alert" | "action" | "question" | "rag_update";
type AttentionTab = "all" | "critical" | "alerts" | "actions" | "questions" | "rag_updates";

type AttentionItem = {
  id: string;
  kind: AttentionKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  createdAt: string;
  href: string;
};

const ATTENTION_TABS: { key: AttentionTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "alerts", label: "Alerts" },
  { key: "actions", label: "Actions" },
  { key: "questions", label: "Questions" },
  { key: "rag_updates", label: "RAG Updates" },
];

const KIND_LABEL: Record<AttentionKind, string> = { alert: "Alert", action: "Action", question: "Question", rag_update: "RAG update" };
const KIND_TAB: Record<AttentionKind, AttentionTab> = { alert: "alerts", action: "actions", question: "questions", rag_update: "rag_updates" };

export default function DashboardPage() {
  const {
    currentUser,
    rags: allRags,
    users: allUsers,
    ragQuestions: allRagQuestions,
    dashboardAlerts: allDashboardAlerts,
    answerQuestion,
    markAlertRead,
    alertCases: allAlertCases,
    alertCaseMessages,
    incidents: allIncidents,
    emergencyEvents: allEmergencyEvents,
    bookings: allBookings,
    actions: allActions,
    updateActionStatus,
    ragAssignments: allRagAssignments,
  } = useApp();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const rags = useMemo(
    () => allRags.filter((r) => r.orgId === currentUser?.orgId || r.sharedWithOrgIds?.includes(currentUser?.orgId ?? "")),
    [allRags, currentUser]
  );
  const users = useMemo(() => allUsers.filter((u) => u.orgId === currentUser?.orgId), [allUsers, currentUser]);
  const ragQuestions = useMemo(() => {
    const ragIds = new Set(rags.map((r) => r.id));
    return allRagQuestions.filter((q) => ragIds.has(q.ragId));
  }, [allRagQuestions, rags]);
  const dashboardAlerts = useMemo(
    () => allDashboardAlerts.filter((a) => a.orgId === currentUser?.orgId),
    [allDashboardAlerts, currentUser]
  );
  const orgCases = useMemo(() => allAlertCases.filter((c) => c.orgId === currentUser?.orgId), [allAlertCases, currentUser]);
  const incidents = useMemo(() => allIncidents.filter((i) => i.orgId === currentUser?.orgId), [allIncidents, currentUser]);
  const emergencyEvents = useMemo(
    () => allEmergencyEvents.filter((e) => e.orgId === currentUser?.orgId),
    [allEmergencyEvents, currentUser]
  );
  const bookings = useMemo(() => allBookings.filter((b) => b.orgId === currentUser?.orgId && !b.cancelled), [allBookings, currentUser]);
  const actions = useMemo(() => allActions.filter((a) => a.orgId === currentUser?.orgId), [allActions, currentUser]);
  const ragAssignments = useMemo(() => {
    const ragIds = new Set(rags.map((r) => r.id));
    return allRagAssignments.filter((a) => ragIds.has(a.ragId));
  }, [allRagAssignments, rags]);

  const [qSearch, setQSearch] = useState("");
  const [qRagFilter, setQRagFilter] = useState("");
  const [qDateFilter, setQDateFilter] = useState("");
  const [attentionTab, setAttentionTab] = useState<AttentionTab>("all");
  const [attentionSeverity, setAttentionSeverity] = useState<AlertSeverity | null>(null);

  const unreadAlerts = dashboardAlerts.filter((a) => !a.read).length;

  const filteredQuestions = useMemo(() => {
    return ragQuestions
      .filter((q) => {
        if (qSearch.trim() && !q.text.toLowerCase().includes(qSearch.trim().toLowerCase())) return false;
        if (qRagFilter && q.ragId !== qRagFilter) return false;
        if (qDateFilter && !q.askedAt.startsWith(qDateFilter)) return false;
        return true;
      })
      .sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1));
  }, [ragQuestions, qSearch, qRagFilter, qDateFilter]);

  const sortedAlerts = useMemo(() => [...dashboardAlerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [dashboardAlerts]);

  function userName(userId: string) {
    return users.find((u) => u.id === userId)?.name ?? "Unknown";
  }
  function ragName(ragId?: string) {
    return ragId ? (rags.find((r) => r.id === ragId)?.name ?? "Unknown RAG") : "-";
  }

  function submitReply(questionId: string) {
    if (!replyText.trim()) return;
    answerQuestion(questionId, replyText.trim());
    setReplyFor(null);
    setReplyText("");
  }

  const today = new Date().toISOString().slice(0, 10);
  const ragsOutOfDate = rags.filter((r) => r.documents.some((d) => d.reviewDate && d.reviewDate < today));
  const newAlertCount = orgCases.filter((c) => c.status === "open" && alertCaseMessages.filter((m) => m.caseId === c.id).length <= 1).length;
  const activeEmergencies = emergencyEvents.filter((e) => e.status === "new" || e.status === "active").length;
  const activeIncidents = incidents.filter((i) => i.status === "open").length;
  const openActions = actions.filter((a) => a.status !== "completed");
  const pendingQuestions = ragQuestions.filter((q) => q.status === "pending");
  const publishedRags = rags.filter((r) => r.status === "published");

  const stats = [
    { label: "Team members", value: users.filter((u) => u.role === "employee").length, icon: Users, tone: "text-teal-600 bg-teal-50", href: "/team" },
    { label: "Active RAG systems", value: publishedRags.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50", href: "/rag" },
    { label: "New alerts", value: newAlertCount, icon: AlertTriangle, tone: "text-red-600 bg-red-50", href: "#alerts-panel" },
    { label: "Open actions", value: openActions.length, icon: ListChecks, tone: "text-indigo-600 bg-indigo-50", href: "#open-actions" },
    { label: "Questions pending", value: pendingQuestions.length, icon: HelpCircle, tone: "text-amber-600 bg-amber-50", href: "#live-questions" },
    { label: "Emergencies", value: activeEmergencies, caption: `${emergencyEvents.length} total`, icon: Siren, tone: "text-red-600 bg-red-50", href: "/emergencies" },
    { label: "Incidents", value: activeIncidents, caption: `${incidents.length} total`, icon: FileSearch, tone: "text-slate-600 bg-slate-100", href: "/incidents" },
    { label: "RAGs need updating", value: ragsOutOfDate.length, icon: FileWarning, tone: "text-amber-600 bg-amber-50", href: "/rag" },
  ];

  const criticalAlertCount = dashboardAlerts.filter((a) => !a.read && a.severity === "critical").length;
  const highRiskAlertCount = dashboardAlerts.filter((a) => !a.read && a.severity === "high").length;
  const overdueActionsCount = openActions.filter((a) => a.dueAt && a.dueAt < today).length;
  const attentionTotal = criticalAlertCount + highRiskAlertCount + overdueActionsCount + pendingQuestions.length;

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    dashboardAlerts
      .filter((a) => !a.read)
      .forEach((a) => items.push({ id: `alert-${a.id}`, kind: "alert", severity: a.severity, title: a.title, detail: a.detail, createdAt: a.createdAt, href: "#alerts-panel" }));
    openActions.forEach((a) =>
      items.push({
        id: `action-${a.id}`,
        kind: "action",
        severity: a.priority === "urgent" ? "critical" : a.priority === "high" ? "high" : a.priority === "medium" ? "medium" : "low",
        title: a.title,
        detail: `Assigned to ${userName(a.assigneeId)}${a.dueAt ? ` · due ${a.dueAt}` : ""}`,
        createdAt: a.createdAt,
        href: "#open-actions",
      })
    );
    pendingQuestions.forEach((q) =>
      items.push({
        id: `question-${q.id}`,
        kind: "question",
        severity: "medium",
        title: `New question in ${ragName(q.ragId)}`,
        detail: q.text,
        createdAt: q.askedAt,
        href: "#live-questions",
      })
    );
    ragsOutOfDate.forEach((r) =>
      items.push({
        id: `rag-${r.id}`,
        kind: "rag_update",
        severity: "medium",
        title: `${r.name} has documents due for review`,
        detail: `${r.documents.filter((d) => d.reviewDate && d.reviewDate < today).length} document(s) overdue`,
        createdAt: today,
        href: `/rag/${r.id}`,
      })
    );
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardAlerts, openActions, pendingQuestions, ragsOutOfDate, today]);

  const visibleAttentionItems = attentionItems.filter((item) => {
    if (attentionSeverity) return item.severity === attentionSeverity;
    if (attentionTab === "all") return true;
    if (attentionTab === "critical") return item.severity === "critical";
    return KIND_TAB[item.kind] === attentionTab;
  });

  function selectTab(tab: AttentionTab) {
    setAttentionTab(tab);
    setAttentionSeverity(null);
  }

  const teamActivity = useMemo(() => {
    type ActivityItem = { id: string; text: string; at: string };
    const items: ActivityItem[] = [];
    ragQuestions.forEach((q) => items.push({ id: `q-${q.id}`, text: `${userName(q.userId)} asked a question in ${ragName(q.ragId)}`, at: q.askedAt }));
    orgCases.forEach((c) => {
      items.push({ id: `c-open-${c.id}`, text: `Alert case opened for ${userName(c.userId)} in ${ragName(c.ragId)}`, at: c.createdAt });
      if (c.closedAt) items.push({ id: `c-closed-${c.id}`, text: `Alert case closed by ${c.closedBy ? userName(c.closedBy) : "a manager"}`, at: c.closedAt });
    });
    actions.forEach((a) => items.push({ id: `a-${a.id}`, text: `Action created: ${a.title}`, at: a.createdAt }));
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ragQuestions, orgCases, actions]);

  const upcomingAppointments = useMemo(
    () =>
      bookings
        .filter((b) => b.date >= today)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 6),
    [bookings, today]
  );

  const ragOverview = useMemo(
    () =>
      rags.map((r) => ({
        rag: r,
        people: ragAssignments.filter((a) => a.ragId === r.id).length,
        conversations: ragQuestions.filter((q) => q.ragId === r.id).length,
        alerts: orgCases.filter((c) => c.ragId === r.id).length,
        openActions: actions.filter((a) => a.ragId === r.id && a.status !== "completed").length,
        pending: ragQuestions.filter((q) => q.ragId === r.id && q.status === "pending").length,
      })),
    [rags, ragAssignments, ragQuestions, orgCases, actions]
  );

  return (
    <AppShell title="Dashboard" subtitle="Live overview across every RAG you manage">
      {attentionTotal > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-3.5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-800">{attentionTotal} items need your attention</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  selectTab("all");
                  setAttentionSeverity("critical");
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-red-200 text-red-700 hover:bg-red-50"
              >
                Critical ({criticalAlertCount})
              </button>
              <button
                onClick={() => {
                  selectTab("all");
                  setAttentionSeverity("high");
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                High risk ({highRiskAlertCount})
              </button>
              <button onClick={() => selectTab("actions")} className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                Overdue actions ({overdueActionsCount})
              </button>
              <button onClick={() => selectTab("questions")} className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
                Questions pending ({pendingQuestions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-brand transition-colors h-full">
              <CardBody className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.tone}`}>
                  <s.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-slate-900 leading-none">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{s.label}</p>
                  {s.caption && <p className="text-[10px] text-slate-400">{s.caption}</p>}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {upcomingAppointments.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <CalendarClock size={15} /> Upcoming appointments
            </h2>
            <Link href="/calendar" className="text-xs text-brand hover:underline">
              Open calendar
            </Link>
          </CardHeader>
          <div className="flex gap-3 overflow-x-auto px-5 py-4">
            {upcomingAppointments.map((b) => (
              <div key={b.id} className="shrink-0 w-52 rounded-lg border border-slate-200 px-3.5 py-3">
                <p className="text-xs text-slate-400">{b.date} · {b.time}</p>
                <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{b.title}</p>
                <p className="text-xs text-slate-500 truncate">with {userName(b.withUserId)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-800">Requires your attention</h2>
          <Badge tone="slate">{visibleAttentionItems.length} shown</Badge>
        </CardHeader>
        <div className="flex items-center gap-1 px-5 pt-3 pb-1 border-b border-slate-100 flex-wrap">
          {ATTENTION_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                attentionTab === t.key && !attentionSeverity ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {visibleAttentionItems.map((item) => (
            <Link key={item.id} href={item.href} className="block px-5 py-3 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge tone="slate">{KIND_LABEL[item.kind]}</Badge>
                  <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{item.detail}</p>
            </Link>
          ))}
          {visibleAttentionItems.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">Nothing needs attention here.</p>}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card id="live-questions">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Live questions - all RAGs</h2>
              <Badge tone="slate">{filteredQuestions.length} shown</Badge>
            </CardHeader>
            <CardBody className="pb-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="Search questions..." className="pl-8" />
                </div>
                <Select value={qRagFilter} onChange={(e) => setQRagFilter(e.target.value)} className="sm:w-52">
                  <option value="">All RAGs</option>
                  {rags.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <Input type="date" value={qDateFilter} onChange={(e) => setQDateFilter(e.target.value)} className="sm:w-44" />
              </div>
            </CardBody>
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {filteredQuestions.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{q.text}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="font-medium text-slate-600">{userName(q.userId)}</span> · {ragName(q.ragId)} · {timeAgo(q.askedAt)}
                      </p>
                    </div>
                    <Badge tone={q.status === "answered" ? "green" : q.status === "escalated" ? "red" : "amber"}>{q.status}</Badge>
                  </div>
                  {q.answer && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">{q.answer}</p>}
                  {q.status !== "answered" && (
                    <div className="mt-2">
                      {replyFor === q.id ? (
                        <div className="space-y-2">
                          <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Type the answer to send back..." />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => submitReply(q.id)}>
                              Send answer
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setReplyFor(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setReplyFor(q.id)}>
                          Answer now
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredQuestions.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No questions match these filters.</p>}
            </div>
          </Card>

          <Card id="open-actions">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ListChecks size={15} /> Open actions
              </h2>
              <Badge tone="slate">{openActions.length}</Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">Action</th>
                    <th className="px-5 py-2.5 font-medium">Employee</th>
                    <th className="px-5 py-2.5 font-medium">RAG</th>
                    <th className="px-5 py-2.5 font-medium">Priority</th>
                    <th className="px-5 py-2.5 font-medium">Due</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {actions.map((a: Action) => {
                    const overdue = a.status !== "completed" && !!a.dueAt && a.dueAt < today;
                    return (
                      <tr key={a.id}>
                        <td className="px-5 py-3 text-slate-800">{a.title}</td>
                        <td className="px-5 py-3 text-slate-600">{userName(a.assigneeId)}</td>
                        <td className="px-5 py-3 text-slate-500">{ragName(a.ragId)}</td>
                        <td className="px-5 py-3">
                          <Badge tone={PRIORITY_TONE[a.priority]}>{a.priority}</Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {a.dueAt ?? "-"} {overdue && <span className="text-red-600 font-medium">Overdue</span>}
                        </td>
                        <td className="px-5 py-3">
                          {a.status === "completed" ? (
                            <Badge tone="green">Completed</Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge tone={a.status === "in_progress" ? "indigo" : "slate"}>{a.status === "in_progress" ? "In progress" : "Open"}</Badge>
                              <button onClick={() => updateActionStatus(a.id, "completed")} className="text-xs text-brand hover:underline">
                                Mark complete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {actions.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No actions yet.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="alerts-panel">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Alerts</h2>
              <Badge tone="red">{unreadAlerts} new</Badge>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {sortedAlerts.map((a) => (
                <button key={a.id} onClick={() => markAlertRead(a.id)} className={`w-full text-left px-5 py-3.5 hover:bg-slate-50 ${!a.read ? "bg-red-50/30" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                    <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{a.detail}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {a.read && <CheckCircle2 size={11} className="text-emerald-500" />}
                    <p className="text-[11px] text-slate-400">{timeAgo(a.createdAt)}</p>
                  </div>
                </button>
              ))}
              {sortedAlerts.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No alerts yet.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity size={15} /> Team activity
              </h2>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {teamActivity.map((item) => (
                <div key={item.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700">{item.text}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {timeAgo(item.at)}
                  </p>
                </div>
              ))}
              {teamActivity.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No recent activity.</p>}
            </div>
          </Card>
        </div>
      </div>

      {ragOverview.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BrainCircuit size={15} /> RAG system overview
            </h2>
          </CardHeader>
          <div className="flex gap-3 overflow-x-auto px-5 py-4">
            {ragOverview.map(({ rag, people, conversations, alerts, openActions: ragOpenActions, pending }) => (
              <Link key={rag.id} href={`/rag/${rag.id}`} className="shrink-0 w-56 rounded-lg border border-slate-200 px-3.5 py-3 hover:border-brand transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                  <p className="text-sm font-medium text-slate-800 truncate">{rag.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-500">
                  <span>{people} people</span>
                  <span>{conversations} conversations</span>
                  <span>{alerts} alerts</span>
                  <span>{ragOpenActions} actions</span>
                </div>
                {pending > 0 && (
                  <Badge tone="amber" className="mt-2">
                    {pending} pending
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
