"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import {
  DashboardStatTile,
  DashboardSectionTitle,
  DashboardEmptyState,
} from "@/components/dashboard/DashboardPrimitives";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import {
  BrainCircuit,
  ListChecks,
  ArrowRight,
  Key,
  ShieldAlert,
  Sparkles,
  Send,
  Loader2,
  CalendarClock,
  MessageSquare,
  Lightbulb,
  Check,
  Clock3,
  Home,
} from "lucide-react";
import type { ActionStatus } from "@/lib/types";

const ADVICE_TIPS = [
  "You can switch on any RAG from the floating widget using the access code your organisation shared with you.",
  "Flag an answer if it doesn't feel right - it opens a review with your alert owner, not just you.",
  "Voice mode lets you ask questions hands-free and hear the answer read back.",
  "Your Coming Up panel always shows your next few appointments, even from the dashboard.",
];

const ACTION_TABS: { key: "all" | "today" | "upcoming" | "completed"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Due today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

const LIST_PAGE_SIZE = 6;

export default function EmployeeHomePage() {
  const {
    currentUser,
    rags,
    ragAssignments,
    ragQuestions,
    alertCases,
    actions: allActions,
    updateActionStatus,
    bookings: allBookings,
    askRag,
    activeRagByUser,
    setActiveRagForUser,
  } = useApp();
  const [question, setQuestion] = useState("");
  const [askRagId, setAskRagId] = useState("");
  const [thinking, setThinking] = useState(false);
  const [actionTab, setActionTab] = useState<"all" | "today" | "upcoming" | "completed">("all");
  const [adviceIndex, setAdviceIndex] = useState(0);
  const [actionsPage, setActionsPage] = useState(1);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [bookingsPage, setBookingsPage] = useState(1);

  if (!currentUser) return null;

  const myAssignments = ragAssignments.filter((a) => a.userId === currentUser.id);
  const myActions = allActions.filter((a) => a.assigneeId === currentUser.id);
  const myBookings = allBookings.filter((b) => b.withUserId === currentUser.id && !b.cancelled);
  const myQuestions = ragQuestions.filter((q) => q.userId === currentUser.id).sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1));
  const myAlerts = alertCases.filter(
    (c) => c.status === "open" && (c.userId === currentUser.id || c.ownerId === currentUser.id || c.participantIds.includes(currentUser.id))
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const openActions = myActions.filter((a) => a.status !== "completed");
  const overdueActions = openActions.filter((a) => a.dueAt && a.dueAt < today).length;
  const upcomingBookings = myBookings.filter((b) => b.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const stats = [
    { label: "My RAGs", value: myAssignments.length, icon: BrainCircuit, tone: "text-brand bg-[var(--brand-tint-2)]", href: "/employee/my-rags" },
    { label: "My actions", value: openActions.length, icon: ListChecks, tone: "text-brand bg-[var(--brand-tint-2)]", href: "#my-actions" },
    { label: "Upcoming", value: upcomingBookings.length, icon: CalendarClock, tone: "text-teal-600 bg-teal-50", href: "#coming-up" },
    { label: "Needs attention", value: myAlerts + overdueActions, icon: ShieldAlert, tone: "text-red-600 bg-red-50", href: "/employee/alerts" },
  ];

  function openActionsForTab() {
    if (actionTab === "all") return myActions;
    if (actionTab === "completed") return myActions.filter((a) => a.status === "completed");
    if (actionTab === "today") return myActions.filter((a) => a.status !== "completed" && a.dueAt === today);
    return myActions.filter((a) => a.status !== "completed" && (!a.dueAt || a.dueAt >= today));
  }

  const filteredActions = openActionsForTab();
  const actionsTotalPages = Math.max(1, Math.ceil(filteredActions.length / LIST_PAGE_SIZE));
  const clampedActionsPage = Math.min(actionsPage, actionsTotalPages);
  const pagedActions = filteredActions.slice((clampedActionsPage - 1) * LIST_PAGE_SIZE, clampedActionsPage * LIST_PAGE_SIZE);

  const conversationsTotalPages = Math.max(1, Math.ceil(myQuestions.length / LIST_PAGE_SIZE));
  const clampedConversationsPage = Math.min(conversationsPage, conversationsTotalPages);
  const pagedQuestions = myQuestions.slice(
    (clampedConversationsPage - 1) * LIST_PAGE_SIZE,
    clampedConversationsPage * LIST_PAGE_SIZE
  );

  const bookingsTotalPages = Math.max(1, Math.ceil(upcomingBookings.length / LIST_PAGE_SIZE));
  const clampedBookingsPage = Math.min(bookingsPage, bookingsTotalPages);
  const pagedBookings = upcomingBookings.slice(
    (clampedBookingsPage - 1) * LIST_PAGE_SIZE,
    clampedBookingsPage * LIST_PAGE_SIZE
  );

  const userId = currentUser.id;
  const activeRagId = activeRagByUser[userId] ?? null;
  const effectiveAskRagId = askRagId || activeRagId || myAssignments[0]?.ragId || "";

  function submitDashboardQuestion() {
    if (!question.trim() || !effectiveAskRagId) return;
    if (!activeRagId || activeRagId !== effectiveAskRagId) setActiveRagForUser(userId, effectiveAskRagId);
    setThinking(true);
    window.setTimeout(() => {
      askRag(effectiveAskRagId, userId, question.trim(), false);
      setQuestion("");
      setThinking(false);
    }, 550);
  }

  function askThisRag(ragId: string) {
    setAskRagId(ragId);
    setActiveRagForUser(userId, ragId);
    document.getElementById("ask-safeiq")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <AppShell
      title={`Welcome back, ${currentUser.name.split(" ")[0]}`}
      subtitle={currentUser.jobTitle}
      icon={Home}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <DashboardStatTile
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            tone={s.tone}
            href={s.href}
            index={i}
          />
        ))}
      </div>

      <Card id="ask-safeiq" className="mb-6 border-brand/20 bg-gradient-to-br from-[var(--brand-tint-2)]/40 to-white">
        <CardBody>
          <p className="text-sm font-medium text-[var(--text-strong)] flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-brand" /> How can Safe IQ help?
          </p>
          {myAssignments.length === 0 ? (
            <p className="text-xs text-[var(--text-soft)]">No RAGs assigned to you yet — your organisation will assign these.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={effectiveAskRagId} onChange={(e) => setAskRagId(e.target.value)} className="sm:w-52">
                {myAssignments.map((a) => {
                  const rag = rags.find((r) => r.id === a.ragId);
                  return rag ? (
                    <option key={rag.id} value={rag.id}>
                      {rag.name}
                    </option>
                  ) : null;
                })}
              </Select>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitDashboardQuestion()}
                placeholder="Ask a question about policy, procedure, or anything covered by your RAGs..."
                className="flex-1"
              />
              <Button onClick={submitDashboardQuestion} disabled={thinking || !question.trim()}>
                {thinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <DashboardSectionTitle icon={BrainCircuit}>My RAGs</DashboardSectionTitle>
          <Link href="/employee/my-rags" className="text-xs font-medium text-brand flex items-center gap-1 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <div className="flex gap-3 overflow-x-auto px-5 py-4 scrollbar-thin">
          {myAssignments.map((a, index) => {
            const rag = rags.find((r) => r.id === a.ragId);
            if (!rag) return null;
            return (
              <div
                key={rag.id}
                className="shrink-0 w-64 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-warm)] px-3.5 py-3 transition-all duration-200 hover:border-brand hover:shadow-sm animate-page-enter"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                  <p className="text-sm font-medium text-[var(--text-strong)] truncate">{rag.name}</p>
                </div>
                <p className="text-xs text-[var(--text-soft)] line-clamp-2 mb-2.5">{rag.description || "No description yet."}</p>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="slate">
                    <Key size={11} /> {a.accessCode}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => askThisRag(rag.id)}>
                    Ask Safe IQ
                  </Button>
                </div>
              </div>
            );
          })}
          {myAssignments.length === 0 && (
            <p className="px-1 py-6 text-sm text-[var(--text-soft)]">No RAGs assigned yet — your organisation will assign these.</p>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card id="my-actions">
            <CardHeader>
              <DashboardSectionTitle icon={ListChecks}>My actions</DashboardSectionTitle>
              <Badge tone="slate">{myActions.length}</Badge>
            </CardHeader>
            <div className="flex items-center gap-1 px-5 pt-3 pb-1 border-b border-[var(--border-soft)] flex-wrap">
              {ACTION_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setActionTab(t.key);
                    setActionsPage(1);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-[var(--r-control)] font-medium transition-all duration-200 ${
                    actionTab === t.key ? "bg-brand text-white shadow-sm shadow-brand/20" : "text-[var(--text-soft)] hover:bg-[var(--brand-tint-2)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="divide-y divide-[var(--border-soft)]">
              {pagedActions.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[var(--surface-warm)]/80 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-body)] truncate">{a.title}</p>
                    <p className="text-xs text-[var(--text-soft)] flex items-center gap-1 mt-0.5">
                      <Clock3 size={10} /> {a.dueAt ? `Due ${a.dueAt}` : "No due date"}
                    </p>
                  </div>
                  {a.status === "completed" ? (
                    <Badge tone="green">Completed</Badge>
                  ) : (
                    <button
                      onClick={() => updateActionStatus(a.id, "completed" as ActionStatus)}
                      className="text-xs text-brand hover:underline shrink-0 flex items-center gap-1"
                    >
                      <Check size={12} /> Mark complete
                    </button>
                  )}
                </div>
              ))}
              {filteredActions.length === 0 && <DashboardEmptyState>Nothing here.</DashboardEmptyState>}
            </div>
            <Pagination
              page={clampedActionsPage}
              totalPages={actionsTotalPages}
              totalItems={filteredActions.length}
              pageSize={LIST_PAGE_SIZE}
              onChange={setActionsPage}
            />
          </Card>

          <Card>
            <CardHeader>
              <DashboardSectionTitle icon={MessageSquare}>Recent conversations</DashboardSectionTitle>
            </CardHeader>
            <div className="divide-y divide-[var(--border-soft)]">
              {pagedQuestions.map((q) => (
                <div key={q.id} className="px-5 py-3 hover:bg-[var(--surface-warm)]/80 transition-colors">
                  <p className="text-sm text-[var(--text-body)] truncate">{q.text}</p>
                  <p className="text-xs text-[var(--text-soft)] mt-0.5">
                    {rags.find((r) => r.id === q.ragId)?.name ?? "Unknown RAG"} · {timeAgo(q.askedAt)}
                  </p>
                </div>
              ))}
              {myQuestions.length === 0 && <DashboardEmptyState>No conversations yet.</DashboardEmptyState>}
            </div>
            <Pagination
              page={clampedConversationsPage}
              totalPages={conversationsTotalPages}
              totalItems={myQuestions.length}
              pageSize={LIST_PAGE_SIZE}
              onChange={setConversationsPage}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="coming-up">
            <CardHeader>
              <DashboardSectionTitle icon={CalendarClock}>Coming up</DashboardSectionTitle>
              <Link href="/calendar" className="text-xs text-brand hover:underline">
                Calendar
              </Link>
            </CardHeader>
            <div className="divide-y divide-[var(--border-soft)]">
              {pagedBookings.map((b) => (
                <div key={b.id} className="px-5 py-3 hover:bg-[var(--surface-warm)]/80 transition-colors">
                  <p className="text-sm text-[var(--text-body)]">{b.title}</p>
                  <p className="text-xs text-[var(--text-soft)] mt-0.5">
                    {b.date} · {b.time}
                  </p>
                </div>
              ))}
              {upcomingBookings.length === 0 && <DashboardEmptyState>Nothing coming up.</DashboardEmptyState>}
            </div>
            <Pagination
              page={clampedBookingsPage}
              totalPages={bookingsTotalPages}
              totalItems={upcomingBookings.length}
              pageSize={LIST_PAGE_SIZE}
              onChange={setBookingsPage}
            />
          </Card>

          <Card>
            <CardHeader>
              <DashboardSectionTitle icon={Lightbulb}>Advice for you</DashboardSectionTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-[var(--text-soft)] mb-3 animate-fade-in">{ADVICE_TIPS[adviceIndex]}</p>
              <div className="flex items-center gap-1.5">
                {ADVICE_TIPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAdviceIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === adviceIndex ? "w-4 bg-brand" : "w-1.5 bg-[var(--border-default)]"}`}
                    aria-label={`Tip ${i + 1}`}
                  />
                ))}
                <button onClick={() => setAdviceIndex((i) => (i + 1) % ADVICE_TIPS.length)} className="ml-auto text-xs text-brand hover:underline">
                  Next tip
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
