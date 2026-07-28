"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, severityTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { timeAgo } from "@/lib/format";
import { BrainCircuit, Users, AlertTriangle, HelpCircle, MapPin, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  const { rags, users, ragQuestions, dashboardAlerts, answerQuestion, markAlertRead, loginHistory } = useApp();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const sortedQuestions = useMemo(() => [...ragQuestions].sort((a, b) => (a.askedAt < b.askedAt ? 1 : -1)), [ragQuestions]);
  const sortedAlerts = useMemo(() => [...dashboardAlerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [dashboardAlerts]);
  const pendingCount = ragQuestions.filter((q) => q.status !== "answered").length;
  const unreadAlerts = dashboardAlerts.filter((a) => !a.read).length;
  const recentLogins = useMemo(() => [...loginHistory].sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1)).slice(0, 5), [loginHistory]);

  function userName(userId: string) {
    return users.find((u) => u.id === userId)?.name ?? "Unknown";
  }
  function ragName(ragId: string) {
    return rags.find((r) => r.id === ragId)?.name ?? "Unknown RAG";
  }

  function submitReply(questionId: string) {
    if (!replyText.trim()) return;
    answerQuestion(questionId, replyText.trim());
    setReplyFor(null);
    setReplyText("");
  }

  const stats = [
    { label: "Active RAGs", value: rags.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50" },
    { label: "Team members", value: users.filter((u) => u.role === "employee").length, icon: Users, tone: "text-teal-600 bg-teal-50" },
    { label: "Pending questions", value: pendingCount, icon: HelpCircle, tone: "text-amber-600 bg-amber-50" },
    { label: "Unread alerts", value: unreadAlerts, icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
  ];

  return (
    <AppShell title="Dashboard" subtitle="Live overview across every RAG you manage">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.tone}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900 leading-none">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Live questions - all RAGs</h2>
              <Badge tone="slate">{ragQuestions.length} total</Badge>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
              {sortedQuestions.map((q) => (
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
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
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
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-800">Recent sign-ins</h2>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {recentLogins.map((l) => (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-800">{userName(l.userId)}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={11} /> {l.location}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400">{timeAgo(l.loginAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
