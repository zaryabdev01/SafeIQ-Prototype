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
import { BrainCircuit, Users, AlertTriangle, MapPin, CheckCircle2, Search } from "lucide-react";

export default function DashboardPage() {
  const { rags, users, ragQuestions, dashboardAlerts, answerQuestion, markAlertRead, loginHistory } = useApp();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const [qSearch, setQSearch] = useState("");
  const [qRagFilter, setQRagFilter] = useState("");
  const [qDateFilter, setQDateFilter] = useState("");

  const [loginPersonFilter, setLoginPersonFilter] = useState("");
  const [loginDateFilter, setLoginDateFilter] = useState("");

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

  const filteredLogins = useMemo(() => {
    return [...loginHistory]
      .filter((l) => {
        if (loginPersonFilter && l.userId !== loginPersonFilter) return false;
        if (loginDateFilter && !l.loginAt.startsWith(loginDateFilter)) return false;
        return true;
      })
      .sort((a, b) => (a.loginAt < b.loginAt ? 1 : -1));
  }, [loginHistory, loginPersonFilter, loginDateFilter]);

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
    { label: "Team members", value: users.filter((u) => u.role === "employee").length, icon: Users, tone: "text-teal-600 bg-teal-50", href: "/team" },
    { label: "Active RAGs", value: rags.length, icon: BrainCircuit, tone: "text-brand bg-indigo-50", href: "/rag" },
    { label: "Alerts", value: unreadAlerts, icon: AlertTriangle, tone: "text-red-600 bg-red-50", href: "#alerts-panel" },
  ];

  return (
    <AppShell title="Dashboard" subtitle="Live overview across every RAG you manage">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-brand transition-colors">
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
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
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
              <h2 className="text-sm font-semibold text-slate-800">Recent sign-ins</h2>
            </CardHeader>
            <CardBody className="pb-3 flex gap-2">
              <Select value={loginPersonFilter} onChange={(e) => setLoginPersonFilter(e.target.value)} className="flex-1 text-xs py-1.5">
                <option value="">All people</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Input type="date" value={loginDateFilter} onChange={(e) => setLoginDateFilter(e.target.value)} className="flex-1 text-xs py-1.5" />
            </CardBody>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {filteredLogins.map((l) => (
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
              {filteredLogins.length === 0 && <p className="px-5 py-8 text-sm text-slate-400 text-center">No sign-ins match these filters.</p>}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
