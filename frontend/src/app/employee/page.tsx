"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
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
    { label: "My RAGs", value: myAssignments.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50", href: "/employee/my-rags" },
    { label: "My actions", value: openActions.length, icon: ListChecks, tone: "text-indigo-600 bg-indigo-50", href: "#my-actions" },
    { label: "Upcoming", value: upcomingBookings.length, icon: CalendarClock, tone: "text-teal-600 bg-teal-50", href: "#coming-up" },
    { label: "Needs attention", value: myAlerts + overdueActions, icon: ShieldAlert, tone: "text-red-600 bg-red-50", href: "/employee/alerts" },
  ];

  const filteredActions = openActionsForTab();
  function openActionsForTab() {
    if (actionTab === "all") return myActions;
    if (actionTab === "completed") return myActions.filter((a) => a.status === "completed");
    if (actionTab === "today") return myActions.filter((a) => a.status !== "completed" && a.dueAt === today);
    return myActions.filter((a) => a.status !== "completed" && (!a.dueAt || a.dueAt >= today));
  }

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
    <AppShell title={`Welcome back, ${currentUser.name.split(" ")[0]}`} subtitle={currentUser.jobTitle}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-brand transition-colors h-full">
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
          </Link>
        ))}
      </div>

      <Card id="ask-safeiq" className="mb-6">
        <CardBody>
          <p className="text-sm font-medium text-slate-800 flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-brand" /> How can Safe IQ help?
          </p>
          {myAssignments.length === 0 ? (
            <p className="text-xs text-slate-400">No RAGs assigned to you yet - your organisation will assign these.</p>
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
          <h2 className="text-sm font-semibold text-slate-800">My RAGs</h2>
          <Link href="/employee/my-rags" className="text-xs font-medium text-brand flex items-center gap-1 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <div className="flex gap-3 overflow-x-auto px-5 py-4">
          {myAssignments.map((a) => {
            const rag = rags.find((r) => r.id === a.ragId);
            if (!rag) return null;
            return (
              <div key={rag.id} className="shrink-0 w-64 rounded-lg border border-slate-200 px-3.5 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rag.colorTag }} />
                  <p className="text-sm font-medium text-slate-800 truncate">{rag.name}</p>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2.5">{rag.description || "No description yet."}</p>
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
          {myAssignments.length === 0 && <p className="px-1 py-6 text-sm text-slate-400">No RAGs assigned yet - your organisation will assign these.</p>}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card id="my-actions">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ListChecks size={15} /> My actions
              </h2>
              <Badge tone="slate">{myActions.length}</Badge>
            </CardHeader>
            <div className="flex items-center gap-1 px-5 pt-3 pb-1 border-b border-slate-100 flex-wrap">
              {ACTION_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActionTab(t.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    actionTab === t.key ? "bg-brand text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredActions.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{a.title}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
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
              {filteredActions.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">Nothing here.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <MessageSquare size={15} /> Recent conversations
              </h2>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {myQuestions.slice(0, 8).map((q) => (
                <div key={q.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700 truncate">{q.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {rags.find((r) => r.id === q.ragId)?.name ?? "Unknown RAG"} · {timeAgo(q.askedAt)}
                  </p>
                </div>
              ))}
              {myQuestions.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No conversations yet.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card id="coming-up">
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <CalendarClock size={15} /> Coming up
              </h2>
              <Link href="/calendar" className="text-xs text-brand hover:underline">
                Calendar
              </Link>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {upcomingBookings.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <p className="text-sm text-slate-800">{b.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {b.date} · {b.time}
                  </p>
                </div>
              ))}
              {upcomingBookings.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 text-center">Nothing coming up.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Lightbulb size={15} /> Advice for you
              </h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-slate-600 mb-3">{ADVICE_TIPS[adviceIndex]}</p>
              <div className="flex items-center gap-1.5">
                {ADVICE_TIPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAdviceIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === adviceIndex ? "bg-brand" : "bg-slate-200"}`}
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
